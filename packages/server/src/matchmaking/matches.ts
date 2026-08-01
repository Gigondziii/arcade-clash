import { randomUUID } from "node:crypto";
import type { PlayerResult, ScoreVerdict, SubmitScorePayload } from "@arcadeclash/shared";
import { determineDisconnectOutcome, determineMatchOutcome, type SidedSubmission } from "../validation/matchOutcome";
import { validateScore } from "../validation/scoreValidator";
import type { MatchmakingSocket } from "./socketAuth";
import { removeFromQueue, type QueueEntry } from "./queue";

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

type SubmittedResult = { score: number; reason: string; durationMs: number; verdict: ScoreVerdict };

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
  players: [MatchPlayer, MatchPlayer];
  forfeitTimer: ReturnType<typeof setTimeout> | null;
};

// In-memory only, same reasoning as queue.ts — see PROGRESS.md for what a
// server restart does to an in-progress match (state is simply gone; both
// sockets drop, each client shows "connection lost").
const matches = new Map<string, MatchState>();
// Reverse index so a disconnecting/submitting socket can find its match
// without scanning every match in the process.
const socketToMatch = new Map<MatchmakingSocket, string>();

function playerFor(match: MatchState, socket: MatchmakingSocket): MatchPlayer | null {
  if (match.players[0].socket === socket) return match.players[0];
  if (match.players[1].socket === socket) return match.players[1];
  return null;
}

function otherPlayer(match: MatchState, socket: MatchmakingSocket): MatchPlayer {
  return match.players[0].socket === socket ? match.players[1] : match.players[0];
}

function toPlayerResult(player: MatchPlayer): PlayerResult {
  if (!player.result) {
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
  matches.delete(matchId);
  for (const player of match.players) socketToMatch.delete(player.socket);
  return match;
}

// Emits a personalized matchResolved to each still-connected player, built
// from whatever `result` is currently on each MatchPlayer — works unchanged
// for a normal both-submitted resolution and a forfeit resolution (one
// player's result is simply null, toPlayerResult reports it as forfeited).
function emitResolved(match: MatchState): void {
  const [p1, p2] = match.players;
  const r1 = toPlayerResult(p1);
  const r2 = toPlayerResult(p2);
  const outcome = determineMatchOutcome(toSidedSubmission(p1), toSidedSubmission(p2));
  if (p1.socket.connected) {
    p1.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.a, you: r1, opponent: r2 });
  }
  if (p2.socket.connected) {
    p2.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.b, you: r2, opponent: r1 });
  }
}

// Used by index.ts to validate a visibilityHidden report actually belongs
// to a match this socket is in, before logging it — a cheap defensive check
// against a bogus matchId, same spirit as submitScore's own matchId check.
export function isSocketInMatch(socket: MatchmakingSocket, matchId: string): boolean {
  return socketToMatch.get(socket) === matchId;
}

export function createMatch(gameId: string, a: QueueEntry, b: QueueEntry, seed: number): void {
  // TEMPORARY DIAGNOSTIC — added to investigate a reported score
  // divergence (two zero-input match clients scoring 221 vs 157), not a
  // permanent addition. Remove once that's resolved. Confirms from a real
  // server log line, not just code reading, that both sides of a match are
  // issued the identical seed value.
  console.log(`[matchmaking] DIAGNOSTIC createMatch: gameId=${gameId} seed=${seed} a=${a.username} b=${b.username}`);
  const matchId = randomUUID();
  const players: [MatchPlayer, MatchPlayer] = [
    { socket: a.socket, userId: a.userId, username: a.username, result: null },
    { socket: b.socket, userId: b.userId, username: b.username, result: null },
  ];
  const match: MatchState = { id: matchId, gameId, seed, players, forfeitTimer: null };
  matches.set(matchId, match);
  socketToMatch.set(a.socket, matchId);
  socketToMatch.set(b.socket, matchId);

  a.socket.emit("matched", { matchId, gameId, seed, opponentUsername: b.username });
  b.socket.emit("matched", { matchId, gameId, seed, opponentUsername: a.username });
}

export function submitScore(socket: MatchmakingSocket, payload: SubmitScorePayload): void {
  if (
    !payload ||
    typeof payload.matchId !== "string" ||
    typeof payload.score !== "number" ||
    typeof payload.reason !== "string" ||
    typeof payload.durationMs !== "number" ||
    !Array.isArray(payload.inputLog) ||
    !payload.viewport
  ) {
    return;
  }

  const matchId = socketToMatch.get(socket);
  if (!matchId || matchId !== payload.matchId) return; // stale/bogus matchId — ignore

  const match = matches.get(matchId);
  if (!match) return;

  const player = playerFor(match, socket);
  if (!player || player.result) return; // not a participant, or a duplicate submission — ignore either way

  // TEMPORARY DIAGNOSTIC — see createMatch's matching comment. One line per
  // submission; both sides of a match share matchId+seed, so two lines with
  // the same matchId/seed and (possibly) different viewport settle the
  // "was it really the same seed" question directly from server console
  // output. Remove alongside createMatch's log once resolved.
  console.log(
    `[matchmaking] DIAGNOSTIC submitScore: matchId=${matchId} seed=${match.seed} user=${socket.data.username} ` +
      `viewport=${payload.viewport.width}x${payload.viewport.height} claimedScore=${payload.score}`,
  );

  // match.seed, never payload.seed — the server already issued this match's
  // seed at createMatch and never gave the client a way to propose one, so
  // there's nothing to trust from the client here.
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
  };

  const opponent = otherPlayer(match, socket);
  if (opponent.result) {
    endMatch(matchId);
    emitResolved(match);
    return;
  }

  match.forfeitTimer = setTimeout(() => {
    const ended = endMatch(matchId);
    if (ended) emitResolved(ended);
  }, FORFEIT_GRACE_MS);
}

// Covers both "queued, never matched" and "matched, socket dropped
// mid-match" — queue removal is always attempted first (a no-op if the
// socket wasn't queued), then match resolution if it was in one.
//
// A mid-match disconnect now resolves the match (a loss for the
// disconnecting player) rather than voiding it — voiding was a free escape
// from a losing position: close the tab, the match vanishes with no
// recorded result, same "deny the result" exploit the forfeit timer already
// closed for non-submission, reopened through a different door. See
// PROGRESS.md's session log for the full reasoning and the STAKES BLOCKER
// this creates (no reconnection window — a momentary network drop now costs
// the match outright too, not just a deliberate quit).
export function handleDisconnect(socket: MatchmakingSocket): void {
  removeFromQueue(socket);

  const matchId = socketToMatch.get(socket);
  if (!matchId) return;

  const match = matches.get(matchId);
  if (!match) return;

  const disconnected = playerFor(match, socket);
  if (!disconnected) return;

  // A disconnect from a player who ALREADY submitted a result is a no-op
  // for match resolution — they finished honestly and left, same as closing
  // the tab after any other website. Whatever happens next (the opponent's
  // own eventual submission, or the forfeit timer this player's own
  // submission already started) resolves the match normally, completely
  // unaffected by them being gone now — emitResolved() already skips a
  // disconnected socket via its own `.connected` check when that fires.
  if (disconnected.result) return;

  // From here: this player never submitted anything and is now gone
  // mid-match — an abandoned run, not a completed one. Resolve immediately
  // rather than leaving the match to rot in memory until the opponent's own
  // eventual submission or a server restart — see determineDisconnectOutcome
  // for why "opponent hasn't submitted either" still resolves as a win for
  // them here, not a void.
  const opponent = otherPlayer(match, socket);
  const outcome = determineDisconnectOutcome(toSidedSubmission(opponent));

  endMatch(matchId);

  if (!opponent.socket.connected) return;

  const opponentResult: PlayerResult = opponent.result
    ? toPlayerResult(opponent)
    : { username: opponent.username, score: null, reason: null, status: "opponent_disconnected" };
  const disconnectedResult: PlayerResult = { username: disconnected.username, score: null, reason: null, status: "forfeited" };

  opponent.socket.emit("matchResolved", {
    matchId: match.id,
    outcome: outcome.b,
    you: opponentResult,
    opponent: disconnectedResult,
  });
}
