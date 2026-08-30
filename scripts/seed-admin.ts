/**
 * Hardened Administrator Seeder for Fugluck
 *
 * Interactive Usage:
 *   npx tsx scripts/seed-admin.ts
 *   (Prompts securely for username, hidden password, and confirmation)
 *
 * Non-Interactive Usage:
 *   npx tsx scripts/seed-admin.ts --username <user> --password <pass> [--role OWNER|SUPER_ADMIN|ADMIN]
 *   Or via environment variables: ADMIN_USERNAME, ADMIN_PASSWORD
 */

import "dotenv/config";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "dev_secret_for_standalone_test_verification_32bytes";

import readline from "node:readline";
import { Writable } from "node:stream";
import { eq, or } from "drizzle-orm";
import { hashPassword, validatePasswordPolicy } from "../packages/server/src/auth/password.ts";
import { db } from "../packages/server/src/db/client.ts";
import { users } from "../packages/server/src/db/schema.ts";

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
  username?: string;
  password?: string;
  role?: "OWNER" | "SUPER_ADMIN" | "ADMIN";
} {
  const args = process.argv.slice(2);
  const result: ReturnType<typeof parseArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--username" || arg === "-u") {
      result.username = args[++i];
    } else if (arg === "--password" || arg === "-p") {
      result.password = args[++i];
    } else if (arg === "--role" || arg === "-r") {
      const r = args[++i]?.toUpperCase();
      if (r === "OWNER" || r === "SUPER_ADMIN" || r === "ADMIN") {
        result.role = r;
      }
    }
  }

  if (!result.username && process.env.ADMIN_USERNAME) {
    result.username = process.env.ADMIN_USERNAME;
  }
  if (!result.password && process.env.ADMIN_PASSWORD) {
    result.password = process.env.ADMIN_PASSWORD;
  }

  return result;
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

export async function seedOwnerAdmin(
  username: string,
  password: string,
  options?: { role?: "OWNER" | "SUPER_ADMIN" | "ADMIN"; email?: string }
): Promise<{ success: boolean; username: string; role: string; message: string }> {
  const trimmedUser = username.trim();
  const assignedRole = options?.role || "OWNER";

  // 1. Validate password against canonical security policy
  const policyResult = validatePasswordPolicy(password);
  if (!policyResult.valid) {
    throw new Error(`Password policy violation: ${policyResult.error}`);
  }

  // 2. Check for existing username or email collision
  const existing = await db.query.users.findFirst({
    where: or(eq(users.username, trimmedUser), eq(users.id, trimmedUser)),
  });

  if (existing) {
    throw new Error(
      `An account with username "${trimmedUser}" already exists (role: ${existing.role}, status: ${existing.status}). Refusing to overwrite.`
    );
  }

  // 3. Check if an OWNER/SUPER_ADMIN already exists
  const allUsers = await db.query.users.findMany();
  const existingAdmins = allUsers.filter((u) => (VALID_ADMIN_ROLES as readonly string[]).includes(u.role));

  if (existingAdmins.length > 0 && assignedRole === "OWNER") {
    const ownerExists = existingAdmins.some((a) => a.role === "OWNER");
    if (ownerExists) {
      throw new Error(
        `An OWNER account already exists in this database (${existingAdmins.map((a) => a.username).join(", ")}). Refusing duplicate OWNER creation.`
      );
    }
  }

  // 4. Hash password with bcrypt
  const passwordHash = await hashPassword(password);
  const adminId = `usr_owner_${Date.now()}`;
  const adminEmail = options?.email || `${trimmedUser}@fugluck.com`;

  // 5. Insert single OWNER account
  await db.insert(users).values({
    id: adminId,
    username: trimmedUser,
    email: adminEmail,
    passwordHash,
    role: assignedRole,
    status: "active",
    isEmailVerified: true,
  });

  return {
    success: true,
    username: trimmedUser,
    role: assignedRole,
    message: `Successfully created ${assignedRole} account "${trimmedUser}".`,
  };
}

async function main() {
  const args = parseArgs();
  const target = getSanitizedDbTarget();

  console.log("\n=======================================================");
  console.log(`Fugluck Administrator Seeder [Target: ${target.host} / ${target.db}]`);
  console.log("=======================================================");

  let username = args.username;
  if (!username) {
    if (process.stdin.isTTY) {
      username = await promptVisible("Enter administrator username [default: admin]: ");
    }
    if (!username || !username.trim()) {
      username = "admin";
    }
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
      console.error("\n[Error] Non-interactive execution requires password via argument or ADMIN_PASSWORD environment variable.");
      process.exit(1);
    }
  }

  const role = args.role || "OWNER";
  console.log(`Target Username: ${username}`);
  console.log(`Target Role:     ${role}`);

  try {
    const result = await seedOwnerAdmin(username, password, { role });
    console.log(`\n  [SUCCESS] ${result.message}`);
    console.log(`  Account is verified active and ready for login at /admin or /api/admin/login.\n`);
    process.exit(0);
  } catch (err: any) {
    console.error(`\n  [FAILED] ${err.message}\n`);
    process.exit(1);
  }
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("seed-admin.ts") || process.argv[1].endsWith("seed-admin")) &&
  !process.argv[1].endsWith("seed-admin-check.ts");

if (isDirectExecution) {
  main();
}
