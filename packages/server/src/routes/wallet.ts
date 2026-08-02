import { DIAMOND_PACKS } from "@arcadeclash/shared";
import { Router } from "express";
import { attachSession, requireAuth } from "../auth/middleware";
import { ensureSignupGrant, getBalances, grantDiamondsStub } from "../wallet/ledger";

export const walletRouter = Router();

walletRouter.use(attachSession, requireAuth);

walletRouter.get("/balances", async (req, res) => {
  // ensureSignupGrant so pre-wallet accounts still get the one-time 10 coins.
  const balances = await ensureSignupGrant(req.userId!);
  res.json({ balances });
});

walletRouter.get("/packs", (_req, res) => {
  res.json({ packs: DIAMOND_PACKS });
});

// Stub purchase — no Stripe yet. Grants diamonds immediately so the dual-
// currency UI and shop flow can be exercised end-to-end. Replace with a real
// payment webhook before any production money moves.
walletRouter.post("/purchase-diamonds", async (req, res) => {
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
});

// Convenience re-export for callers that already have balances and just want
// a refresh without the grant side-effect — still idempotent via ensure.
walletRouter.get("/", async (req, res) => {
  const balances = await getBalances(req.userId!);
  res.json({ balances, packs: DIAMOND_PACKS });
});
