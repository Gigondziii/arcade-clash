import { SIGNUP_COIN_GRANT, type WalletBalances } from "@arcadeclash/shared";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { ledgerEntries } from "../db/schema";

export async function getBalances(userId: string): Promise<WalletBalances> {
  const rows = await db
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

async function hasReason(userId: string, reason: string): Promise<boolean> {
  const existing = await db.query.ledgerEntries.findFirst({
    where: and(eq(ledgerEntries.userId, userId), eq(ledgerEntries.reason, reason)),
  });
  return Boolean(existing);
}

// Idempotent: 10 COINS once per user. Diamonds stay at 0 until a purchase.
// Also used on login/me so accounts created before the wallet shipped get
// the same one-time grant without farming every login.
export async function ensureSignupGrant(userId: string): Promise<WalletBalances> {
  if (!(await hasReason(userId, "signup_grant"))) {
    await db.insert(ledgerEntries).values({
      id: randomUUID(),
      userId,
      currency: "COINS",
      amount: SIGNUP_COIN_GRANT,
      reason: "signup_grant",
    });
  }
  return getBalances(userId);
}

export async function grantDiamondsStub(userId: string, diamonds: number, packId: string): Promise<WalletBalances> {
  if (!Number.isInteger(diamonds) || diamonds <= 0) {
    throw new Error("Diamond grant must be a positive integer.");
  }
  await db.insert(ledgerEntries).values({
    id: randomUUID(),
    userId,
    currency: "DIAMONDS",
    amount: diamonds,
    reason: `diamond_purchase_stub:${packId}`,
  });
  return getBalances(userId);
}
