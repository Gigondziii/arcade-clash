// Regression & Security Test Suite for Owner/Admin Password Reset Recovery Tool.
// Run: npx tsx scripts/admin-reset-recovery-check.ts

import "./require-disposable-test-database.ts";

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "dev_secret_for_standalone_test_verification_32bytes";

import { eq } from "drizzle-orm";
import { db } from "../packages/server/src/db/client.ts";
import { users, passwordResetTokens } from "../packages/server/src/db/schema.ts";
import { hashPassword, verifyPassword } from "../packages/server/src/auth/password.ts";
import { resetOwnerAdminPassword } from "./reset-owner-admin-password.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("admin-reset-recovery-check");

async function main() {
  const testAdminId = `usr_test_admin_${Date.now()}`;
  const testUserId = `usr_test_user_${Date.now()}`;
  const initialHash = await hashPassword("InitialPass123!");

  // Seed test accounts in disposable test database
  await db.insert(users).values([
    {
      id: testAdminId,
      username: `admin_${Date.now()}`,
      email: `admin_${Date.now()}@test.fugluck.com`,
      passwordHash: initialHash,
      role: "OWNER",
      status: "active",
    },
    {
      id: testUserId,
      username: `standard_${Date.now()}`,
      email: `user_${Date.now()}@test.fugluck.com`,
      passwordHash: initialHash,
      role: "user",
      status: "active",
    },
  ]);

  const targetAdmin = await db.query.users.findFirst({ where: eq(users.id, testAdminId) });
  const targetStandardUser = await db.query.users.findFirst({ where: eq(users.id, testUserId) });

  if (!targetAdmin || !targetStandardUser) {
    throw new Error("Failed to seed test users");
  }

  // ---------------------------------------------------------------------------
  // Test 1: Unknown account rejection
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Unknown Account Rejection");
  let unknownErr = "";
  try {
    await resetOwnerAdminPassword("non_existent_user_9999", "NewSecurePassword2026!");
  } catch (err: any) {
    unknownErr = err.message;
  }
  check("Unknown user identifier is rejected", unknownErr.includes("Target account not found"));

  // ---------------------------------------------------------------------------
  // Test 2: Non-admin account rejection
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Non-Admin Account Rejection");
  let nonAdminErr = "";
  try {
    await resetOwnerAdminPassword(targetStandardUser.username, "NewSecurePassword2026!");
  } catch (err: any) {
    nonAdminErr = err.message;
  }
  check("Non-admin role ('user') is rejected from admin recovery", nonAdminErr.includes("not an authorized administrator role"));

  // ---------------------------------------------------------------------------
  // Test 3: Weak password rejection (password policy enforcement)
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Weak Password Rejection (Policy Compliance)");
  let weakPassErr = "";
  try {
    await resetOwnerAdminPassword(targetAdmin.username, "short");
  } catch (err: any) {
    weakPassErr = err.message;
  }
  check("Short password (< 8 chars) is rejected", weakPassErr.includes("Password policy violation"));

  let commonPassErr = "";
  try {
    await resetOwnerAdminPassword(targetAdmin.username, "password123");
  } catch (err: any) {
    commonPassErr = err.message;
  }
  check("Common breached password is rejected", commonPassErr.includes("Password policy violation"));

  // ---------------------------------------------------------------------------
  // Test 4: Successful Owner Password Reset
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Authorized Owner/Admin Password Reset");
  const newSecretPass = "FreshSecureAdminPass2026!#";
  const result = await resetOwnerAdminPassword(targetAdmin.username, newSecretPass);

  check("Reset returns success=true", result.success === true);
  check("Reset reports correct username", result.username === targetAdmin.username);
  check("Reset reports OWNER role", result.role === "OWNER");

  // Verify updated record in DB
  const updatedAdmin = await db.query.users.findFirst({ where: eq(users.id, testAdminId) });
  check("Old password no longer verifies", !(await verifyPassword("InitialPass123!", updatedAdmin!.passwordHash)));
  check("New password successfully verifies with bcrypt", await verifyPassword(newSecretPass, updatedAdmin!.passwordHash));

  // ---------------------------------------------------------------------------
  // Test 5: Standard user remains untouched
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Unrelated Accounts Remain Untouched");
  const checkStandardUser = await db.query.users.findFirst({ where: eq(users.id, testUserId) });
  check("Standard user password hash was NOT modified", checkStandardUser!.passwordHash === initialHash);

  // ---------------------------------------------------------------------------
  // Test 6: Invalidation of Pending Password Reset Tokens
  // ---------------------------------------------------------------------------
  console.log("\nTest 6: Invalidation of Pending Reset Tokens");
  await db.insert(passwordResetTokens).values({
    id: `prt_test_${Date.now()}`,
    userId: testAdminId,
    tokenHash: "sample_token_hash_abc",
    expiresAt: new Date(Date.now() + 3600000),
  });

  await resetOwnerAdminPassword(targetAdmin.username, "AnotherValidPass2026!");
  const remainingTokens = await db.query.passwordResetTokens.findMany({
    where: eq(passwordResetTokens.userId, testAdminId),
  });
  check("Prior password reset tokens are invalidated on password reset", remainingTokens.length === 0);

  // Cleanup
  await db.delete(users).where(eq(users.id, testAdminId));
  await db.delete(users).where(eq(users.id, testUserId));

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll admin reset recovery checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
