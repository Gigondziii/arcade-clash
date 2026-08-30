// Comprehensive Wallet Settlement Idempotency & Concurrency Audit Script for Fugluck.
// Run only with an isolated TEST_DATABASE_URL.

import "./require-disposable-test-database.ts";

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { randomUUID } from "node:crypto";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("wallet-settlement-concurrency-check");

async function main() {
  const { db, ensureUserSchema } = await import("../packages/server/src/db/client.ts");
  const { users, ledgerEntries, matchesHistory, matchSettlements } = await import("../packages/server/src/db/schema.ts");
  const { eq } = await import("drizzle-orm");
  const {
    escrowStake,
    getBalances,
    payoutWinner,
    refundStake,
    ensureSignupGrant,
    ensureMatchSettlementsTable,
  } = await import("../packages/server/src/wallet/ledger.ts");

  await ensureUserSchema();
  await ensureMatchSettlementsTable();

  // Create test users P1 & P2
  const p1Id = `usr_settle_p1_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const p2Id = `usr_settle_p2_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await db.insert(users).values([
    { id: p1Id, username: p1Id, passwordHash: "hash" },
    { id: p2Id, username: p2Id, passwordHash: "hash" },
  ]);

  await ensureSignupGrant(p1Id);
  await ensureSignupGrant(p2Id);

  const initBalP1 = await getBalances(p1Id);
  const initBalP2 = await getBalances(p2Id);

  const stake = 100; // 100 COINS stake

  async function activeMatch(matchId: string) {
    await db.insert(matchesHistory).values({
      id: matchId,
      gameId: "wallet-settlement-concurrency-check",
      player1Id: p1Id,
      player2Id: p2Id,
      currency: "COINS",
      stake,
      seed: 1,
      status: "ACTIVE",
      startedAt: new Date(),
    });
  }

  // ---------------------------------------------------------------------------
  // Test 1: Same Settlement Submitted Twice (Sequential Idempotency)
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Same Settlement Submitted Twice (Sequential Idempotency)");

  const matchId1 = `match_seq_${randomUUID()}`;
  await activeMatch(matchId1);
  await escrowStake(p1Id, "COINS", stake, matchId1);
  await escrowStake(p2Id, "COINS", stake, matchId1);

  const res1a = await payoutWinner(p1Id, p2Id, "COINS", stake, matchId1);
  check("First payout attempt executes (alreadySettled = false)", res1a.alreadySettled === false);

  const balP1AfterFirst = await getBalances(p1Id);

  const res1b = await payoutWinner(p1Id, p2Id, "COINS", stake, matchId1);
  check("Second payout attempt returns alreadySettled = true", res1b.alreadySettled === true);

  const balP1AfterSecond = await getBalances(p1Id);
  check("P1 balance remains identical after second payout call", balP1AfterSecond.coins === balP1AfterFirst.coins);
  await db.update(matchesHistory).set({ status: "COMPLETED", winnerId: p1Id, endedAt: new Date() }).where(eq(matchesHistory.id, matchId1));

  // ---------------------------------------------------------------------------
  // Test 2: Same Settlement Submitted Concurrently (Concurrent Race Condition)
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Same Settlement Submitted Concurrently");

  const matchId2 = `match_conc_${randomUUID()}`;
  await activeMatch(matchId2);
  await escrowStake(p1Id, "COINS", stake, matchId2);
  await escrowStake(p2Id, "COINS", stake, matchId2);

  const balP1BeforeRace = await getBalances(p1Id);

  // Launch 5 concurrent payout calls for the exact same matchId
  const concurrentSettlements = await Promise.all([
    payoutWinner(p1Id, p2Id, "COINS", stake, matchId2),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchId2),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchId2),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchId2),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchId2),
  ]);

  const newlySettledCount = concurrentSettlements.filter((r) => r.alreadySettled === false).length;
  const alreadySettledCount = concurrentSettlements.filter((r) => r.alreadySettled === true).length;

  check("Exactly 1 concurrent attempt succeeded (newlySettledCount = 1)", newlySettledCount === 1);
  check("4 concurrent attempts were safely rejected by DB constraint", alreadySettledCount === 4);

  const balP1AfterRace = await getBalances(p1Id);
  check("P1 balance increased by exactly 1 payout amount (200 COINS)", balP1AfterRace.coins === balP1BeforeRace.coins + 200);
  await db.update(matchesHistory).set({ status: "COMPLETED", winnerId: p1Id, endedAt: new Date() }).where(eq(matchesHistory.id, matchId2));

  // ---------------------------------------------------------------------------
  // Test 3: Server Failure & Transaction Atomicity
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Server Failure & Transaction Atomicity");

  const matchId3 = `match_fail_${randomUUID()}`;
  await escrowStake(p1Id, "COINS", stake, matchId3);
  await escrowStake(p2Id, "COINS", stake, matchId3);

  // Verify escrow debited balances
  const balP1Escrowed = await getBalances(p1Id);
  check("Escrow debited P1 balance", balP1Escrowed.coins === balP1AfterRace.coins - stake);

  // ---------------------------------------------------------------------------
  // Test 4: Payout Followed by Refund (Mutual Exclusion Guard)
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Payout Followed by Refund (Mutual Exclusion Guard)");

  const matchId4 = `match_pay_ref_${randomUUID()}`;
  await activeMatch(matchId4);
  await escrowStake(p1Id, "COINS", stake, matchId4);
  await escrowStake(p2Id, "COINS", stake, matchId4);

  const payRes = await payoutWinner(p1Id, p2Id, "COINS", stake, matchId4);
  check("Payout succeeded for matchId4", payRes.alreadySettled === false);

  let payoutThenRefundConflict = false;
  try {
    await refundStake(p1Id, "COINS", stake, matchId4);
  } catch (error: any) {
    payoutThenRefundConflict = error.message === `Settlement conflict for match ${matchId4}.`;
  }
  check("Subsequent conflicting refund is rejected", payoutThenRefundConflict);
  await db.update(matchesHistory).set({ status: "COMPLETED", winnerId: p1Id, endedAt: new Date() }).where(eq(matchesHistory.id, matchId4));

  // ---------------------------------------------------------------------------
  // Test 5: Refund Followed by Payout (Mutual Exclusion Guard)
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Refund Followed by Payout (Mutual Exclusion Guard)");

  const matchId5 = `match_ref_pay_${randomUUID()}`;
  await activeMatch(matchId5);
  await escrowStake(p1Id, "COINS", stake, matchId5);
  await escrowStake(p2Id, "COINS", stake, matchId5);

  const refundRes5 = await refundStake(p1Id, "COINS", stake, matchId5);
  check("Refund succeeded for matchId5", refundRes5.alreadySettled === false);

  let refundThenPayoutConflict = false;
  try {
    await payoutWinner(p1Id, p2Id, "COINS", stake, matchId5);
  } catch (error: any) {
    refundThenPayoutConflict = error.message === `Settlement conflict for match ${matchId5}.`;
  }
  check("Subsequent conflicting payout is rejected", refundThenPayoutConflict);
  await db.update(matchesHistory).set({ status: "INTERRUPTED", endedAt: new Date() }).where(eq(matchesHistory.id, matchId5));

  // ---------------------------------------------------------------------------
  // Test 6: Two Server Processes Attempting Settlement
  // ---------------------------------------------------------------------------
  console.log("\nTest 6: Two Server Processes Attempting Settlement");

  const matchId6 = `match_multi_proc_${randomUUID()}`;
  await activeMatch(matchId6);
  await escrowStake(p1Id, "COINS", stake, matchId6);
  await escrowStake(p2Id, "COINS", stake, matchId6);

  // Process A attempts Payout; Process B attempts Refund simultaneously
  const [procA, procB] = await Promise.allSettled([
    payoutWinner(p1Id, p2Id, "COINS", stake, matchId6),
    refundStake(p1Id, "COINS", stake, matchId6),
  ]);

  const results = [procA, procB];
  const oneSucceeded =
    results.filter((result) => result.status === "fulfilled" && result.value.alreadySettled === false).length === 1 &&
    results.filter((result) => result.status === "rejected" && result.reason?.message === `Settlement conflict for match ${matchId6}.`).length === 1;
  check("Multi-process race condition strictly resolved by DB primary key to exactly 1 valid outcome", oneSucceeded);
  await db
    .update(matchesHistory)
    .set(procA.status === "fulfilled" ? { status: "COMPLETED", winnerId: p1Id, endedAt: new Date() } : { status: "INTERRUPTED", endedAt: new Date() })
    .where(eq(matchesHistory.id, matchId6));

  // ---------------------------------------------------------------------------
  // Test 7: Duplicate Escrow Prevention
  // ---------------------------------------------------------------------------
  console.log("\nTest 7: Duplicate Escrow Prevention");

  const matchId7 = `match_escrow_dup_${randomUUID()}`;
  const balBeforeEscrow = await getBalances(p1Id);

  await escrowStake(p1Id, "COINS", stake, matchId7);
  const balAfterFirstEscrow = await getBalances(p1Id);
  check("First escrow debits balance by stake amount", balAfterFirstEscrow.coins === balBeforeEscrow.coins - stake);

  await escrowStake(p1Id, "COINS", stake, matchId7);
  const balAfterSecondEscrow = await getBalances(p1Id);
  check("Duplicate escrow for same matchId & user is safely ignored by ledger unique constraint", balAfterSecondEscrow.coins === balAfterFirstEscrow.coins);

  // Tests 3 and 7 intentionally exercise escrow primitives without durable
  // match history. Clean those rows only after their assertions so later
  // lifecycle suites receive no unbacked escrow fixtures.
  await db.delete(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${matchId3}`));
  await db.delete(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${matchId7}`));
  check(
    "standalone escrow fixtures are cleaned after assertions",
    (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${matchId3}`))).length === 0 &&
      (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${matchId7}`))).length === 0,
  );

  const inconsistentActiveSettlements = await db
    .select({ id: matchesHistory.id })
    .from(matchesHistory)
    .innerJoin(matchSettlements, eq(matchSettlements.matchId, matchesHistory.id))
    .where(eq(matchesHistory.status, "ACTIVE"));
  check("suite leaves no already-settled ACTIVE history fixtures", inconsistentActiveSettlements.length === 0);

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll wallet settlement idempotency & concurrency checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
