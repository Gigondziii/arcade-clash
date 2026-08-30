// Comprehensive Password Policy Audit & Verification Script for Fugluck.
// Run: npx tsx scripts/password-policy-check.ts

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("password-policy-check");

async function main() {
  const { validatePasswordPolicy } = await import("../packages/server/src/auth/password.ts");

  // ---------------------------------------------------------------------------
  // Test 1: Password Length Minimum & Maximum Boundaries
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Password Length Minimum & Maximum Boundaries");

  const shortPass = validatePasswordPolicy("pass1");
  check("Short password (<8 chars) rejected", !shortPass.valid && shortPass.error?.includes("at least 8 characters"));

  const minBoundPass = validatePasswordPolicy("12345678_ok");
  check("Valid min length password (>=8 chars) accepted", minBoundPass.valid);

  const longPass = validatePasswordPolicy("a".repeat(129));
  check("Oversized password (>128 chars) rejected", !longPass.valid && longPass.error?.includes("not exceed 128"));

  // ---------------------------------------------------------------------------
  // Test 2: Common & Breached Password Blocklist Rejection
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Common & Breached Password Blocklist Rejection");

  const commonList = ["password", "password123", "12345678", "123456789", "qwertyuiop", "admin12345", "arcadeclash", "fugluck123", "letmein123"];

  for (const common of commonList) {
    const res = validatePasswordPolicy(common);
    check(`Common password [${common}] rejected`, !res.valid && res.error?.includes("too common or easily guessable"));
  }

  // ---------------------------------------------------------------------------
  // Test 3: Repetitive & Sequential Pattern Rejection
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Repetitive & Sequential Pattern Rejection");

  const repPass = validatePasswordPolicy("aaaaaaaaaa");
  check("Repetitive single-character password [aaaaaaaaaa] rejected", !repPass.valid && repPass.error?.includes("single repeating character"));

  const seqPass = validatePasswordPolicy("123456789");
  check("Sequential numeric pattern [123456789] rejected", !seqPass.valid);

  // ---------------------------------------------------------------------------
  // Test 4: Strong Passwords & Long Passphrases Acceptance
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Strong Passwords & Long Passphrases Acceptance");

  const strongList = [
    "correct-horse-battery-staple-99",
    "fugluck_champion_2026!",
    "Str0ngP@ssw0rd!2026_Secure",
    "my-long-randomized-passphrase-is-very-secure",
  ];

  for (const strong of strongList) {
    const res = validatePasswordPolicy(strong);
    check(`Strong password/passphrase accepted`, res.valid);
  }

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll password policy checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
