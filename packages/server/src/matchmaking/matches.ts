import { randomUUID } from "node:crypto";
import type { PlayerResult, ScoreVerdict, SubmitScorePayload } from "@fugluck/shared";
import { asc, eq, or, sql } from "drizzle-orm";
import { determineDisconnectOutcome, determineMatchOutcome, type SidedSubmission } from "../validation/matchOutcome";
import { validateScore } from "../validation/scoreValidator";
import { db } from "../db/client";
import { matchesHistory } from "../db/schema";
import {
  ensureMatchSettlementsTable,
  escrowMatchStakes,
  payoutWinnerInTransaction,
  refundMatchSettlementInTransaction,
} from "../wallet/ledger";
import type { MatchmakingSocket } from "./socketAuth";
import { generateSeed, removeFromQueue, type QueueEntry } from "./queue";

let historyTableEnsured = false;
export async function ensureMatchesHistoryTable() {
  if (historyTableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS matches_history (
        id text PRIMARY KEY,
        game_id text NOT NULL,
        player1_id text NOT NULL,
        player2_id text NOT NULL,
        winner_id text,
        currency varchar(16) NOT NULL DEFAULT 'COINS',
        stake integer NOT NULL DEFAULT 0,
        seed bigint NOT NULL,
        input_log_p1 jsonb,
        input_log_p2 jsonb,
        score_p1 integer NOT NULL DEFAULT 0,
        score_p2 integer NOT NULL DEFAULT 0,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        status_reason text,
        created_at timestamp with time zone NOT NULL DEFAULT NOW(),
        started_at timestamp with time zone,
        ended_at timestamp with time zone
      );
      ALTER TABLE matches_history ALTER COLUMN seed TYPE bigint;
      ALTER TABLE matches_history ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
      ALTER TABLE matches_history ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone;
      CREATE INDEX IF NOT EXISTS idx_matches_p1 ON matches_history (player1_id);
      CREATE INDEX IF NOT EXISTS idx_matches_p2 ON matches_history (player2_id);
      CREATE INDEX IF NOT EXISTS idx_matches_game ON matches_history (game_id);
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches_history (status);
      CREATE INDEX IF NOT EXISTS idx_matches_created ON matches_history (created_at);
    `);
    historyTableEnsured = true;
  } catch {
    // Table may already exist
  }
}

// Grace window a player gets to submit a score once their opponent already
// has, before the match is resolved as a forfeit against them. Anchored at
// first submission rather than match start: these games have no fixed round
// length (they end on collision/game-over, not a clock), so a flat timer
// from match creation would risk cutting off a legitimately long, skilled
// run. Starting the clock only once someone is actually waiting means it can
// never fire against a run that's still honestly in progress when the match
// began — it only ever protects whoever already finished.
//
// 120s is generous relative to this project's own 60-180s round-length
// target (see PROGRESS.md's project summary), so it shouldn't cut off a
// top-of-range legitimate run. Deliberately not a void on timeout: the
// submitted score wins outright. Voiding would let a losing player's
// dominant strategy (don't submit, avoid the loss) succeed anyway; forfeit
// closes that off — submit and you have a shot at winning or tying, don't
// submit and you lose outright.
export const FORFEIT_GRACE_MS = 120_000;
export const RECONNECT_GRACE_MS = 10_000;

type SubmittedResult = {
  score: number;
  reason: string;
  durationMs: number;
  verdict: ScoreVerdict;
  inputLog?: Array<{ tick: number; action: string }>;
};

type MatchPlayer = {
  socket: MatchmakingSocket;
  userId: string;
  username: string;
  result: SubmittedResult | null;
};

type MatchState = {
  id: string;
  gameId: string;
  seed: number;
  currency: "COINS" | "DIAMONDS";
  stake: number;
  players: [MatchPlayer, MatchPlayer];
  forfeitTimer: ReturnType<typeof setTimeout> | null;
  resolutionInFlight: boolean;
  resolutionAttempts: number;
  resolutionRetryTimer: ReturnType<typeof setTimeout> | null;
};

export const MAX_TERMINAL_RESOLUTION_ATTEMPTS = 4;
export const TERMINAL_RESOLUTION_RETRY_BASE_MS = 1_000;
export const TERMINAL_RESOLUTION_RETRY_MAX_MS = 4_000;

let terminalResolutionFailureInjectorForTests: ((matchId: string, attempt: number) => void | Promise<void>) | null = null;
let terminalResolutionRetryDelayOverrideForTests: number | null = null;

export function configureTerminalResolutionRetryForTests(options: {
  failureInjector?: ((matchId: string, attempt: number) => void | Promise<void>) | null;
  retryDelayMs?: number | null;
}): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Terminal resolution test controls require NODE_ENV=test.");
  terminalResolutionFailureInjectorForTests = options.failureInjector ?? null;
  terminalResolutionRetryDelayOverrideForTests = options.retryDelayMs ?? null;
}

export function terminalResolutionRetryDelayMs(attempts: number): number {
  if (terminalResolutionRetryDelayOverrideForTests !== null) return terminalResolutionRetryDelayOverrideForTests;
  return Math.min(
    TERMINAL_RESOLUTION_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1),
    TERMINAL_RESOLUTION_RETRY_MAX_MS,
  );
}

export function isRetryableTerminalResolutionError(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  if (code === "40001" || code === "40P01" || code.startsWith("08") || code.startsWith("53")) return true;
  if (code.startsWith("22") || code.startsWith("23") || code.startsWith("42")) return false;

  const message = error instanceof Error ? error.message : String(error);
  return !(
    message.startsWith("Settlement conflict for match ") ||
    message.startsWith("Durable match ") ||
    message.startsWith("Invalid currency:") ||
    message.includes("must be a positive integer") ||
    message.startsWith("A player cannot escrow both sides") ||
    message.startsWith("Partial escrow invariant violation")
  );
}

function sanitizedError(error: unknown): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return raw
    .replace(/(postgres(?:ql)?:\/\/)([^\s/@:]+)(?::[^\s/@]*)?@/gi, "$1[REDACTED]@")
    .replace(/\b(password|passwd|pwd)\s*[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}

// In-memory only, same reasoning as queue.ts — see PROGRESS.md for what a
// server restart does to an in-progress match (state is simply gone; both
// sockets drop, each client shows "connection lost").
const matches = new Map<string, MatchState>();
// Reverse index so a disconnecting/submitting socket can find its match
// without scanning every match in the process.
const socketToMatch = new Map<MatchmakingSocket, string>();
// Map key `${matchId}:${userId}` -> disconnect grace period timer
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function playerFor(match: MatchState, socket: MatchmakingSocket): MatchPlayer | null {
  if (match.players[0].socket === socket) return match.players[0];
  if (match.players[1].socket === socket) return match.players[1];
  return null;
}

function playerForUserId(match: MatchState, userId: string): MatchPlayer | null {
  if (match.players[0].userId === userId) return match.players[0];
  if (match.players[1].userId === userId) return match.players[1];
  return null;
}

function otherPlayer(match: MatchState, socket: MatchmakingSocket): MatchPlayer {
  return match.players[0].socket === socket ? match.players[1] : match.players[0];
}

function toPlayerResult(player: MatchPlayer, disconnectedPlayer?: MatchPlayer): PlayerResult {
  if (!player.result) {
    if (disconnectedPlayer && player.userId !== disconnectedPlayer.userId) {
      return { username: player.username, score: null, reason: null, status: "opponent_disconnected" };
    }
    return { username: player.username, score: null, reason: null, status: "forfeited" };
  }
  return {
    username: player.username,
    score: player.result.score,
    reason: player.result.reason,
    status: "completed",
    verdict: player.result.verdict,
  };
}

function toSidedSubmission(player: MatchPlayer): SidedSubmission {
  if (!player.result) return null;
  return { score: player.result.score, verdict: player.result.verdict };
}

// Single cleanup path for every way a match can end (both submitted, forfeit
// timer fired, a player disconnected) — always clears the pending forfeit
// timer along with the match state, so a stale timer can never fire against
// a match that already ended some other way.
function endMatch(matchId: string): MatchState | undefined {
  const match = matches.get(matchId);
  if (!match) return undefined;
  if (match.forfeitTimer) clearTimeout(match.forfeitTimer);
  if (match.resolutionRetryTimer) clearTimeout(match.resolutionRetryTimer);

  for (const player of match.players) {
    const timerKey = `${matchId}:${player.userId}`;
    const timer = disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(timerKey);
    }
  }

  matches.delete(matchId);
  for (const player of match.players) socketToMatch.delete(player.socket);
  return match;
}

// Emits a personalized matchResolved to each still-connected player, built
// from whatever `result` is currently on each MatchPlayer — works unchanged
// for a normal both-submitted resolution, forfeit resolution, or disconnect resolution.
async function emitResolved(match: MatchState, disconnectedPlayer?: MatchPlayer): Promise<void> {
  if (match.resolutionInFlight) return;
  match.resolutionInFlight = true;
  match.resolutionAttempts++;
  const [p1, p2] = match.players;
  const r1 = toPlayerResult(p1, disconnectedPlayer);
  const r2 = toPlayerResult(p2, disconnectedPlayer);

  let outcome;
  if (disconnectedPlayer) {
    const isP1Disconnected = p1.userId === disconnectedPlayer.userId;
    const sidedOutcome = determineDisconnectOutcome(toSidedSubmission(isP1Disconnected ? p2 : p1));
    outcome = isP1Disconnected ? sidedOutcome : { a: sidedOutcome.b, b: sidedOutcome.a };
  } else {
    outcome = determineMatchOutcome(toSidedSubmission(p1), toSidedSubmission(p2));
  }

  const winnerId = outcome.a === "win" ? p1.userId : outcome.b === "win" ? p2.userId : null;
  const loserId = outcome.a === "win" ? p2.userId : outcome.b === "win" ? p1.userId : null;

  let finalStatus = "COMPLETED";
  if (disconnectedPlayer) {
    finalStatus = "DISCONNECTED";
  } else if (!p1.result || !p2.result) {
    finalStatus = "FORFEITED";
  } else if (outcome.a === "draw") {
    finalStatus = "DRAW";
  } else if (outcome.a === "void") {
    finalStatus = "VOIDED";
  }

  try {
    if (terminalResolutionFailureInjectorForTests) {
      await terminalResolutionFailureInjectorForTests(match.id, match.resolutionAttempts);
    }
    const balances = await db.transaction(async (tx) => {
      // Serialize every terminal attempt for this durable match row. A retry
      // after a transient failure sees ACTIVE and repeats the same transaction;
      // a duplicate after commit sees the terminal status and becomes a no-op.
      const locked = await tx.execute(sql`
        select id, status from matches_history where id = ${match.id} for update
      `);
      const row = locked.rows[0] as { id?: string; status?: string } | undefined;
      if (!row?.id) throw new Error(`Durable match ${match.id} does not exist.`);
      if (row.status !== "ACTIVE" && row.status !== "CREATED") return null;

      let p1Balances = null;
      let p2Balances = null;
      if (match.stake > 0) {
        if (winnerId && loserId) {
          const { winnerBalances } = await payoutWinnerInTransaction(
            tx,
            winnerId,
            loserId,
            match.currency,
            match.stake,
            match.id,
          );
          if (p1.userId === winnerId) p1Balances = winnerBalances;
          else p2Balances = winnerBalances;
        } else {
          const refundStatus = finalStatus === "DRAW" ? "DRAW" : "VOIDED";
          const refunded = await refundMatchSettlementInTransaction(
            tx,
            p1.userId,
            p2.userId,
            match.currency,
            match.stake,
            match.id,
            refundStatus,
          );
          p1Balances = refunded.p1Balances;
          p2Balances = refunded.p2Balances;
        }
      }

      await tx
        .update(matchesHistory)
        .set({
          winnerId,
          inputLogP1: p1.result?.inputLog ?? null,
          inputLogP2: p2.result?.inputLog ?? null,
          scoreP1: p1.result?.score ?? 0,
          scoreP2: p2.result?.score ?? 0,
          status: finalStatus,
          statusReason: winnerId ? `Winner: ${winnerId}` : `Outcome: ${finalStatus}`,
          endedAt: new Date(),
        })
        .where(eq(matchesHistory.id, match.id));

      return { p1Balances, p2Balances };
    });

    // A concurrent duplicate resolver that observes a terminal row must not
    // emit a second final event.
    if (!balances) {
      endMatch(match.id);
      return;
    }

    endMatch(match.id);
    if (p1.socket.connected && balances.p1Balances) {
      // @ts-expect-error custom event emission for live balance update
      p1.socket.emit("balanceUpdate", { balances: balances.p1Balances });
    }
    if (p2.socket.connected && balances.p2Balances) {
      // @ts-expect-error custom event emission for live balance update
      p2.socket.emit("balanceUpdate", { balances: balances.p2Balances });
    }
    const canRematch = Boolean(
      !disconnectedPlayer && p1.socket.connected && p2.socket.connected,
    );
    if (canRematch) {
      openRematchWindow(match);
    }
    if (p1.socket.connected) {
      p1.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.a, you: r1, opponent: r2, canRematch });
    }
    if (p2.socket.connected) {
      p2.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.b, you: r2, opponent: r1, canRematch });
    }
  } catch (err) {
    match.resolutionInFlight = false;
    const retryable = isRetryableTerminalResolutionError(err);
    const exhausted = match.resolutionAttempts >= MAX_TERMINAL_RESOLUTION_ATTEMPTS;
    if (!retryable || exhausted) {
      console.error(
        `[matches] Durable resolution stopped for match ${match.id} after ${match.resolutionAttempts} attempt(s): ${sanitizedError(err)}`,
      );
      endMatch(match.id);
      return;
    }

    const delayMs = terminalResolutionRetryDelayMs(match.resolutionAttempts);
    console.error(
      `[matches] Durable resolution attempt ${match.resolutionAttempts} failed for match ${match.id}; ` +
        `retrying in ${delayMs}ms: ${sanitizedError(err)}`,
    );
    if (matches.has(match.id)) {
      if (match.resolutionRetryTimer) clearTimeout(match.resolutionRetryTimer);
      match.resolutionRetryTimer = setTimeout(() => {
        match.resolutionRetryTimer = null;
        void emitResolved(match, disconnectedPlayer);
      }, delayMs);
    }
  }
}

// Used by index.ts to validate a visibilityHidden report actually belongs
// to a match this socket is in, before logging it — a cheap defensive check
// against a bogus matchId, same spirit as submitScore's own matchId check.
export function isSocketInMatch(socket: MatchmakingSocket, matchId: string): boolean {
  return socketToMatch.get(socket) === matchId;
}

export function getMatchIdForSocket(socket: MatchmakingSocket): string | undefined {
  return socketToMatch.get(socket);
}

export async function createMatch(
  gameId: string,
  a: QueueEntry,
  b: QueueEntry,
  seed: number,
  requestedMatchId?: string,
): Promise<string | null> {
  // SECURITY INVARIANT: Self-match guard is enforced by queue deduplication.
  // Both sides share the exact same server-issued match.seed.
  // GUEST INVARIANT: Matches involving an unauthenticated guest strictly enforce stake = 0 (Free Play).
  const isGuestMatch = Boolean(a.socket.data.isGuest || b.socket.data.isGuest);
  const currency = isGuestMatch ? "COINS" : (a.currency ?? "COINS");
  const stake = isGuestMatch ? 0 : (a.stake ?? 0);

  console.log(
    `[matchmaking] DIAGNOSTIC createMatch: gameId=${gameId} seed=${seed} a=${a.username} b=${b.username} guestMatch=${isGuestMatch} currency=${currency} stake=${stake}`,
  );

  const matchId = requestedMatchId ?? randomUUID();
  const match: MatchState = {
    id: matchId,
    gameId,
    seed,
    currency,
    stake,
    players: [
      { socket: a.socket, userId: a.userId, username: a.username, result: null },
      { socket: b.socket, userId: b.userId, username: b.username, result: null },
    ],
    forfeitTimer: null,
    resolutionInFlight: false,
    resolutionAttempts: 0,
    resolutionRetryTimer: null,
  };

  try {
    await ensureMatchesHistoryTable();
    const created = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(matchesHistory)
        .values({
          id: matchId,
          gameId,
          player1Id: a.userId,
          player2Id: b.userId,
          currency,
          stake,
          seed,
          status: "ACTIVE",
          startedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: matchesHistory.id });

      if (inserted.length === 0) return false;
      if (stake > 0) {
        await escrowMatchStakes(tx, a.userId, b.userId, currency, stake, matchId);
      }
      return true;
    });

    // Duplicate creation attempts are an idempotent no-op. In particular,
    // they cannot duplicate escrow or emit a second matched event.
    if (!created) return null;

    // In-memory activation and client notification happen only after the DB
    // transaction containing the ACTIVE row and both escrow debits commits.
    matches.set(matchId, match);
    socketToMatch.set(a.socket, matchId);
    socketToMatch.set(b.socket, matchId);
    a.socket.emit("matched", { matchId, gameId, seed, opponentUsername: b.username });
    b.socket.emit("matched", { matchId, gameId, seed, opponentUsername: a.username });
    return matchId;
  } catch (err) {
    console.error(`[matches] Match creation/escrow failed for ${matchId}:`, err);
    const message = err instanceof Error && err.message.includes("insufficient")
      ? "A player no longer has enough balance for this wager."
      : "Could not reserve both wagers. No match was started.";
    a.socket.emit("queueError", { message });
    b.socket.emit("queueError", { message });
    return null;
  }
}

export async function submitScore(socket: MatchmakingSocket, payload: SubmitScorePayload): Promise<void> {
  const matchId = socketToMatch.get(socket);
  if (!matchId || matchId !== payload.matchId) return; // stale/bogus matchId — ignore

  const match = matches.get(matchId);
  if (!match) return;

  const player = playerFor(match, socket);
  if (!player || player.result) return; // not a participant, or a duplicate submission — ignore either way

  console.log(
    `[matchmaking] DIAGNOSTIC submitScore: matchId=${matchId} seed=${match.seed} user=${socket.data.username} ` +
      `viewport=${payload.viewport.width}x${payload.viewport.height} claimedScore=${payload.score}`,
  );

  // SECURITY INVARIANT: Score validation uses match.seed issued by the server at createMatch.
  // Never uses client-provided seed input.
  const validation = validateScore({
    gameId: match.gameId,
    seed: match.seed,
    inputLog: payload.inputLog,
    claimedScore: payload.score,
    durationMs: payload.durationMs,
    viewport: payload.viewport,
  });

  player.result = {
    score: payload.score,
    reason: payload.reason,
    durationMs: payload.durationMs,
    verdict: validation.verdict,
    inputLog: payload.inputLog,
  };

  const opponent = otherPlayer(match, socket);
  if (opponent.result) {
    await emitResolved(match);
    return;
  }

  match.forfeitTimer = setTimeout(() => {
    const active = matches.get(matchId);
    if (active) void emitResolved(active);
  }, FORFEIT_GRACE_MS);
}

async function executeDisconnectForfeit(match: MatchState, disconnected: MatchPlayer): Promise<void> {
  await emitResolved(match, disconnected);
}

// Handles socket disconnect with a 10s grace period (RECONNECT_GRACE_MS).
// If reconnected before grace period expires, match state resumes seamlessly.
export async function handleDisconnect(socket: MatchmakingSocket, graceMs: number = RECONNECT_GRACE_MS): Promise<void> {
  removeFromQueue(socket);
  cancelRematchForSocket(socket, "Opponent left.");

  const matchId = socketToMatch.get(socket);
  if (!matchId) return;

  const match = matches.get(matchId);
  if (!match) return;

  const disconnected = playerFor(match, socket);
  if (!disconnected) return;

  if (disconnected.result) return;

  const timerKey = `${matchId}:${disconnected.userId}`;
  if (disconnectTimers.has(timerKey)) return;

  if (graceMs <= 0) {
    await executeDisconnectForfeit(match, disconnected);
    return;
  }

  const timer = setTimeout(() => {
    disconnectTimers.delete(timerKey);
    void executeDisconnectForfeit(match, disconnected);
  }, graceMs);

  disconnectTimers.set(timerKey, timer);
}

// Re-attaches a reconnected socket to an active match if within the grace window.
export function handleReconnect(userId: string, newSocket: MatchmakingSocket): boolean {
  rebindRematchSocket(userId, newSocket);
  for (const [matchId, match] of matches) {
    const player = playerForUserId(match, userId);
    if (player && !player.result) {
      const timerKey = `${matchId}:${userId}`;
      const timer = disconnectTimers.get(timerKey);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(timerKey);
      }
      socketToMatch.delete(player.socket);
      player.socket = newSocket;
      socketToMatch.set(newSocket, matchId);

      const opponent = otherPlayer(match, newSocket);
      newSocket.emit("matched", {
        matchId,
        gameId: match.gameId,
        seed: match.seed,
        opponentUsername: opponent.username,
      });
      return true;
    }
  }
  return false;
}

export function getActiveMatchesSummary() {
  return Array.from(matches.values()).map((m) => ({
    matchId: m.id,
    gameId: m.gameId,
    player1Id: m.players[0].userId,
    player1Username: m.players[0].username,
    player2Id: m.players[1].userId,
    player2Username: m.players[1].username,
    currency: m.currency,
    stake: m.stake,
    status: "ACTIVE",
  }));
}

export async function recoverOrphanMatches(): Promise<number> {
  await ensureMatchSettlementsTable();
  await ensureMatchesHistoryTable();
  const activeMatches = await db.query.matchesHistory.findMany({
    where: or(eq(matchesHistory.status, "ACTIVE"), eq(matchesHistory.status, "CREATED")),
    orderBy: asc(matchesHistory.createdAt),
  });

  if (!activeMatches || activeMatches.length === 0) return 0;

  console.log(`[matches] Found ${activeMatches.length} orphan active match(es) from previous server run. Recovering...`);

  let recoveredCount = 0;
  for (const m of activeMatches) {
    try {
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(matchesHistory)
          .set({
            status: "INTERRUPTED",
            statusReason: "Server restarted during active gameplay",
            endedAt: now,
          })
          .where(eq(matchesHistory.id, m.id));

        if (m.stake > 0) {
          await refundMatchSettlementInTransaction(
            tx,
            m.player1Id,
            m.player2Id,
            m.currency as "COINS" | "DIAMONDS",
            m.stake,
            m.id,
            "VOIDED",
          );
        }
      });
      endMatch(m.id);
      recoveredCount++;
    } catch (err) {
      console.error(`[matches] Failed to recover orphan match ${m.id}; continuing: ${sanitizedError(err)}`);
    }
  }
  return recoveredCount;
}

export const REMATCH_WINDOW_MS = 90_000;

type RematchPlayer = {
  userId: string;
  username: string;
  socket: MatchmakingSocket;
  wantsRematch: boolean;
};

type RematchWindow = {
  originalMatchId: string;
  gameId: string;
  currency: "COINS" | "DIAMONDS";
  stake: number;
  players: [RematchPlayer, RematchPlayer];
  timer: ReturnType<typeof setTimeout>;
};

const rematchByMatchId = new Map<string, RematchWindow>();
const socketToRematch = new Map<MatchmakingSocket, string>();

function rematchPlayerFor(window: RematchWindow, socket: MatchmakingSocket): RematchPlayer | null {
  if (window.players[0].socket === socket) return window.players[0];
  if (window.players[1].socket === socket) return window.players[1];
  return null;
}

function rematchPlayerForUserId(window: RematchWindow, userId: string): RematchPlayer | null {
  if (window.players[0].userId === userId) return window.players[0];
  if (window.players[1].userId === userId) return window.players[1];
  return null;
}

function closeRematchWindow(window: RematchWindow, reason?: string, exceptSocket?: MatchmakingSocket): void {
  clearTimeout(window.timer);
  rematchByMatchId.delete(window.originalMatchId);
  for (const player of window.players) {
    if (socketToRematch.get(player.socket) === window.originalMatchId) {
      socketToRematch.delete(player.socket);
    }
    if (reason && player.socket.connected && player.socket !== exceptSocket) {
      player.socket.emit("rematchUnavailable", { matchId: window.originalMatchId, reason });
    }
  }
}

function openRematchWindow(match: MatchState): void {
  const existing = rematchByMatchId.get(match.id);
  if (existing) closeRematchWindow(existing);

  const [p1, p2] = match.players;
  const timer = setTimeout(() => {
    const active = rematchByMatchId.get(match.id);
    if (active) closeRematchWindow(active, "Rematch offer expired.");
  }, REMATCH_WINDOW_MS);

  const window: RematchWindow = {
    originalMatchId: match.id,
    gameId: match.gameId,
    currency: match.currency,
    stake: match.stake,
    players: [
      { userId: p1.userId, username: p1.username, socket: p1.socket, wantsRematch: false },
      { userId: p2.userId, username: p2.username, socket: p2.socket, wantsRematch: false },
    ],
    timer,
  };
  rematchByMatchId.set(match.id, window);
  socketToRematch.set(p1.socket, match.id);
  socketToRematch.set(p2.socket, match.id);
}

function rebindRematchSocket(userId: string, newSocket: MatchmakingSocket): void {
  for (const window of rematchByMatchId.values()) {
    const player = rematchPlayerForUserId(window, userId);
    if (!player) continue;
    if (socketToRematch.get(player.socket) === window.originalMatchId) {
      socketToRematch.delete(player.socket);
    }
    player.socket = newSocket;
    socketToRematch.set(newSocket, window.originalMatchId);
  }
}

function cancelRematchForSocket(socket: MatchmakingSocket, reason: string): void {
  const matchId = socketToRematch.get(socket);
  if (!matchId) return;
  const window = rematchByMatchId.get(matchId);
  if (!window) {
    socketToRematch.delete(socket);
    return;
  }
  closeRematchWindow(window, reason);
}

export function handleRequestRematch(socket: MatchmakingSocket, payload: { matchId?: unknown }): void {
  if (!payload || typeof payload.matchId !== "string") {
    socket.emit("rematchUnavailable", { matchId: "", reason: "Invalid rematch request." });
    return;
  }

  const window = rematchByMatchId.get(payload.matchId);
  const player = window ? rematchPlayerFor(window, socket) : null;
  if (!window || !player) {
    socket.emit("rematchUnavailable", { matchId: payload.matchId, reason: "Rematch is no longer available." });
    return;
  }

  player.wantsRematch = true;
  const opponent = window.players[0] === player ? window.players[1] : window.players[0];

  if (opponent.wantsRematch) {
    if (!player.socket.connected || !opponent.socket.connected) {
      closeRematchWindow(window, "Opponent left.");
      return;
    }
    const gameId = window.gameId;
    const a: QueueEntry = {
      socket: window.players[0].socket,
      userId: window.players[0].userId,
      username: window.players[0].username,
      currency: window.currency,
      stake: window.stake,
    };
    const b: QueueEntry = {
      socket: window.players[1].socket,
      userId: window.players[1].userId,
      username: window.players[1].username,
      currency: window.currency,
      stake: window.stake,
    };
    closeRematchWindow(window);
    void createMatch(gameId, a, b, generateSeed());
    return;
  }

  socket.emit("rematchWaiting", { matchId: window.originalMatchId });
  if (opponent.socket.connected) {
    opponent.socket.emit("rematchOffered", {
      matchId: window.originalMatchId,
      fromUsername: player.username,
    });
  }
}

export function handleDeclineRematch(socket: MatchmakingSocket, payload: { matchId?: unknown }): void {
  const matchId = typeof payload?.matchId === "string" ? payload.matchId : socketToRematch.get(socket);
  if (!matchId) return;
  const window = rematchByMatchId.get(matchId);
  if (!window || !rematchPlayerFor(window, socket)) return;
  closeRematchWindow(window, "Opponent declined a rematch.", socket);
}
