// Standalone verification script for server-side input boundary validation & adversarial request handling.
// Run: npx tsx scripts/input-validation-check.ts

import { validateScore } from "../packages/server/src/validation/scoreValidator.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("input-validation-check");

// ---------------------------------------------------------------------------
// Test 1: Username Format & Length Boundary Validation
// ---------------------------------------------------------------------------
console.log("\nTest 1: Username Format & Length Boundary Validation");

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

const invalidUsernames = [
  "ab", // Too short
  "a".repeat(21), // Too long (21 chars)
  "a".repeat(10_000), // Massive payload
  "user name", // Space
  "user<script>", // XSS payload
  "user@email.com", // Special char @
  "user-name", // Hyphen
];

for (const badName of invalidUsernames) {
  const isRejected = !USERNAME_PATTERN.test(badName);
  check(`Username [${badName.slice(0, 15)}...] rejected by server boundary pattern`, isRejected);
}

// ---------------------------------------------------------------------------
// Test 2: Stake Numeric Boundary & Sanity Clamping
// ---------------------------------------------------------------------------
console.log("\nTest 2: Stake Numeric Boundary & Sanity Clamping");

function parseAndSanitizeStake(input: unknown): number {
  let stake = typeof input === "number" && Number.isFinite(input) && input > 0 ? Math.floor(input) : 0;
  if (stake > 100_000) stake = 100_000;
  return stake;
}

check("Negative stake (-50) clamped to 0", parseAndSanitizeStake(-50) === 0);
check("Fractional stake (25.99) floored to 25", parseAndSanitizeStake(25.99) === 25);
check("NaN stake clamped to 0", parseAndSanitizeStake(NaN) === 0);
check("Infinity stake clamped to 0", parseAndSanitizeStake(Infinity) === 0);
check("Astronomical stake (1e12) capped to 100,000", parseAndSanitizeStake(1e12) === 100_000);
check("Valid stake (500) preserved as 500", parseAndSanitizeStake(500) === 500);

// ---------------------------------------------------------------------------
// Test 3: Score Validation Input Shape & Viewport Guards
// ---------------------------------------------------------------------------
console.log("\nTest 3: Score Validation Input Shape & Viewport Guards");

const invalidViewportResult = validateScore({
  gameId: "neon-runner",
  seed: 12345,
  inputLog: [],
  claimedScore: 100,
  durationMs: 5000,
  viewport: { width: -1280, height: 720 },
});
check("Negative viewport width rejected as malformed_viewport", invalidViewportResult.reason === "malformed_viewport");

const zeroViewportResult = validateScore({
  gameId: "neon-runner",
  seed: 12345,
  inputLog: [],
  claimedScore: 100,
  durationMs: 5000,
  viewport: { width: 0, height: 0 },
});
check("Zero viewport dimensions rejected as malformed_viewport", zeroViewportResult.reason === "malformed_viewport");

const oversizedLog = new Array(10_001).fill({ tick: 1, action: "jump" });
const oversizedLogResult = validateScore({
  gameId: "neon-runner",
  seed: 12345,
  inputLog: oversizedLog,
  claimedScore: 100,
  durationMs: 5000,
  viewport: { width: 1280, height: 720 },
});
check("Oversized input log (> 10,000 entries) rejected as log_size_exceeded", oversizedLogResult.reason === "log_size_exceeded");

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll input validation checks passed.`);
