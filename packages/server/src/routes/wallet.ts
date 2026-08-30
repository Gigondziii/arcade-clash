import { DIAMOND_PACKS } from "@fugluck/shared";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { ledgerEntries } from "../db/schema";
import { ensureSignupGrant, getBalances, grantDiamondsStub } from "../wallet/ledger";

import { createRateLimiterMiddleware } from "../utils/rateLimiter";

const walletMutationLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: "Too many transaction attempts. Please wait a moment.",
});

export function formatReasonLabel(reason: string, amount: number): string {
  if (reason.startsWith("signup_grant")) return "Signup Grant";
  if (reason.startsWith("monthly_allowance_refill")) return "Monthly Allowance Refill";
  if (reason.startsWith("stake_escrow")) return "Wager Escrow";
  if (reason.startsWith("stake_payout")) return "Match Payout (Victory)";
  if (reason.startsWith("stake_refund")) return "Match Refund";
  if (reason.startsWith("diamond_pack_grant") || reason.startsWith("diamond_purchase_stub")) return "Diamond Pack Purchase";
  if (reason.startsWith("admin_grant")) return "Admin Grant";
  if (reason.startsWith("admin_adjustment")) return "Admin Adjustment";
  return amount >= 0 ? "Wallet Credit" : "Wallet Debit";
}

export const walletRouter = Router();

walletRouter.use(attachSession, requireAuth);

walletRouter.get("/balances", async (req, res) => {
  // ensureSignupGrant so pre-wallet accounts still get the one-time 10 coins.
  const balances = await ensureSignupGrant(req.userId!);
  res.json({ balances });
});

walletRouter.get("/history", async (req, res) => {
  const userId = req.userId!;
  const entries = await db.query.ledgerEntries.findMany({
    where: eq(ledgerEntries.userId, userId),
    orderBy: [desc(ledgerEntries.createdAt)],
    limit: 50,
  });

  const formatted = entries.map((e) => ({
    id: e.id,
    currency: e.currency,
    amount: e.amount,
    reason: e.reason,
    label: formatReasonLabel(e.reason, e.amount),
    createdAt: e.createdAt.toISOString(),
  }));

  res.json({ history: formatted });
});

walletRouter.get("/packs", (_req, res) => {
  res.json({ packs: DIAMOND_PACKS });
});

function isDevDiamondStubAllowed(): boolean {
  if (process.env.ENABLE_DEV_DIAMOND_STUB === "true") return true;
  if (process.env.ENABLE_DEV_DIAMOND_STUB === "false") return false;
  return process.env.NODE_ENV !== "production";
}

// Development Sandbox stub purchase — no real payment processor. Grants diamonds
// in dev/sandbox environments so the dual-currency UI and match staking can be tested.
// Gated off in production/staging unless explicitly enabled via ENABLE_DEV_DIAMOND_STUB=true.
const handleDiamondPurchaseStub = async (req: import("express").Request, res: import("express").Response) => {
  if (!isDevDiamondStubAllowed()) {
    res.status(403).json({ error: "Diamond purchases are disabled in this environment." });
    return;
  }

  const packId = req.body?.packId;
  if (typeof packId !== "string") {
    res.status(400).json({ error: "packId is required." });
    return;
  }
  const pack = DIAMOND_PACKS.find((p) => p.id === packId);
  if (!pack) {
    res.status(404).json({ error: "Unknown diamond pack." });
    return;
  }

  await ensureSignupGrant(req.userId!);
  const balances = await grantDiamondsStub(req.userId!, pack.diamonds, pack.id);
  res.json({ balances, granted: pack.diamonds, packId: pack.id, stub: true });
};

walletRouter.post("/purchase-diamonds", walletMutationLimiter, handleDiamondPurchaseStub);
walletRouter.post("/diamonds/stub-buy", walletMutationLimiter, handleDiamondPurchaseStub);

// Convenience re-export for callers that already have balances and just want
// a refresh without the grant side-effect — still idempotent via ensure.
walletRouter.get("/", async (req, res) => {
  const balances = await getBalances(req.userId!);
  res.json({ balances, packs: DIAMOND_PACKS });
});
