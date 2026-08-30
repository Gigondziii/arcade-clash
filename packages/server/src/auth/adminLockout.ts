import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client";
import { adminLockoutAttempts } from "../db/schema";

export const MAX_ADMIN_LOGIN_ATTEMPTS = 5;
export const ADMIN_LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour

export type LockoutStatus = {
  isLocked: boolean;
  attemptCount: number;
  remainingMs: number;
  message?: string;
};

let tableEnsured = false;
async function ensureLockoutTable() {
  if (tableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_lockout_attempts (
        id text PRIMARY KEY,
        ip_address varchar(64) NOT NULL UNIQUE,
        attempt_count integer NOT NULL DEFAULT 0,
        locked_until timestamp with time zone,
        last_attempt_at timestamp with time zone NOT NULL DEFAULT NOW()
      );
    `);
    tableEnsured = true;
  } catch {
    // Table may already exist
  }
}

export async function checkAdminLockout(ipAddress: string): Promise<LockoutStatus> {
  await ensureLockoutTable();
  const record = await db.query.adminLockoutAttempts.findFirst({
    where: eq(adminLockoutAttempts.ipAddress, ipAddress),
  });

  if (!record) {
    return { isLocked: false, attemptCount: 0, remainingMs: 0 };
  }

  const now = Date.now();
  if (record.lockedUntil) {
    const lockedUntilMs = record.lockedUntil.getTime();
    if (now < lockedUntilMs) {
      const remainingMs = lockedUntilMs - now;
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      return {
        isLocked: true,
        attemptCount: record.attemptCount,
        remainingMs,
        message: `Admin login is locked for ${remainingMinutes} minute(s) due to 5 consecutive failed attempts.`,
      };
    }
  }

  return { isLocked: false, attemptCount: record.attemptCount, remainingMs: 0 };
}

export async function recordFailedAdminLogin(ipAddress: string): Promise<LockoutStatus> {
  await ensureLockoutTable();
  const record = await db.query.adminLockoutAttempts.findFirst({
    where: eq(adminLockoutAttempts.ipAddress, ipAddress),
  });

  const now = new Date();
  let currentAttempts = (record?.attemptCount ?? 0) + 1;
  let lockedUntil: Date | null = null;

  if (currentAttempts >= MAX_ADMIN_LOGIN_ATTEMPTS) {
    lockedUntil = new Date(now.getTime() + ADMIN_LOCKOUT_DURATION_MS);
  }

  if (!record) {
    await db.insert(adminLockoutAttempts).values({
      id: `lockout_${randomUUID()}`,
      ipAddress,
      attemptCount: currentAttempts,
      lockedUntil,
      lastAttemptAt: now,
    });
  } else {
    await db
      .update(adminLockoutAttempts)
      .set({
        attemptCount: currentAttempts,
        lockedUntil,
        lastAttemptAt: now,
      })
      .where(eq(adminLockoutAttempts.id, record.id));
  }

  if (currentAttempts >= MAX_ADMIN_LOGIN_ATTEMPTS) {
    return {
      isLocked: true,
      attemptCount: currentAttempts,
      remainingMs: ADMIN_LOCKOUT_DURATION_MS,
      message: "Admin login is locked for 1 hour due to 5 consecutive failed attempts.",
    };
  }

  return {
    isLocked: false,
    attemptCount: currentAttempts,
    remainingMs: 0,
  };
}

export async function resetAdminLockout(ipAddress: string): Promise<void> {
  await ensureLockoutTable();
  await db
    .update(adminLockoutAttempts)
    .set({
      attemptCount: 0,
      lockedUntil: null,
      lastAttemptAt: new Date(),
    })
    .where(eq(adminLockoutAttempts.ipAddress, ipAddress));
}
