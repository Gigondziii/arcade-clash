import "./require-disposable-test-database.ts";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db } from "../packages/server/src/db/client.ts";
import { users } from "../packages/server/src/db/schema.ts";
import { verifyPassword } from "../packages/server/src/auth/password.ts";
import { seedOwnerAdmin } from "./seed-admin.ts";

async function runTests() {
  console.log("seed-admin-check\n");

  const testUser = `admin_test_${Date.now()}`;
  const strongPassword = "StrongAdminPassword2026!";

  console.log("Test 1: Weak Password Policy Rejection");
  await assert.rejects(
    async () => {
      await seedOwnerAdmin(testUser, "short");
    },
    (err: Error) => {
      assert(err.message.includes("Password policy violation"), "Must reject short password");
      return true;
    }
  );
  console.log("  PASS  Short password (< 8 chars) is rejected");

  await assert.rejects(
    async () => {
      await seedOwnerAdmin(testUser, "admin12345");
    },
    (err: Error) => {
      assert(err.message.includes("Password policy violation"), "Must reject common breached password");
      return true;
    }
  );
  console.log("  PASS  Common breached password is rejected");

  console.log("\nTest 2: Successful OWNER Seeding");
  const seedResult = await seedOwnerAdmin(testUser, strongPassword, { role: "OWNER" });
  assert.equal(seedResult.success, true);
  assert.equal(seedResult.username, testUser);
  assert.equal(seedResult.role, "OWNER");
  console.log("  PASS  seedOwnerAdmin returns success=true with OWNER role");

  const createdRow = await db.query.users.findFirst({ where: eq(users.username, testUser) });
  assert(createdRow, "Created row must exist in DB");
  assert.equal(createdRow.username, testUser);
  assert.equal(createdRow.role, "OWNER");
  assert.equal(createdRow.status, "active");
  assert.equal(createdRow.isEmailVerified, true);
  console.log("  PASS  Created DB row has status=active, role=OWNER, isEmailVerified=true");

  const verifies = await verifyPassword(strongPassword, createdRow.passwordHash);
  assert.equal(verifies, true, "Bcrypt hash must verify against password");
  console.log("  PASS  Password hash verifies with bcrypt");

  console.log("\nTest 3: Duplicate Username Rejection");
  await assert.rejects(
    async () => {
      await seedOwnerAdmin(testUser, "AnotherStrongPassword2026!");
    },
    (err: Error) => {
      assert(err.message.includes("already exists"), "Must reject duplicate username");
      return true;
    }
  );
  console.log("  PASS  Duplicate username creation is safely rejected");

  console.log("\nTest 4: Duplicate OWNER Role Prevention");
  await assert.rejects(
    async () => {
      await seedOwnerAdmin(`other_admin_${Date.now()}`, "AnotherStrongPassword2026!", { role: "OWNER" });
    },
    (err: Error) => {
      assert(err.message.includes("An OWNER account already exists"), "Must reject second OWNER");
      return true;
    }
  );
  console.log("  PASS  Duplicate OWNER account is prevented");

  // Cleanup test user
  await db.delete(users).where(eq(users.username, testUser));
  console.log("\nCleaned up test records.");

  console.log("\nAll seed-admin checks passed 100%.\n");
}

runTests().catch((err) => {
  console.error("seed-admin-check failed:", err);
  process.exit(1);
});
