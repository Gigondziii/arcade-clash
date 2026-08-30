// Destructive financial integration test. The first import fails closed unless
// TEST_DATABASE_URL is a structurally isolated, clearly named test database.
// Run only after applying all migrations to that disposable database:
//   TEST_DATABASE_URL=... npx tsx scripts/atomic-wager-lifecycle-check.ts
import "./require-disposable-test-database.ts";

import { randomUUID } from "node:crypto";
import type { InputLogEntry, SubmitScorePayload } from "@fugluck/shared";
import type { MatchmakingSocket, MatchmakingSocketData } from "../packages/server/src/matchmaking/socketAuth.ts";

type Emitted = { event: string; payload: any };
let failures = 0;
let passes = 0;
function check(label: string, condition: boolean): void {
  if (condition) {
    passes++;
    console.log(`PASS ${label}`);
  } else {
    failures++;
    console.error(`FAIL ${label}`);
  }
}

function fakeSocket(userId: string, username: string): MatchmakingSocket & { emitted: Emitted[] } {
  const emitted: Emitted[] = [];
  return {
    id: randomUUID(),
    connected: true,
    data: { userId, username } as MatchmakingSocketData,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
      return true;
    },
    emitted,
  } as unknown as MatchmakingSocket & { emitted: Emitted[] };
}

async function main(): Promise<void> {
  process.env.NODE_ENV = "test";
  const [{ and, eq, inArray }, { db, pool }, schema, ledger, matches, runner] = await Promise.all([
    import("drizzle-orm"),
    import("../packages/server/src/db/client.ts"),
    import("../packages/server/src/db/schema.ts"),
    import("../packages/server/src/wallet/ledger.ts"),
    import("../packages/server/src/matchmaking/matches.ts"),
    import("../games/neon-runner/replay.ts"),
  ]);
  const { users, ledgerEntries, matchesHistory, matchSettlements } = schema;
  const prefix = `atomic_${Date.now()}_${randomUUID().slice(0, 6)}`;
  const userIds: string[] = [];
  const matchIds: string[] = [];

  async function user(label: string, coins: number, diamonds = 0): Promise<string> {
    const id = `${prefix}_${label}`;
    userIds.push(id);
    const username = `${label.slice(0, 15)}_${randomUUID().slice(0, 12)}`;
    await db.insert(users).values({ id, username, passwordHash: "test-only" });
    const grants = [];
    if (coins) grants.push({ id: randomUUID(), userId: id, currency: "COINS", amount: coins, reason: `${prefix}:coins` });
    if (diamonds) grants.push({ id: randomUUID(), userId: id, currency: "DIAMONDS", amount: diamonds, reason: `${prefix}:diamonds` });
    if (grants.length) await db.insert(ledgerEntries).values(grants);
    return id;
  }

  async function create(
    label: string,
    p1: string,
    p2: string,
    stake: number,
    currency: "COINS" | "DIAMONDS" = "COINS",
  ) {
    const id = `${prefix}_${label}`;
    matchIds.push(id);
    const a = fakeSocket(p1, p1);
    const b = fakeSocket(p2, p2);
    const result = await matches.createMatch(
      "neon-runner",
      { socket: a, userId: p1, username: p1, stake, currency },
      { socket: b, userId: p2, username: p2, stake, currency },
      424242,
      id,
    );
    return { id, result, a, b };
  }

  function terminalPayload(matchId: string, claimedDelta = 0): SubmitScorePayload {
    const outcome = runner.neonRunnerReplayAdapter;
    const engine = outcome.createEngine(424242);
    outcome.resize(engine, 1280, 720);
    engine.reset();
    const input = outcome.createInitialInput();
    let finalTick = 0;
    for (; finalTick < 21_600; finalTick++) {
      const result = outcome.update(engine, 1 / 60, input);
      outcome.clearPulses(input);
      if (outcome.isTerminal(result)) break;
    }
    return {
      matchId,
      score: engine.score + claimedDelta,
      reason: "collision",
      durationMs: Math.round((finalTick / 60) * 1000),
      inputLog: [] as InputLogEntry[],
      viewport: { width: 1280, height: 720 },
    };
  }

  async function waitUntil(condition: () => boolean, timeoutMs = 2_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (!condition() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return condition();
  }

  try {
    const richA = await user("rich_a", 500, 100);
    const richB = await user("rich_b", 500, 100);
    const success = await create("escrow_success", richA, richB, 100);
    check("both sufficient: match starts", success.result === success.id);
    check("matched emitted only after committed creation", success.a.emitted.some((e) => e.event === "matched"));
    check("both stakes escrow exactly once", (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${success.id}`))).length === 2);

    const poorA = await user("poor_a", 0);
    const fundedB = await user("funded_b", 100);
    const failA = await create("insufficient_a", poorA, fundedB, 100);
    check("player A insufficient: match not started", failA.result === null && !failA.a.emitted.some((e) => e.event === "matched"));
    check("player A insufficient: no partial escrow", (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${failA.id}`))).length === 0);

    const fundedA = await user("funded_a", 100);
    const poorB = await user("poor_b", 0);
    const failB = await create("insufficient_b", fundedA, poorB, 100);
    check("player B insufficient: match not started", failB.result === null);
    check("failure after first logical debit leaves no partial escrow", (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${failB.id}`))).length === 0);

    const poorC = await user("poor_c", 0);
    const poorD = await user("poor_d", 0);
    const failBoth = await create("insufficient_both", poorC, poorD, 100);
    check("neither sufficient: match not started", failBoth.result === null);

    const shared = await user("concurrent_shared", 100);
    const opponent1 = await user("concurrent_o1", 100);
    const opponent2 = await user("concurrent_o2", 100);
    const [race1, race2] = await Promise.all([
      create("race_1", shared, opponent1, 100),
      create("race_2", shared, opponent2, 100),
    ]);
    check("simultaneous matches cannot double-spend", [race1.result, race2.result].filter(Boolean).length === 1);
    check("no negative balance after concurrent escrow", (await ledger.getBalances(shared)).coins === 0);

    const duplicate = await matches.createMatch(
      "neon-runner",
      { socket: success.a, userId: richA, username: richA, stake: 100, currency: "COINS" },
      { socket: success.b, userId: richB, username: richB, stake: 100, currency: "COINS" },
      424242,
      success.id,
    );
    check("duplicate match creation is idempotent", duplicate === null);
    check("duplicate creation does not duplicate debits", (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${success.id}`))).length === 2);

    await matches.submitScore(success.a, terminalPayload(success.id));
    await matches.submitScore(success.a, terminalPayload(success.id));
    await Promise.all([
      matches.submitScore(success.b, terminalPayload(success.id, 1)),
      matches.submitScore(success.b, terminalPayload(success.id, 1)),
    ]);
    const winnerSettlement = await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, success.id) });
    const winnerHistory = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, success.id) });
    check("successful winner settlement persisted", winnerSettlement?.status === "PAYOUT" && winnerSettlement.winnerId === richA);
    check("duplicate and concurrent duplicate results settle once", (await db.select().from(matchSettlements).where(eq(matchSettlements.matchId, success.id))).length === 1);
    check("history and winner settlement agree", winnerHistory?.winnerId === winnerSettlement?.winnerId && winnerHistory?.status === "COMPLETED");
    check("resolved emitted only after durable terminal state", success.a.emitted.some((e) => e.event === "matchResolved") && winnerHistory?.status === "COMPLETED");

    const drawA = await user("draw_a", 100);
    const drawB = await user("draw_b", 100);
    const draw = await create("draw", drawA, drawB, 100);
    await Promise.all([matches.submitScore(draw.a, terminalPayload(draw.id)), matches.submitScore(draw.b, terminalPayload(draw.id))]);
    check("draw refunds exactly once", (await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, draw.id) }))?.status === "DRAW");
    check("draw restores both balances", (await ledger.getBalances(drawA)).coins === 100 && (await ledger.getBalances(drawB)).coins === 100);

    const voidA = await user("void_a", 100);
    const voidB = await user("void_b", 100);
    const voided = await create("void", voidA, voidB, 100);
    await Promise.all([matches.submitScore(voided.a, terminalPayload(voided.id, 1)), matches.submitScore(voided.b, terminalPayload(voided.id, 1))]);
    check("void settlement persisted", (await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, voided.id) }))?.status === "VOIDED");
    check("void restores both balances", (await ledger.getBalances(voidA)).coins === 100 && (await ledger.getBalances(voidB)).coins === 100);

    const refundA = await user("refund_a", 50);
    const refundB = await user("refund_b", 50);
    const refund = await create("refund", refundA, refundB, 50);
    await ledger.refundMatchSettlement(refundA, refundB, "COINS", 50, refund.id, "REFUND");
    await ledger.refundMatchSettlement(refundA, refundB, "COINS", 50, refund.id, "REFUND");
    check("refund settlement is idempotent", (await db.select().from(matchSettlements).where(eq(matchSettlements.matchId, refund.id))).length === 1);
    check("refund restores balances", (await ledger.getBalances(refundA)).coins === 50 && (await ledger.getBalances(refundB)).coins === 50);

    const rollbackA = await user("rollback_a", 50);
    const rollbackB = await user("rollback_b", 50);
    const rollback = await create("rollback", rollbackA, rollbackB, 50);
    await db.transaction(async (tx) => {
      await ledger.payoutWinnerInTransaction(tx, rollbackA, rollbackB, "COINS", 50, rollback.id);
      throw new Error("simulated failure before commit");
    }).catch(() => undefined);
    check("settlement failure before commit leaves no settlement", !(await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, rollback.id) })));
    await ledger.payoutWinner(rollbackA, rollbackB, "COINS", 50, rollback.id);
    check("retry after simulated failure converges", (await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, rollback.id) }))?.status === "PAYOUT");

    const retryA = await user("retry_a", 50);
    const retryB = await user("retry_b", 50);
    const retry = await create("retry_transient", retryA, retryB, 50);
    let transientAttempts = 0;
    matches.configureTerminalResolutionRetryForTests({
      retryDelayMs: 20,
      failureInjector: (matchId, attempt) => {
        if (matchId !== retry.id) return;
        transientAttempts++;
        if (attempt === 1) throw Object.assign(new Error("simulated serialization failure"), { code: "40001" });
      },
    });
    await matches.submitScore(retry.a, terminalPayload(retry.id));
    await matches.submitScore(retry.b, terminalPayload(retry.id, 1));
    check("transient resolution failure retries to success", await waitUntil(() => retry.a.emitted.some((e) => e.event === "matchResolved")));
    await new Promise((resolve) => setTimeout(resolve, 60));
    check("successful retry has no dangling timer", transientAttempts === 2 && !matches.getActiveMatchesSummary().some((m) => m.matchId === retry.id));
    check("transient retry creates one settlement", (await db.select().from(matchSettlements).where(eq(matchSettlements.matchId, retry.id))).length === 1);

    const conflictA = await user("conflict_a", 50);
    const conflictB = await user("conflict_b", 50);
    const conflict = await create("retry_conflict", conflictA, conflictB, 50);
    let conflictAttempts = 0;
    matches.configureTerminalResolutionRetryForTests({
      retryDelayMs: 20,
      failureInjector: (matchId) => {
        if (matchId !== conflict.id) return;
        conflictAttempts++;
        throw new Error(`Settlement conflict for match ${matchId}.`);
      },
    });
    await matches.submitScore(conflict.a, terminalPayload(conflict.id));
    await matches.submitScore(conflict.b, terminalPayload(conflict.id, 1));
    await new Promise((resolve) => setTimeout(resolve, 80));
    check("permanent settlement conflict is not retried", conflictAttempts === 1);
    check("permanent failure clears in-memory retry state", !matches.getActiveMatchesSummary().some((m) => m.matchId === conflict.id));
    check("permanent failure creates no settlement", !(await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, conflict.id) })));

    const exhaustA = await user("exhaust_a", 50);
    const exhaustB = await user("exhaust_b", 50);
    const exhaust = await create("retry_exhaust", exhaustA, exhaustB, 50);
    let exhaustAttempts = 0;
    matches.configureTerminalResolutionRetryForTests({
      retryDelayMs: 20,
      failureInjector: (matchId) => {
        if (matchId !== exhaust.id) return;
        exhaustAttempts++;
        throw Object.assign(new Error("simulated serialization failure"), { code: "40001" });
      },
    });
    await matches.submitScore(exhaust.a, terminalPayload(exhaust.id));
    await matches.submitScore(exhaust.b, terminalPayload(exhaust.id, 1));
    check(
      "repeated transient failure stops at retry limit",
      await waitUntil(() => exhaustAttempts === matches.MAX_TERMINAL_RESOLUTION_ATTEMPTS),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    check("retry exhaustion leaves no dangling timer", exhaustAttempts === matches.MAX_TERMINAL_RESOLUTION_ATTEMPTS && !matches.getActiveMatchesSummary().some((m) => m.matchId === exhaust.id));
    check("retry exhaustion creates no duplicate financial effects", !(await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, exhaust.id) })) && (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_payout:${exhaust.id}`))).length === 0);
    matches.configureTerminalResolutionRetryForTests({});

    const currencyA = await user("currency_a", 0, 20);
    const currencyB = await user("currency_b", 0, 20);
    const diamonds = await create("diamonds", currencyA, currencyB, 10, "DIAMONDS");
    check("currency isolation preserves COINS", (await ledger.getBalances(currencyA)).coins === 0);
    check("currency isolation debits DIAMONDS only", diamonds.result === diamonds.id && (await ledger.getBalances(currencyA)).diamonds === 10);

    const freeA = await user("free_a", 0);
    const freeB = await user("free_b", 0);
    const free = await create("free", freeA, freeB, 0);
    check("free match remains unaffected", free.result === free.id && free.a.emitted.some((e) => e.event === "matched"));
    check("free match creates no escrow", (await db.select().from(ledgerEntries).where(eq(ledgerEntries.reason, `stake_escrow:${free.id}`))).length === 0);
  } finally {
    await db.delete(matchSettlements).where(inArray(matchSettlements.matchId, matchIds));
    await db.delete(matchesHistory).where(inArray(matchesHistory.id, matchIds));
    await db.delete(ledgerEntries).where(inArray(ledgerEntries.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
    await pool.end();
  }

  console.log(`${passes} passed, ${failures} failed`);
  process.exitCode = failures === 0 ? 0 : 1;
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
