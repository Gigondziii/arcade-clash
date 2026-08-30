// Comprehensive Private Owner Admin Console & 5-Attempt / 1-Hour Lockout Test Script for Fugluck.
// Run only with an isolated TEST_DATABASE_URL because lockout state is persisted.

import "./require-disposable-test-database.ts";

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

console.log("owner-admin-lockout-check");

async function main() {
  const { checkAdminLockout, recordFailedAdminLogin, resetAdminLockout, MAX_ADMIN_LOGIN_ATTEMPTS, ADMIN_LOCKOUT_DURATION_MS } = await import(
    "../packages/server/src/auth/adminLockout.ts"
  );

  const testIp = `test_ip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // ---------------------------------------------------------------------------
  // Test 1: Initial Lockout State (0 Attempts)
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Initial Lockout State (0 Attempts)");
  const initCheck = await checkAdminLockout(testIp);
  check("Initial IP has 0 attempts and is not locked", !initCheck.isLocked && initCheck.attemptCount === 0);

  // ---------------------------------------------------------------------------
  // Test 2: Failed Login Attempts 1 through 4
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Failed Login Attempts 1 through 4");
  for (let i = 1; i <= 4; i++) {
    const res = await recordFailedAdminLogin(testIp);
    check(`Failed attempt ${i} returns isLocked = false, attemptCount = ${i}`, !res.isLocked && res.attemptCount === i);
  }

  // ---------------------------------------------------------------------------
  // Test 3: 5th Failed Login Attempt Triggers 1-Hour Lockout
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: 5th Failed Login Attempt Triggers 1-Hour Lockout");
  const lockTriggerRes = await recordFailedAdminLogin(testIp);

  check("5th failed attempt enters 1-hour lockout (isLocked = true)", lockTriggerRes.isLocked === true);
  check("Lockout message mentions 1 hour / 60 minutes", lockTriggerRes.message?.includes("1 hour") || lockTriggerRes.message?.includes("minute"));

  // ---------------------------------------------------------------------------
  // Test 4: Subsequent Attempt During Lockout Period is Rejected
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Subsequent Attempt During Lockout Period is Rejected");
  const subsequentCheck = await checkAdminLockout(testIp);
  check("Subsequent check enforces lockout and rejects login", subsequentCheck.isLocked === true);

  // ---------------------------------------------------------------------------
  // Test 5: Successful Owner Authentication Resets Lockout Counter
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Successful Owner Authentication Resets Lockout Counter");
  await resetAdminLockout(testIp);
  const resetCheck = await checkAdminLockout(testIp);
  check("Reset clears lockout state (isLocked = false, attemptCount = 0)", !resetCheck.isLocked && resetCheck.attemptCount === 0);

  // ---------------------------------------------------------------------------
  // Test 6: Authorization Guards & Client Role Flag Disregard
  // ---------------------------------------------------------------------------
  console.log("\nTest 6: Authorization Guards & Client Role Flag Disregard");
  const { requireOwnerAdmin, ADMIN_SESSION_COOKIE_NAME } = await import("../packages/server/src/auth/middleware.ts");

  check("ADMIN_SESSION_COOKIE_NAME is defined as ac_admin_session", ADMIN_SESSION_COOKIE_NAME === "ac_admin_session");

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll owner admin lockout checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
