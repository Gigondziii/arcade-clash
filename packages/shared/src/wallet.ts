// Dual-currency wallet types. Balances are derived from an append-only
// ledger on the server (see packages/server/src/wallet/ledger.ts) — never
// trusted from the client. COINS = free/play money (Fmoney); DIAMONDS =
// premium currency bought with real money (stub purchase for now).

export type Currency = "COINS" | "DIAMONDS";

export type WalletBalances = {
  coins: number;
  diamonds: number;
};

export type DiamondPack = {
  id: string;
  diamonds: number;
  // Display-only until Stripe is wired — amount the pack claims to cost.
  priceUsdCents: number;
  label: string;
};

export const DIAMOND_PACKS: DiamondPack[] = [
  { id: "pack_10", diamonds: 10, priceUsdCents: 200, label: "$2 → 10 diamonds" },
  { id: "pack_55", diamonds: 55, priceUsdCents: 1000, label: "$10 → 55 diamonds" },
  { id: "pack_120", diamonds: 120, priceUsdCents: 2000, label: "$20 → 120 diamonds" },
];

export const SIGNUP_COIN_GRANT = 1000;
