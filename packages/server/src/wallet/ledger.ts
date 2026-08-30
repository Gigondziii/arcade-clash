import { SIGNUP_COIN_GRANT, type Currency, type WalletBalances } from "@fugluck/shared";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { ledgerEntries, matchSettlements } from "../db/schema";

export const PLATFORM_RAKE_ACCOUNT = "platform_rake_account";
export const DEFAULT_RAKE_PERCENT = 10;
export const COINS_RAKE_PERCENT = 0;
export const DIAMONDS_RAKE_PERCENT = 5;

export type DbClientOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Every ledger mutation is serialized per user by the database migration's
// ledger_non_negative_guard trigger. Taking the same lock explicitly here
// also makes the invariant visible in application code and lets a caller lock
// both match participants in a deterministic order before checking either
// balance. hashtext is stable inside PostgreSQL and the two-int form
// keeps these locks in a Fugluck-specific namespace.
export async function lockWalletUsers(client: DbClientOrTx, userIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(userIds)].sort();
  for (const userId of uniqueIds) {
    await client.execute(sql`select pg_advisory_xact_lock(1094927180, hashtext(${userId}))`);
  }
}

let tableEnsured = false;
export async function ensureMatchSettlementsTable() {
  if (tableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS match_settlements (
        match_id text PRIMARY KEY,
        status varchar(16) NOT NULL,
        winner_id text,
        loser_id text,
        currency varchar(16) NOT NULL,
        stake integer NOT NULL DEFAULT 0,
        winner_payout integer NOT NULL DEFAULT 0,
        rake_fee integer NOT NULL DEFAULT 0,
        settled_at timestamp with time zone NOT NULL DEFAULT NOW()
      );
    `);
    tableEnsured = true;
  } catch {
    // Table may already exist
  }
}

export async function getBalances(userId: string, client: DbClientOrTx = db): Promise<WalletBalances> {
  const rows = await client
    .select({
      currency: ledgerEntries.currency,
      total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId))
    .groupBy(ledgerEntries.currency);

  let coins = 0;
  let diamonds = 0;
  for (const row of rows) {
    if (row.currency === "COINS") coins = Number(row.total);
    if (row.currency === "DIAMONDS") diamonds = Number(row.total);
  }
  return { coins, diamonds };
}

async function hasReason(userId: string, reason: string, client: DbClientOrTx = db): Promise<boolean> {
  const existing = await client.query.ledgerEntries.findFirst({
    where: and(eq(ledgerEntries.userId, userId), eq(ledgerEntries.reason, reason)),
  });
  return Boolean(existing);
}

function validateCurrency(currency: string): asserts currency is Currency {
  if (currency !== "COINS" && currency !== "DIAMONDS") {
    throw new Error(`Invalid currency: ${currency}. Must be COINS or DIAMONDS.`);
  }
}

function validatePositiveInteger(amount: number, label: string): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

// Evaluates and applies the monthly 1,000 COIN allowance refill on login/me.
// Tops off balances under 1,000 COINS up to 1,000 COINS; balances >= 1,000 are left untouched.
export async function checkAndApplyMonthlyAllowance(userId: string): Promise<WalletBalances> {
  const monthKey = new Date().toISOString().slice(0, 7);
  const reason = `monthly_allowance_refill:${monthKey}`;

  return await db.transaction(async (tx) => {
    if (!(await hasReason(userId, reason, tx))) {
      const balances = await getBalances(userId, tx);
      if (balances.coins < 1000) {
        const topUp = 1000 - balances.coins;
        await tx
          .insert(ledgerEntries)
          .values({
            id: randomUUID(),
            userId,
            currency: "COINS",
            amount: topUp,
            reason,
          })
          .onConflictDoNothing();
      } else {
        await tx
          .insert(ledgerEntries)
          .values({
            id: randomUUID(),
            userId,
            currency: "COINS",
            amount: 0,
            reason,
          })
          .onConflictDoNothing();
      }
    }
    return getBalances(userId, tx);
  });
}

// Idempotent: 1,000 COINS starting grant once per user + monthly 1,000 COIN refill check.
export async function ensureSignupGrant(userId: string): Promise<WalletBalances> {
  await db.transaction(async (tx) => {
    if (!(await hasReason(userId, "signup_grant", tx))) {
      await tx
        .insert(ledgerEntries)
        .values({
          id: randomUUID(),
          userId,
          currency: "COINS",
          amount: SIGNUP_COIN_GRANT,
          reason: "signup_grant",
        })
        .onConflictDoNothing();
    }
  });
  return checkAndApplyMonthlyAllowance(userId);
}

export async function grantDiamondsStub(userId: string, diamonds: number, packId: string): Promise<WalletBalances> {
  validatePositiveInteger(diamonds, "Diamond grant");
  return await db.transaction(async (tx) => {
    await tx
      .insert(ledgerEntries)
      .values({
        id: randomUUID(),
        userId,
        currency: "DIAMONDS",
        amount: diamonds,
        reason: `diamond_purchase_stub:${packId}`,
      })
      .onConflictDoNothing();
    return getBalances(userId, tx);
  });
}

export async function escrowStake(
  userId: string,
  currency: Currency,
  amount: number,
  matchId: string,
): Promise<WalletBalances> {
  validatePositiveInteger(amount, "Stake amount");
  validateCurrency(currency);

  return await db.transaction(async (tx) => {
    const reason = `stake_escrow:${matchId}`;
    
    if (await hasReason(userId, reason, tx)) {
      return getBalances(userId, tx);
    }

    const balances = await getBalances(userId, tx);
    const currentBalance = currency === "COINS" ? balances.coins : balances.diamonds;
    if (currentBalance < amount) {
      throw new Error(`Insufficient ${currency} balance for escrow.`);
    }

    await tx
      .insert(ledgerEntries)
      .values({
        id: randomUUID(),
        userId,
        currency,
        amount: -amount,
        reason,
      })
      .onConflictDoNothing();

    return getBalances(userId, tx);
  });
}

export async function escrowMatchStakes(
  client: DbClientOrTx,
  player1Id: string,
  player2Id: string,
  currency: Currency,
  amount: number,
  matchId: string,
): Promise<{ player1Balances: WalletBalances; player2Balances: WalletBalances; alreadyEscrowed: boolean }> {
  validatePositiveInteger(amount, "Stake amount");
  validateCurrency(currency);
  if (player1Id === player2Id) throw new Error("A player cannot escrow both sides of a match.");

  await lockWalletUsers(client, [player1Id, player2Id]);

  const reason = `stake_escrow:${matchId}`;
  const p1Existing = await hasReason(player1Id, reason, client);
  const p2Existing = await hasReason(player2Id, reason, client);
  if (p1Existing !== p2Existing) {
    throw new Error(`Partial escrow invariant violation for match ${matchId}.`);
  }
  if (p1Existing && p2Existing) {
    return {
      player1Balances: await getBalances(player1Id, client),
      player2Balances: await getBalances(player2Id, client),
      alreadyEscrowed: true,
    };
  }

  const [p1BalancesBefore, p2BalancesBefore] = await Promise.all([
    getBalances(player1Id, client),
    getBalances(player2Id, client),
  ]);
  const p1Available = currency === "COINS" ? p1BalancesBefore.coins : p1BalancesBefore.diamonds;
  const p2Available = currency === "COINS" ? p2BalancesBefore.coins : p2BalancesBefore.diamonds;
  if (p1Available < amount) throw new Error(`Player 1 has insufficient ${currency} balance for escrow.`);
  if (p2Available < amount) throw new Error(`Player 2 has insufficient ${currency} balance for escrow.`);

  await client.insert(ledgerEntries).values([
    { id: randomUUID(), userId: player1Id, currency, amount: -amount, reason },
    { id: randomUUID(), userId: player2Id, currency, amount: -amount, reason },
  ]);

  return {
    player1Balances: await getBalances(player1Id, client),
    player2Balances: await getBalances(player2Id, client),
    alreadyEscrowed: false,
  };
}

export async function payoutWinner(
  winnerUserId: string,
  loserUserId: string,
  currency: Currency,
  stakeAmount: number,
  matchId: string,
  rakePercent?: number,
): Promise<{ winnerBalances: WalletBalances; rakeFee: number; winnerPayout: number; alreadySettled: boolean }> {
  validatePositiveInteger(stakeAmount, "Stake amount");
  validateCurrency(currency);
  await ensureMatchSettlementsTable();

  const effectiveRake =
    rakePercent !== undefined
      ? rakePercent
      : currency === "COINS"
      ? COINS_RAKE_PERCENT
      : DIAMONDS_RAKE_PERCENT;

  return await db.transaction(async (tx) =>
    payoutWinnerInTransaction(tx, winnerUserId, loserUserId, currency, stakeAmount, matchId, effectiveRake),
  );
}

export async function payoutWinnerInTransaction(
  client: DbClientOrTx,
  winnerUserId: string,
  loserUserId: string,
  currency: Currency,
  stakeAmount: number,
  matchId: string,
  rakePercent?: number,
): Promise<{ winnerBalances: WalletBalances; rakeFee: number; winnerPayout: number; alreadySettled: boolean }> {
  validatePositiveInteger(stakeAmount, "Stake amount");
  validateCurrency(currency);
  const effectiveRake =
    rakePercent !== undefined ? rakePercent : currency === "COINS" ? COINS_RAKE_PERCENT : DIAMONDS_RAKE_PERCENT;
  const totalPot = stakeAmount * 2;
  const rakeFee = Math.floor((totalPot * effectiveRake) / 100);
  const winnerPayout = totalPot - rakeFee;

  await lockWalletUsers(client, [winnerUserId, loserUserId, ...(rakeFee > 0 ? [PLATFORM_RAKE_ACCOUNT] : [])]);

  const existingSettlement = await client.query.matchSettlements.findFirst({
    where: eq(matchSettlements.matchId, matchId),
  });

  if (existingSettlement) {
    console.warn(`[ledger] IDEMPOTENT NO-OP: Match ${matchId} has already been settled or voided in database.`);
    if (
      existingSettlement.status !== "PAYOUT" ||
      existingSettlement.winnerId !== winnerUserId ||
      existingSettlement.loserId !== loserUserId ||
      existingSettlement.currency !== currency ||
      existingSettlement.stake !== stakeAmount ||
      existingSettlement.winnerPayout !== winnerPayout ||
      existingSettlement.rakeFee !== rakeFee
    ) {
      throw new Error(`Settlement conflict for match ${matchId}.`);
    }
    const winnerBalances = await getBalances(winnerUserId, client);
    return {
      winnerBalances,
      rakeFee: existingSettlement.rakeFee ?? rakeFee,
      winnerPayout: existingSettlement.winnerPayout ?? winnerPayout,
      alreadySettled: true,
    };
  }

  await client.insert(matchSettlements).values({
    matchId,
    status: "PAYOUT",
    winnerId: winnerUserId,
    loserId: loserUserId,
    currency,
    stake: stakeAmount,
    winnerPayout,
    rakeFee,
  });

  const winnerReason = `stake_payout:${matchId}`;
  await client.insert(ledgerEntries).values({
    id: randomUUID(),
    userId: winnerUserId,
    currency,
    amount: winnerPayout,
    reason: winnerReason,
  });

  if (rakeFee > 0) {
    const rakeReason = `platform_rake:${matchId}`;
    await client.insert(ledgerEntries).values({
      id: randomUUID(),
      userId: PLATFORM_RAKE_ACCOUNT,
      currency,
      amount: rakeFee,
      reason: rakeReason,
    });
  }

  const winnerBalances = await getBalances(winnerUserId, client);
  return { winnerBalances, rakeFee, winnerPayout, alreadySettled: false };
}

export async function refundMatchSettlement(
  player1Id: string,
  player2Id: string | null,
  currency: Currency,
  stakeAmount: number,
  matchId: string,
  status: "REFUND" | "DRAW" | "VOIDED" = "REFUND",
): Promise<{ p1Balances: WalletBalances; p2Balances: WalletBalances | null; alreadySettled: boolean }> {
  validatePositiveInteger(stakeAmount, "Refund amount");
  validateCurrency(currency);
  await ensureMatchSettlementsTable();

  return await db.transaction(async (tx) =>
    refundMatchSettlementInTransaction(tx, player1Id, player2Id, currency, stakeAmount, matchId, status),
  );
}

export async function refundMatchSettlementInTransaction(
  client: DbClientOrTx,
  player1Id: string,
  player2Id: string | null,
  currency: Currency,
  stakeAmount: number,
  matchId: string,
  status: "REFUND" | "DRAW" | "VOIDED" = "REFUND",
): Promise<{ p1Balances: WalletBalances; p2Balances: WalletBalances | null; alreadySettled: boolean }> {
  validatePositiveInteger(stakeAmount, "Refund amount");
  validateCurrency(currency);
  await lockWalletUsers(client, [player1Id, ...(player2Id ? [player2Id] : [])]);

  const existingSettlement = await client.query.matchSettlements.findFirst({
    where: eq(matchSettlements.matchId, matchId),
  });

  if (existingSettlement) {
    console.warn(`[ledger] IDEMPOTENT NO-OP: Match ${matchId} has already been settled or voided in database.`);
    if (
      existingSettlement.status !== status ||
      existingSettlement.currency !== currency ||
      existingSettlement.stake !== stakeAmount ||
      existingSettlement.winnerId !== null ||
      existingSettlement.loserId !== null
    ) {
      throw new Error(`Settlement conflict for match ${matchId}.`);
    }
    const p1Balances = await getBalances(player1Id, client);
    const p2Balances = player2Id ? await getBalances(player2Id, client) : null;
    return { p1Balances, p2Balances, alreadySettled: true };
  }

  await client.insert(matchSettlements).values({
    matchId,
    status,
    currency,
    stake: stakeAmount,
  });

  const p1Reason = `stake_refund:${matchId}`;
  await client.insert(ledgerEntries).values({
    id: randomUUID(),
    userId: player1Id,
    currency,
    amount: stakeAmount,
    reason: p1Reason,
  });

  if (player2Id && player2Id !== player1Id) {
    const p2Reason = `stake_refund:${matchId}`;
    await client.insert(ledgerEntries).values({
      id: randomUUID(),
      userId: player2Id,
      currency,
      amount: stakeAmount,
      reason: p2Reason,
    });
  }

  const p1Balances = await getBalances(player1Id, client);
  const p2Balances = player2Id ? await getBalances(player2Id, client) : null;
  return { p1Balances, p2Balances, alreadySettled: false };
}

export async function refundStake(
  userId: string,
  currency: Currency,
  amount: number,
  matchId: string,
): Promise<WalletBalances & { alreadySettled: boolean }> {
  const { p1Balances, alreadySettled } = await refundMatchSettlement(userId, null, currency, amount, matchId, "REFUND");
  return { ...p1Balances, alreadySettled };
}
