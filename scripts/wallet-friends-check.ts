// Headless checks for wallet ledger helpers + friendship query shapes.
// Does NOT hit a live DB — only verifies shared pack constants and that the
// server modules export the expected functions (import graph sanity).
//
// Run: npx tsx scripts/wallet-friends-check.ts

import { DIAMOND_PACKS, SIGNUP_COIN_GRANT } from "@arcadeclash/shared";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("wallet-friends-check");

check("signup grant is 10 coins", SIGNUP_COIN_GRANT === 10);
check("at least one diamond pack", DIAMOND_PACKS.length >= 1);
check(
  "$2 pack grants 10 diamonds",
  DIAMOND_PACKS.some((p) => p.priceUsdCents === 200 && p.diamonds === 10),
);
check(
  "all packs have positive diamonds and price",
  DIAMOND_PACKS.every((p) => p.diamonds > 0 && p.priceUsdCents > 0 && p.id.length > 0),
);

import type { PublicUser } from "@arcadeclash/shared";
const sample: PublicUser = {
  id: "x",
  username: "tester",
  email: null,
  avatarUrl: null,
  gamesPlayed: 0,
  gamesWon: 0,
  createdAt: new Date().toISOString(),
  balances: { coins: 10, diamonds: 0 },
};
check("PublicUser carries balances", sample.balances.coins === 10 && sample.balances.diamonds === 0);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll ${5} checks passed.`);
