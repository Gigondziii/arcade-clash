// Comprehensive Match Lifecycle & Historical Persistence Audit Script for Fugluck.
// Run only with an isolated TEST_DATABASE_URL.

import "./require-disposable-test-database.ts";

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { randomUUID } from "node:crypto";
import { replayEngine, type InputLogEntry } from "@fugluck/shared";
import { neonRunnerReplayAdapter } from "../games/neon-runner/replay.ts";
import type { QueueEntry } from "../packages/server/src/matchmaking/queue.ts";
import type { MatchmakingSocket } from "../packages/server/src/matchmaking/socketAuth.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const VIEWPORT = { width: 1280, height: 720 };

function periodicLog(actionOn: string, actionOff: string | null, period: number, count: number): InputLogEntry[] {
  const log: InputLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const t = 20 + i * period;
    log.push({ tick: t, action: actionOn });
    if (actionOff) log.push({ tick: t + 4, action: actionOff });
  }
  return log;
}

function fakeSocket(userId: string, username: string): MatchmakingSocket {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const socket = {
    id: `socket-${userId}`,
    data: { userId, username },
    connected: true,
    emit: (event: string, payload: unknown) => {
      emitted.push({ event, payload });
      return true;
    },
    // @ts-expect-error test stub helper
    emitted,
  } as unknown as MatchmakingSocket;
  return socket;
}

console.log("=== match-lifecycle-durability-check ===");

async function main() {
  const { db, ensureUserSchema } = await import("../packages/server/src/db/client.ts");
  const { users, matchesHistory, matchSettlements, ledgerEntries } = await import("../packages/server/src/db/schema.ts");
  const { eq, and } = await import("drizzle-orm");
  const {
    createMatch,
    submitScore,
    handleDisconnect,
    recoverOrphanMatches,
    ensureMatchesHistoryTable,
  } = await import("../packages/server/src/matchmaking/matches.ts");
  const { escrowStake, ensureSignupGrant, ensureMatchSettlementsTable, getBalances, payoutWinner } = await import("../packages/server/src/wallet/ledger.ts");
  const { generateSeed } = await import("../packages/server/src/matchmaking/queue.ts");

  await ensureUserSchema();
  await ensureMatchSettlementsTable();
  await ensureMatchesHistoryTable();
  // Clear any leftover orphan matches from previous interrupted runs before testing
  await recoverOrphanMatches();

  // Create test users P1 & P2
  const p1Id = `usr_ml_p1_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const p2Id = `usr_ml_p2_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await db.insert(users).values([
    { id: p1Id, username: p1Id, passwordHash: "hash" },
    { id: p2Id, username: p2Id, passwordHash: "hash" },
  ]);

  await ensureSignupGrant(p1Id);
  await ensureSignupGrant(p2Id);

  // ---------------------------------------------------------------------------
  // Test 1: Immediate Persistence at Match Creation (State ACTIVE)
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Immediate Persistence at Match Creation");

  const socketA1 = fakeSocket(p1Id, "Player 1");
  const socketB1 = fakeSocket(p2Id, "Player 2");
  const seed1 = 424242;

  const entryA1: QueueEntry = { socket: socketA1, userId: p1Id, username: "Player 1", currency: "COINS", stake: 100 };
  const entryB1: QueueEntry = { socket: socketB1, userId: p2Id, username: "Player 2", currency: "COINS", stake: 100 };

  await createMatch("neon-runner", entryA1, entryB1, seed1);

  // Extract created matchId from emitted socket event
  // @ts-expect-error test payload access
  const matchedPayload1 = socketA1.emitted.find((e) => e.event === "matched")?.payload as any;
  const matchId1 = matchedPayload1?.matchId;

  check("Match socket matched event emitted with valid matchId", Boolean(matchId1));

  // Small async delay for DB write
  await new Promise((r) => setTimeout(r, 250));

  const dbMatch1 = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, matchId1) });
  check("Persistent match record exists immediately at match creation", Boolean(dbMatch1));
  check("Match record status is ACTIVE", dbMatch1?.status === "ACTIVE");
  check("Match record contains correct player1Id & player2Id", dbMatch1?.player1Id === p1Id && dbMatch1?.player2Id === p2Id);
  check("Match record startedAt timestamp is populated", Boolean(dbMatch1?.startedAt));
  check("Match record endedAt timestamp is null while active", dbMatch1?.endedAt === null);

  // ---------------------------------------------------------------------------
  // Test 2: Normal Match Completion Lifecycle (ACTIVE -> COMPLETED)
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Normal Match Completion Lifecycle");

  const p1Log = periodicLog("jumpPressed", "jumpReleased", 20, 25);
  const p2Log: InputLogEntry[] = [];
  const p1Outcome = replayEngine(neonRunnerReplayAdapter, seed1, p1Log, VIEWPORT);
  const p2Outcome = replayEngine(neonRunnerReplayAdapter, seed1, p2Log, VIEWPORT);

  await submitScore(socketA1, {
    matchId: matchId1,
    score: p1Outcome.finalScore,
    reason: "collision",
    durationMs: Math.round((p1Outcome.finalTick / 60) * 1000),
    inputLog: p1Log,
    viewport: VIEWPORT,
  });

  await submitScore(socketB1, {
    matchId: matchId1,
    score: p2Outcome.finalScore,
    reason: "collision",
    durationMs: Math.round((p2Outcome.finalTick / 60) * 1000),
    inputLog: p2Log,
    viewport: VIEWPORT,
  });

  await new Promise((r) => setTimeout(r, 100));

  const completedDbMatch1 = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, matchId1) });
  check("Match record transitions to COMPLETED status", completedDbMatch1?.status === "COMPLETED");
  check("Winner ID correctly set to Player 1", completedDbMatch1?.winnerId === p1Id);
  check("Player 1 score recorded correctly", completedDbMatch1?.scoreP1 === p1Outcome.finalScore);
  check("Player 2 score recorded correctly", completedDbMatch1?.scoreP2 === p2Outcome.finalScore);
  check("Match record endedAt timestamp is populated", Boolean(completedDbMatch1?.endedAt));

  const settlement1 = await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, matchId1) });
  check("Match settlement record exists with status PAYOUT", settlement1?.status === "PAYOUT");
  check("Match settlement winner payout matches pot (200 COINS)", settlement1?.winnerPayout === 200);

  // ---------------------------------------------------------------------------
  // Test 3: Disconnect Forfeit Lifecycle (ACTIVE -> DISCONNECTED)
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Disconnect Forfeit Lifecycle");

  const socketA2 = fakeSocket(p1Id, "Player 1");
  const socketB2 = fakeSocket(p2Id, "Player 2");

  const entryA2: QueueEntry = { socket: socketA2, userId: p1Id, username: "Player 1", currency: "COINS", stake: 50 };
  const entryB2: QueueEntry = { socket: socketB2, userId: p2Id, username: "Player 2", currency: "COINS", stake: 50 };

  await createMatch("space-blaster", entryA2, entryB2, generateSeed());
  // @ts-expect-error test payload access
  const matchId2 = (socketA2.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;

  await new Promise((r) => setTimeout(r, 250));

  // Simulate Player 1 disconnect with 0 grace window (immediate forfeit)
  socketA2.connected = false;
  await handleDisconnect(socketA2, 0);

  await new Promise((r) => setTimeout(r, 100));

  const dbMatch2 = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, matchId2) });
  check("Disconnected match transitions to DISCONNECTED status", dbMatch2?.status === "DISCONNECTED");
  check("Opponent (Player 2) determined as winner", dbMatch2?.winnerId === p2Id);
  check("Match endedAt timestamp is populated", Boolean(dbMatch2?.endedAt));

  const settlement2 = await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, matchId2) });
  check("Match settlement recorded for disconnect forfeit (PAYOUT)", settlement2?.status === "PAYOUT");

  // ---------------------------------------------------------------------------
  // Test 4: Crash Recovery for Orphan Active Matches (recoverOrphanMatches)
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Crash Recovery for Orphan Active Matches");

  const conflictingOrphanId = `match_orphan_conflict_${randomUUID()}`;
  const conflictingStake = 25;
  await escrowStake(p1Id, "COINS", conflictingStake, conflictingOrphanId);
  await escrowStake(p2Id, "COINS", conflictingStake, conflictingOrphanId);
  await db.insert(matchesHistory).values({
    id: conflictingOrphanId,
    gameId: "cyber-hopper",
    player1Id: p1Id,
    player2Id: p2Id,
    currency: "COINS",
    stake: conflictingStake,
    seed: 12344,
    status: "ACTIVE",
    startedAt: new Date(Date.now() - 2_000),
    createdAt: new Date(Date.now() - 2_000),
  });
  await payoutWinner(p1Id, p2Id, "COINS", conflictingStake, conflictingOrphanId);

  const orphanMatchId = `match_orphan_${randomUUID()}`;
  const orphanStake = 75;

  // Escrow stakes for both players
  await escrowStake(p1Id, "COINS", orphanStake, orphanMatchId);
  await escrowStake(p2Id, "COINS", orphanStake, orphanMatchId);

  const balP1PreRecover = await getBalances(p1Id);
  const balP2PreRecover = await getBalances(p2Id);

  // Insert orphan match in state ACTIVE simulating a process crash mid-game
  await db.insert(matchesHistory).values({
    id: orphanMatchId,
    gameId: "cyber-hopper",
    player1Id: p1Id,
    player2Id: p2Id,
    currency: "COINS",
    stake: orphanStake,
    seed: 12345,
    status: "ACTIVE",
    startedAt: new Date(),
  });

  // Run server startup orphan recovery
  const recoveredCount = await recoverOrphanMatches();
  check("one conflicting orphan does not block the later valid orphan", recoveredCount === 1);

  const conflictingOrphan = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, conflictingOrphanId) });
  const conflictingSettlement = await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, conflictingOrphanId) });
  check("conflicting orphan remains unchanged for explicit follow-up", conflictingOrphan?.status === "ACTIVE" && conflictingSettlement?.status === "PAYOUT");

  const recoveredMatch = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, orphanMatchId) });
  check("Orphan match status updated to INTERRUPTED", recoveredMatch?.status === "INTERRUPTED");
  check("Orphan match statusReason indicates server restart", recoveredMatch?.statusReason?.includes("Server restarted") === true);

  const balP1PostRecover = await getBalances(p1Id);
  const balP2PostRecover = await getBalances(p2Id);
  check("Player 1 escrowed stake fully refunded on recovery (+75 COINS)", balP1PostRecover.coins === balP1PreRecover.coins + orphanStake);
  check("Player 2 escrowed stake fully refunded on recovery (+75 COINS)", balP2PostRecover.coins === balP2PreRecover.coins + orphanStake);

  const orphanSettlement = await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, orphanMatchId) });
  check("Match settlement record created with status VOIDED", orphanSettlement?.status === "VOIDED");

  // ---------------------------------------------------------------------------
  // Test 5: Re-running Orphan Recovery is Safely Idempotent
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Re-running Orphan Recovery is Safely Idempotent");

  const secondRecoverCount = await recoverOrphanMatches();
  check("Second run of recoverOrphanMatches recovers 0 additional matches", secondRecoverCount === 0);

  const balP1Final = await getBalances(p1Id);
  check("Player 1 balance unchanged by idempotent recovery re-run", balP1Final.coins === balP1PostRecover.coins);

  await db
    .update(matchesHistory)
    .set({ status: "COMPLETED", winnerId: p1Id, endedAt: new Date() })
    .where(eq(matchesHistory.id, conflictingOrphanId));

  if (failures > 0) {
    console.log(`\nFAILURE: ${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log("\nALL MATCH LIFECYCLE & DURABILITY CHECKS PASSED 100%.");
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
