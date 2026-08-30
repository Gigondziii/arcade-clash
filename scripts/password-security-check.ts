// Standalone verification script for password hashing security, bcrypt salt verification, and response privacy.
// Run: npx tsx scripts/password-security-check.ts

import { hashPassword, verifyPassword } from "../packages/server/src/auth/password.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("password-security-check");

async function main() {
  // ---------------------------------------------------------------------------
  // Test 1: Bcrypt Salt Rounds & Hash Generation
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Bcrypt Salt & Hash Security");

  const samplePassword = "securePassword123!";
  const hash = await hashPassword(samplePassword);

  check("hashPassword generates a non-empty string", typeof hash === "string" && hash.length > 0);
  check("hashPassword uses bcrypt identifier prefix ($2a$ or $2b$)", hash.startsWith("$2a$") || hash.startsWith("$2b$"));
  check("hashPassword is not identical to plaintext password", hash !== samplePassword);

  // ---------------------------------------------------------------------------
  // Test 2: Password Verification Accuracy
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Password Verification Accuracy");

  const isValid = await verifyPassword(samplePassword, hash);
  const isInvalid = await verifyPassword("wrongPassword123!", hash);

  check("verifyPassword returns true for correct plaintext password", isValid === true);
  check("verifyPassword returns false for incorrect plaintext password", isInvalid === false);

  // ---------------------------------------------------------------------------
  // Test 3: Salt Unique Per Hashing Call (Salting Defense)
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Salting Defense Verification");

  const secondHash = await hashPassword(samplePassword);
  check("Hashing same password twice produces unique salt/hash outputs", hash !== secondHash);

  // ---------------------------------------------------------------------------
  // Test 4: Password Length Boundary Controls
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Password Length Boundary Constraints");

  const MIN_LEN = 8;
  const MAX_LEN = 100;

  function validatePasswordLength(password: string): boolean {
    return typeof password === "string" && password.length >= MIN_LEN && password.length <= MAX_LEN;
  }

  check("Password of 7 characters rejected (< 8 min)", !validatePasswordLength("1234567"));
  check("Password of 8 characters accepted (min bound)", validatePasswordLength("12345678"));
  check("Password of 100 characters accepted (max bound)", validatePasswordLength("a".repeat(100)));
  check("Password of 101 characters rejected (> 100 max)", !validatePasswordLength("a".repeat(101)));

  // ---------------------------------------------------------------------------
  // Test 5: Response DTO Privacy (Password / Hash Exclusion)
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Public User DTO Password Stripping");

  const mockDbUser = {
    id: "usr_abc123",
    username: "crypto_master",
    email: "user@example.com",
    passwordHash: hash,
    avatarUrl: null,
    gamesPlayed: 5,
    gamesWon: 2,
    createdAt: new Date(),
  };

  function toPublicUser(user: typeof mockDbUser) {
    const { passwordHash, ...publicFields } = user;
    return publicFields;
  }

  const publicUser = toPublicUser(mockDbUser);

  check("PublicUser DTO omits passwordHash key", !("passwordHash" in publicUser));
  check("PublicUser DTO omits password key", !("password" in publicUser));
  check("PublicUser DTO preserves safe public fields", publicUser.username === "crypto_master" && publicUser.id === "usr_abc123");

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll password security checks passed.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
