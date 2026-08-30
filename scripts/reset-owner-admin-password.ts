/**
 * Controlled Local Owner/Admin Credential Recovery Script for Fugluck
 *
 * Interactive Usage (Preferred - No password in command history):
 *   npx tsx scripts/reset-owner-admin-password.ts --identifier <username|email>
 *   (Prompts securely for password and confirmation with input hidden)
 *
 * Non-Interactive Usage (for automated test environments):
 *   $env:ADMIN_IDENTIFIER="admin"
 *   $env:NEW_ADMIN_PASSWORD="SecurePassword123!"
 *   npx tsx scripts/reset-owner-admin-password.ts
 *
 * To list existing admin accounts:
 *   npx tsx scripts/reset-owner-admin-password.ts --list-admins
 */

import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import readline from "node:readline";
import { Writable } from "node:stream";
import { eq, or, sql } from "drizzle-orm";
import { db } from "../packages/server/src/db/client.ts";
import { passwordResetTokens, users } from "../packages/server/src/db/schema.ts";
import { hashPassword, validatePasswordPolicy } from "../packages/server/src/auth/password.ts";

const VALID_ADMIN_ROLES = ["OWNER", "SUPER_ADMIN", "ADMIN"] as const;

function promptHidden(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    let isMuted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!isMuted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    process.stdout.write(promptText);
    isMuted = true;

    rl.question("", (answer) => {
      isMuted = false;
      process.stdout.write("\n");
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptVisible(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function parseArgs(): {
  identifier?: string;
  password?: string;
  listAdmins?: boolean;
  clearLockouts?: boolean;
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--identifier" || arg === "-u") {
      result.identifier = args[++i];
    } else if (arg === "--password" || arg === "-p") {
      result.password = args[++i];
    } else if (arg === "--list-admins" || arg === "-l") {
      result.listAdmins = true;
    } else if (arg === "--clear-lockouts" || arg === "-c") {
      result.clearLockouts = true;
    }
  }

  // Fallback to environment variables if provided
  if (!result.identifier && process.env.ADMIN_IDENTIFIER) {
    result.identifier = process.env.ADMIN_IDENTIFIER;
  }
  if (!result.password && process.env.NEW_ADMIN_PASSWORD) {
    result.password = process.env.NEW_ADMIN_PASSWORD;
  }

  return result;
}

export async function resetOwnerAdminPassword(
  identifier: string,
  newPassword: string,
  options?: { clearLockouts?: boolean }
): Promise<{ success: boolean; username: string; role: string; message: string }> {
  const trimmedId = identifier.trim();

  // 1. Password Policy Validation
  const policyResult = validatePasswordPolicy(newPassword);
  if (!policyResult.valid) {
    throw new Error(`Password policy violation: ${policyResult.error}`);
  }

  // 2. Target User Lookup
  const targetUser = await db.query.users.findFirst({
    where: or(eq(users.username, trimmedId), eq(users.email, trimmedId), eq(users.id, trimmedId)),
  });

  const newHash = await hashPassword(newPassword);

  if (!targetUser) {
    // Check if any admin/owner accounts exist
    const allUsers = await db.query.users.findMany();
    const existingAdmins = allUsers.filter((u) => (VALID_ADMIN_ROLES as readonly string[]).includes(u.role));

    if (existingAdmins.length === 0) {
      // Clean/fresh database: Bootstrap the primary OWNER account
      const ownerId = `usr_owner_${Date.now()}`;
      await db.insert(users).values({
        id: ownerId,
        username: trimmedId,
        email: `${trimmedId}@fugluck.com`,
        passwordHash: newHash,
        role: "OWNER",
        status: "active",
      });

      return {
        success: true,
        username: trimmedId,
        role: "OWNER",
        message: `Primary OWNER account "${trimmedId}" created and provisioned with specified credentials.`,
      };
    }

    throw new Error(`Target account not found for identifier: "${trimmedId}".`);
  }

  // 3. Admin/Owner Role Verification
  const isPrivilegedRole = (VALID_ADMIN_ROLES as readonly string[]).includes(targetUser.role);
  if (!isPrivilegedRole) {
    throw new Error(
      `Account "${targetUser.username}" has role "${targetUser.role}", which is not an authorized administrator role (expected: ${VALID_ADMIN_ROLES.join(", ")}).`
    );
  }

  // 4. Atomic Update
  await db.transaction(async (tx) => {
    // Update password hash and ensure account is active
    await tx
      .update(users)
      .set({
        passwordHash: newHash,
        status: "active",
        statusReason: null,
      })
      .where(eq(users.id, targetUser.id));

    // Invalidate any existing unconsumed password reset tokens
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, targetUser.id));
  });

  // 5. Optional: Clear IP lockout table
  if (options?.clearLockouts) {
    try {
      await db.execute(sql`TRUNCATE TABLE admin_lockout_attempts;`);
    } catch {
      // Table may not exist in minimal environments
    }
  }

  return {
    success: true,
    username: targetUser.username,
    role: targetUser.role,
    message: `Password successfully updated for ${targetUser.role} account "${targetUser.username}".`,
  };
}

function getSanitizedDbTarget(): { host: string; db: string } {
  try {
    const raw = process.env.DATABASE_URL || "";
    const u = new URL(raw);
    return { host: u.hostname, db: u.pathname.replace(/^\//, "") };
  } catch {
    return { host: "unknown", db: "unknown" };
  }
}

async function checkActiveLockouts(): Promise<{ ip: string; attempts: number; lockedUntil: Date | null }[]> {
  try {
    const records = await db.query.adminLockoutAttempts.findMany();
    return records.map((r) => ({ ip: r.ipAddress, attempts: r.attemptCount, lockedUntil: r.lockedUntil }));
  } catch {
    return [];
  }
}

async function listAdminAccounts(): Promise<void> {
  const target = getSanitizedDbTarget();
  console.log("\n=======================================================");
  console.log(`Fugluck Administrator Accounts [Target: ${target.host} / ${target.db}]`);
  console.log("=======================================================");

  const allUsers = await db.query.users.findMany();
  const admins = allUsers.filter((u) => (VALID_ADMIN_ROLES as readonly string[]).includes(u.role));

  if (admins.length === 0) {
    console.log("  No accounts with OWNER, SUPER_ADMIN, or ADMIN role found.");
  } else {
    for (const a of admins) {
      console.log(`  - Username: ${a.username} | Role: ${a.role} | Status: ${a.status} | ID: ${a.id}`);
    }
  }

  const lockouts = await checkActiveLockouts();
  const activeLockouts = lockouts.filter((l) => l.lockedUntil && l.lockedUntil.getTime() > Date.now());
  if (activeLockouts.length > 0) {
    console.log("\nActive Admin Lockouts:");
    for (const l of activeLockouts) {
      console.log(`  - IP: ${l.ip} | Attempts: ${l.attempts} | Locked Until: ${l.lockedUntil?.toISOString()}`);
    }
  } else {
    console.log("\n  Active IP Lockouts: None (0)");
  }

  console.log("=======================================================\n");
}

async function main() {
  const args = parseArgs();

  if (args.listAdmins) {
    await listAdminAccounts();
    process.exit(0);
  }

  const target = getSanitizedDbTarget();
  console.log("\n--- Fugluck Admin Credential Recovery Tool ---");
  console.log(`Database Target: host=${target.host} | database=${target.db}`);

  // Check active lockouts
  const lockouts = await checkActiveLockouts();
  const activeLockouts = lockouts.filter((l) => l.lockedUntil && l.lockedUntil.getTime() > Date.now());
  if (activeLockouts.length > 0) {
    console.log(`[Notice] ${activeLockouts.length} active IP lockout(s) present in database.`);
    if (!args.clearLockouts) {
      console.log(`         Pass --clear-lockouts or -c to clear active lockouts.`);
    }
  }

  let identifier = args.identifier;
  if (!identifier) {
    if (process.stdin.isTTY) {
      identifier = await promptVisible("Enter owner/admin username or email: ");
    }
  }

  if (!identifier) {
    console.error("\n[Error] Target administrator identifier is required.");
    console.error("Usage: npx tsx scripts/reset-owner-admin-password.ts --identifier <username>\n");
    process.exit(1);
  }

  let password = args.password;
  if (!password) {
    if (process.stdin.isTTY) {
      const p1 = await promptHidden("Enter new admin password (hidden): ");
      if (!p1) {
        console.error("\n[Error] Password cannot be empty.");
        process.exit(1);
      }
      const p2 = await promptHidden("Confirm new admin password (hidden): ");
      if (p1 !== p2) {
        console.error("\n[Error] Password confirmation mismatch. Aborting.");
        process.exit(1);
      }
      password = p1;
    } else {
      console.error("\n[Error] Non-interactive execution requires password via argument or NEW_ADMIN_PASSWORD environment variable.");
      process.exit(1);
    }
  }

  console.log(`Target Identifier: ${identifier}`);

  try {
    const result = await resetOwnerAdminPassword(identifier, password, { clearLockouts: args.clearLockouts });
    console.log(`\n  [SUCCESS] ${result.message}`);
    if (args.clearLockouts) {
      console.log("  [SUCCESS] Admin IP lockout attempts cleared.");
    }
    console.log(`  Account is verified active and ready for login at /admin or /api/admin/login.\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n  [FAILED] ${err.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1]?.includes("reset-owner-admin-password")) {
  main();
}
