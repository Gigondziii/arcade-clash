import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, count, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { ADMIN_SESSION_COOKIE_NAME, attachSession, requireAuth, requireOwnerAdmin } from "../auth/middleware";
import { requirePermission } from "../auth/permissions";
import { verifyPassword } from "../auth/password";
import { signSessionToken, getSessionCookieOptions, getClearCookieOptions } from "../auth/jwt";
import { checkAdminLockout, recordFailedAdminLogin, resetAdminLockout } from "../auth/adminLockout";
import { db } from "../db/client";
import { adminAuditLogs, ledgerEntries, matchesHistory, matchSettlements, users } from "../db/schema";
import { ensureMatchSettlementsTable, getBalances } from "../wallet/ledger";
import { getActiveMatchesSummary } from "../matchmaking/matches";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";

const adminLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many administrative requests. Please wait a moment.",
});

const adminLoginLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: "Too many admin login requests. Please wait a moment.",
});

export const adminRouter = Router();

adminRouter.use(adminLimiter);

// ---------------------------------------------------------------------------
// Owner Admin Authentication & Lockout Handling
// ---------------------------------------------------------------------------
adminRouter.post("/login", adminLoginLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};
  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

  // 1. Server-side 5-attempt lockout check
  const lockoutStatus = await checkAdminLockout(clientIp);
  if (lockoutStatus.isLocked) {
    res.status(429).json({ error: lockoutStatus.message });
    return;
  }

  if (typeof username !== "string" || typeof password !== "string" || !username.trim() || !password.trim()) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.username, username.trim()) });

  const isValidPassword = user ? await verifyPassword(password, user.passwordHash) : false;
  const isOwnerAdmin = user && (user.role === "OWNER" || user.role === "SUPER_ADMIN" || user.role === "ADMIN");

  if (!user || !isValidPassword || !isOwnerAdmin) {
    // Record failed login attempt (5th attempt triggers 1-hour lockout)
    const newLockoutState = await recordFailedAdminLogin(clientIp);
    if (newLockoutState.isLocked) {
      res.status(429).json({ error: newLockoutState.message });
      return;
    }
    res.status(401).json({ error: "Invalid administrative credentials." });
    return;
  }

  // Reset lockout attempts on successful authentication
  await resetAdminLockout(clientIp);

  // Set HTTP-only admin session cookie
  const adminToken = signSessionToken({ sub: user.id });
  res.cookie(ADMIN_SESSION_COOKIE_NAME, adminToken, getSessionCookieOptions());

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

adminRouter.post("/logout", (_req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, getClearCookieOptions());
  res.status(204).end();
});

// Guard all operational admin routes with server-side requireOwnerAdmin
adminRouter.use(requireOwnerAdmin);

adminRouter.get("/me", async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId!) });
  if (!user) {
    res.status(401).json({ error: "Admin session invalid." });
    return;
  }

  const { ROLE_PERMISSIONS } = await import("../auth/permissions");
  const role = (user.role in ROLE_PERMISSIONS ? user.role : "user") as import("../auth/permissions").AdminRole;
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
    },
    permissions: ROLE_PERMISSIONS[role] ?? [],
  });
});

adminRouter.get("/dashboard", requirePermission("ADMIN_VIEW_AUDIT"), async (_req, res) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [totalUsersRes] = await db.select({ value: count() }).from(users);
  const [activeUsersRes] = await db.select({ value: count() }).from(users).where(eq(users.status, "active"));
  const [suspendedUsersRes] = await db.select({ value: count() }).from(users).where(eq(users.status, "suspended"));
  const [bannedUsersRes] = await db.select({ value: count() }).from(users).where(eq(users.status, "banned"));

  const [totalMatchesRes] = await db.select({ value: count() }).from(matchesHistory).where(eq(matchesHistory.status, "COMPLETED"));
  const [todayMatchesRes] = await db.select({ value: count() }).from(matchesHistory).where(and(eq(matchesHistory.status, "COMPLETED"), gte(matchesHistory.createdAt, startOfDay)));
  const [todayVoidedRes] = await db.select({ value: count() }).from(matchesHistory).where(and(eq(matchesHistory.status, "VOIDED"), gte(matchesHistory.createdAt, startOfDay)));
  const [totalVoidedRes] = await db.select({ value: count() }).from(matchesHistory).where(eq(matchesHistory.status, "VOIDED"));

  const [coinsCirculationRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(eq(ledgerEntries.currency, "COINS"));
  const [diamondsCirculationRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.currency, "DIAMONDS"), sql`${ledgerEntries.userId} != 'platform_rake_account'`));
  const [platformRakeRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, "platform_rake_account"), eq(ledgerEntries.currency, "DIAMONDS")));

  const recentAuditLogs = await db.query.adminAuditLogs.findMany({
    limit: 10,
    orderBy: [desc(adminAuditLogs.createdAt)],
  });

  const activeMatchesCount = getActiveMatchesSummary().length;

  res.json({
    metrics: {
      registeredUsers: totalUsersRes?.value ?? 0,
      activeUsers: activeUsersRes?.value ?? 0,
      suspendedUsers: suspendedUsersRes?.value ?? 0,
      bannedUsers: bannedUsersRes?.value ?? 0,
      activeMatchesCount,
      completedMatchesTotal: totalMatchesRes?.value ?? 0,
      matchesCompletedToday: todayMatchesRes?.value ?? 0,
      matchesVoidedToday: todayVoidedRes?.value ?? 0,
      totalMatchesVoided: totalVoidedRes?.value ?? 0,
      coinsCirculation: coinsCirculationRes?.value ?? 0,
      diamondsCirculation: diamondsCirculationRes?.value ?? 0,
      platformRakeDiamonds: platformRakeRes?.value ?? 0,
    },
    recentAuditLogs,
  });
});

// ---------------------------------------------------------------------------
// 1. User Search & Detail Management
// ---------------------------------------------------------------------------
adminRouter.get("/users", requirePermission("USERS_VIEW"), async (req, res) => {
  const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const role = typeof req.query.role === "string" ? req.query.role.trim() : "";
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (query.length > 0) {
    conditions.push(or(ilike(users.username, `%${query}%`), eq(users.id, query), ilike(users.email, `%${query}%`)));
  }
  if (status.length > 0 && (status === "active" || status === "suspended" || status === "banned")) {
    conditions.push(eq(users.status, status));
  }
  if (role.length > 0 && ["OWNER", "SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT", "user"].includes(role)) {
    conditions.push(eq(users.role, role));
  }

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const userList = await db.query.users.findMany({
    where: whereCondition,
    limit,
    offset,
    orderBy: [desc(users.createdAt)],
  });

  const [totalRes] = await db.select({ value: count() }).from(users).where(whereCondition);

  // Compute derived ledger balances for listed users
  const userResults = await Promise.all(
    userList.map(async (u) => {
      const [coinsRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, u.id), eq(ledgerEntries.currency, "COINS")));
      const [diamondsRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, u.id), eq(ledgerEntries.currency, "DIAMONDS")));
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status,
        statusReason: u.statusReason,
        gamesPlayed: u.gamesPlayed,
        gamesWon: u.gamesWon,
        createdAt: u.createdAt.toISOString(),
        balances: {
          coins: coinsRes?.value ?? 0,
          diamonds: diamondsRes?.value ?? 0,
        },
      };
    })
  );

  res.json({
    users: userResults,
    pagination: { page, limit, total: totalRes?.value ?? 0 },
  });
});

adminRouter.get("/users/:id", requirePermission("USERS_VIEW"), async (req, res) => {
  const targetId = String(req.params.id);
  const user = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const [coinsRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, targetId), eq(ledgerEntries.currency, "COINS")));
  const [diamondsRes] = await db.select({ value: sql<number>`coalesce(sum(amount), 0)::int` }).from(ledgerEntries).where(and(eq(ledgerEntries.userId, targetId), eq(ledgerEntries.currency, "DIAMONDS")));

  const recentMatches = await db.query.matchesHistory.findMany({
    where: or(eq(matchesHistory.player1Id, targetId), eq(matchesHistory.player2Id, targetId)),
    limit: 10,
    orderBy: [desc(matchesHistory.createdAt)],
  });

  const recentLedger = await db.query.ledgerEntries.findMany({
    where: eq(ledgerEntries.userId, targetId),
    limit: 15,
    orderBy: [desc(ledgerEntries.createdAt)],
  });

  const userAuditLogs = await db.query.adminAuditLogs.findMany({
    where: eq(adminAuditLogs.targetId, targetId),
    limit: 10,
    orderBy: [desc(adminAuditLogs.createdAt)],
  });

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      statusReason: user.statusReason,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      createdAt: user.createdAt.toISOString(),
      balances: {
        coins: coinsRes?.value ?? 0,
        diamonds: diamondsRes?.value ?? 0,
      },
    },
    recentMatches,
    recentLedger,
    userAuditLogs,
  });
});

// Moderation Actions
adminRouter.post("/users/:id/suspend", requirePermission("USERS_SUSPEND"), async (req, res) => {
  const adminUserId = req.userId!;
  const targetId = String(req.params.id);
  const { reason } = req.body ?? {};

  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required for suspension." });
    return;
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) {
    res.status(404).json({ error: "Target user not found." });
    return;
  }
  if (target.role === "OWNER") {
    res.status(403).json({ error: "Cannot suspend an OWNER account." });
    return;
  }

  await db.update(users).set({ status: "suspended", statusReason: reason }).where(eq(users.id, targetId));

  const auditLogId = `audit_${randomUUID()}`;
  await db.insert(adminAuditLogs).values({
    id: auditLogId,
    adminUserId,
    action: "ADMIN_SUSPEND_USER",
    targetType: "user",
    targetId,
    reason,
  });

  res.json({ success: true, status: "suspended", auditLogId });
});

adminRouter.post("/users/:id/ban", requirePermission("USERS_BAN"), async (req, res) => {
  const adminUserId = req.userId!;
  const targetId = String(req.params.id);
  const { reason } = req.body ?? {};

  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required for account ban." });
    return;
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) {
    res.status(404).json({ error: "Target user not found." });
    return;
  }
  if (target.role === "OWNER") {
    res.status(403).json({ error: "Cannot ban an OWNER account." });
    return;
  }

  await db.update(users).set({ status: "banned", statusReason: reason }).where(eq(users.id, targetId));

  const auditLogId = `audit_${randomUUID()}`;
  await db.insert(adminAuditLogs).values({
    id: auditLogId,
    adminUserId,
    action: "ADMIN_BAN_USER",
    targetType: "user",
    targetId,
    reason,
  });

  res.json({ success: true, status: "banned", auditLogId });
});

adminRouter.post("/users/:id/unban", requirePermission("USERS_UNBAN"), async (req, res) => {
  const adminUserId = req.userId!;
  const targetId = String(req.params.id);
  const { reason } = req.body ?? {};

  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required for unbanning." });
    return;
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) {
    res.status(404).json({ error: "Target user not found." });
    return;
  }

  await db.update(users).set({ status: "active", statusReason: null }).where(eq(users.id, targetId));

  const auditLogId = `audit_${randomUUID()}`;
  await db.insert(adminAuditLogs).values({
    id: auditLogId,
    adminUserId,
    action: "ADMIN_UNBAN_USER",
    targetType: "user",
    targetId,
    reason,
  });

  res.json({ success: true, status: "active", auditLogId });
});

adminRouter.post("/users/:id/role", requirePermission("ADMIN_MANAGE_ADMINS"), async (req, res) => {
  const adminUserId = req.userId!;
  const targetId = String(req.params.id);
  const { role, reason } = req.body ?? {};

  if (!["OWNER", "SUPER_ADMIN", "ADMIN", "MODERATOR", "SUPPORT", "user"].includes(role)) {
    res.status(400).json({ error: "Invalid role specified." });
    return;
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required to modify user role." });
    return;
  }

  const target = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  if (!target) {
    res.status(404).json({ error: "Target user not found." });
    return;
  }

  if (target.role === "OWNER" && role !== "OWNER") {
    const allUsers = await db.query.users.findMany();
    const owners = allUsers.filter((u) => u.role === "OWNER");
    if (owners.length <= 1) {
      res.status(400).json({ error: "Cannot demote the sole OWNER account in the system." });
      return;
    }
  }

  await db.update(users).set({ role }).where(eq(users.id, targetId));

  const auditLogId = `audit_${randomUUID()}`;
  await db.insert(adminAuditLogs).values({
    id: auditLogId,
    adminUserId,
    action: "ADMIN_UPDATE_USER_ROLE",
    targetType: "user",
    targetId,
    reason,
    details: { previousRole: target.role, newRole: role },
  });

  res.json({ success: true, role, auditLogId });
});

// ---------------------------------------------------------------------------
// 3. Match Administration
// ---------------------------------------------------------------------------
adminRouter.get("/matches", requirePermission("MATCHES_VIEW"), async (req, res) => {
  const matchId = typeof req.query.matchId === "string" ? req.query.matchId.trim() : "";
  const gameId = typeof req.query.gameId === "string" ? req.query.gameId.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status.trim() : "";
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId.trim() : "";
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim() : "";
  const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate.trim() : "";
  const toDate = typeof req.query.toDate === "string" ? req.query.toDate.trim() : "";
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (matchId.length > 0) conditions.push(eq(matchesHistory.id, matchId));
  if (gameId.length > 0) conditions.push(eq(matchesHistory.gameId, gameId));
  if (status.length > 0) conditions.push(eq(matchesHistory.status, status));
  if (currency.length > 0) conditions.push(eq(matchesHistory.currency, currency));
  if (playerId.length > 0) conditions.push(or(eq(matchesHistory.player1Id, playerId), eq(matchesHistory.player2Id, playerId)));
  if (fromDate.length > 0 && !isNaN(Date.parse(fromDate))) conditions.push(gte(matchesHistory.createdAt, new Date(fromDate)));
  if (toDate.length > 0 && !isNaN(Date.parse(toDate))) conditions.push(lte(matchesHistory.createdAt, new Date(toDate)));

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const matches = await db.query.matchesHistory.findMany({
    where: whereCondition,
    limit,
    offset,
    orderBy: [desc(matchesHistory.createdAt)],
  });

  const [totalRes] = await db.select({ value: count() }).from(matchesHistory).where(whereCondition);

  res.json({
    matches,
    pagination: { page, limit, total: totalRes?.value ?? 0 },
  });
});

adminRouter.get("/matches/active", requirePermission("MATCHES_VIEW"), async (_req, res) => {
  res.json({ activeMatches: getActiveMatchesSummary() });
});

adminRouter.get("/matches/:id", requirePermission("MATCHES_VIEW"), async (req, res) => {
  const matchId = String(req.params.id);
  const match = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, matchId) });
  if (!match) {
    res.status(404).json({ error: "Match not found in history." });
    return;
  }

  const settlement = await db.query.matchSettlements.findFirst({ where: eq(matchSettlements.matchId, matchId) });

  const relatedLedger = await db.query.ledgerEntries.findMany({
    where: ilike(ledgerEntries.reason, `%${matchId}%`),
  });

  const relatedAuditLogs = await db.query.adminAuditLogs.findMany({
    where: eq(adminAuditLogs.targetId, matchId),
  });

  res.json({
    match,
    settlement: settlement ?? null,
    relatedLedger,
    relatedAuditLogs,
  });
});

// Void Match
adminRouter.post("/matches/:id/void", requirePermission("MATCHES_VOID"), async (req, res) => {
  const adminUserId = req.userId!;
  const matchId = String(req.params.id);
  const { reason, idempotencyKey } = req.body ?? {};

  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required to void a match." });
    return;
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    res.status(400).json({ error: "An idempotencyKey is required." });
    return;
  }

  await ensureMatchSettlementsTable();

  try {
    const result = await db.transaction(async (tx) => {
      const existingAudit = await tx.query.adminAuditLogs.findFirst({ where: eq(adminAuditLogs.idempotencyKey, idempotencyKey) });
      if (existingAudit) {
        return { status: 200, body: { success: true, idempotencyKey, note: "Duplicate request handled idempotently." } };
      }

      const match = await tx.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, matchId) });
      if (!match) {
        return { status: 404, body: { error: "Match not found." } };
      }

      // ATOMIC SETTLEMENT GUARD: Enforce primary key conflict on match_id
      const settlementRows = await tx
        .insert(matchSettlements)
        .values({
          matchId,
          status: "VOIDED",
          currency: match.currency,
          stake: match.stake,
        })
        .onConflictDoNothing()
        .returning();

      if (!settlementRows || settlementRows.length === 0 || match.status === "VOIDED") {
        return { status: 409, body: { error: "Match has already been settled or voided." } };
      }

      // Update match status atomically
      await tx.update(matchesHistory).set({ status: "VOIDED", statusReason: reason }).where(eq(matchesHistory.id, matchId));

      // If match had a non-zero stake, issue compensating refunds to both players
      if (match.stake > 0) {
        const refundP1Reason = `match_void_refund_${matchId}_${match.player1Id}`;
        const refundP2Reason = `match_void_refund_${matchId}_${match.player2Id}`;

        await tx.insert(ledgerEntries).values({
          id: `ledger_${randomUUID()}`,
          userId: match.player1Id,
          currency: match.currency,
          amount: match.stake,
          reason: refundP1Reason,
        }).onConflictDoNothing();

        await tx.insert(ledgerEntries).values({
          id: `ledger_${randomUUID()}`,
          userId: match.player2Id,
          currency: match.currency,
          amount: match.stake,
          reason: refundP2Reason,
        }).onConflictDoNothing();
      }

      const auditLogId = `audit_${randomUUID()}`;
      await tx.insert(adminAuditLogs).values({
        id: auditLogId,
        adminUserId,
        action: "ADMIN_VOID_MATCH",
        targetType: "match",
        targetId: matchId,
        reason,
        idempotencyKey,
        details: { gameId: match.gameId, stake: match.stake, currency: match.currency },
      });

      return { status: 200, body: { success: true, status: "VOIDED", auditLogId } };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[admin] Void match error:", err);
    res.status(500).json({ error: "Failed to void match due to an internal error." });
  }
});

// ---------------------------------------------------------------------------
// 4. Wallet & Ledger Administration
// ---------------------------------------------------------------------------
adminRouter.get("/ledger", requirePermission("WALLET_VIEW"), async (req, res) => {
  const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
  const currency = typeof req.query.currency === "string" ? req.query.currency.trim() : "";
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (userId.length > 0) conditions.push(eq(ledgerEntries.userId, userId));
  if (currency.length > 0 && (currency === "COINS" || currency === "DIAMONDS")) conditions.push(eq(ledgerEntries.currency, currency));

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const entries = await db.query.ledgerEntries.findMany({
    where: whereCondition,
    limit,
    offset,
    orderBy: [desc(ledgerEntries.createdAt)],
  });

  const [totalRes] = await db.select({ value: count() }).from(ledgerEntries).where(whereCondition);

  res.json({
    ledger: entries,
    pagination: { page, limit, total: totalRes?.value ?? 0 },
  });
});

// Grant Coins
adminRouter.post("/wallet/grant-coins", requirePermission("WALLET_GRANT_COINS"), async (req, res) => {
  const adminUserId = req.userId!;
  const { targetUserId, amount, reason, idempotencyKey } = req.body ?? {};

  if (typeof targetUserId !== "string" || targetUserId.length === 0) {
    res.status(400).json({ error: "Target user ID is required." });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    res.status(400).json({ error: "Amount must be a positive integer up to 100,000." });
    return;
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required." });
    return;
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    res.status(400).json({ error: "An idempotencyKey is required." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existingAudit = await tx.query.adminAuditLogs.findFirst({ where: eq(adminAuditLogs.idempotencyKey, idempotencyKey) });
      if (existingAudit) {
        const balances = await getBalances(targetUserId, tx);
        return { status: 200, body: { success: true, idempotencyKey, note: "Duplicate grant request handled idempotently.", balances } };
      }

      const targetUser = await tx.query.users.findFirst({ where: eq(users.id, targetUserId) });
      if (!targetUser) {
        return { status: 404, body: { error: "Target user not found." } };
      }

      const grantReason = `admin_grant_coins_${idempotencyKey}`;
      const ledgerId = `ledger_${randomUUID()}`;

      await tx.insert(ledgerEntries).values({
        id: ledgerId,
        userId: targetUserId,
        currency: "COINS",
        amount: Math.floor(amount),
        reason: grantReason,
      }).onConflictDoNothing();

      const auditLogId = `audit_${randomUUID()}`;
      await tx.insert(adminAuditLogs).values({
        id: auditLogId,
        adminUserId,
        action: "ADMIN_GRANT_COINS",
        targetType: "user",
        targetId: targetUserId,
        amount: Math.floor(amount),
        currency: "COINS",
        reason,
        idempotencyKey,
      });

      const balances = await getBalances(targetUserId, tx);
      return { status: 200, body: { success: true, ledgerId, auditLogId, balances } };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[admin] Grant coins error:", err);
    res.status(500).json({ error: "Failed to grant coins due to an internal error." });
  }
});

// Grant Diamonds
adminRouter.post("/wallet/grant-diamonds", requirePermission("WALLET_GRANT_DIAMONDS"), async (req, res) => {
  const adminUserId = req.userId!;
  const { targetUserId, amount, reason, idempotencyKey } = req.body ?? {};

  if (typeof targetUserId !== "string" || targetUserId.length === 0) {
    res.status(400).json({ error: "Target user ID is required." });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    res.status(400).json({ error: "Amount must be a positive integer up to 100,000." });
    return;
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required." });
    return;
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    res.status(400).json({ error: "An idempotencyKey is required." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existingAudit = await tx.query.adminAuditLogs.findFirst({ where: eq(adminAuditLogs.idempotencyKey, idempotencyKey) });
      if (existingAudit) {
        const balances = await getBalances(targetUserId, tx);
        return { status: 200, body: { success: true, idempotencyKey, note: "Duplicate grant request handled idempotently.", balances } };
      }

      const targetUser = await tx.query.users.findFirst({ where: eq(users.id, targetUserId) });
      if (!targetUser) {
        return { status: 404, body: { error: "Target user not found." } };
      }

      const grantReason = `admin_grant_diamonds_${idempotencyKey}`;
      const ledgerId = `ledger_${randomUUID()}`;

      await tx.insert(ledgerEntries).values({
        id: ledgerId,
        userId: targetUserId,
        currency: "DIAMONDS",
        amount: Math.floor(amount),
        reason: grantReason,
      }).onConflictDoNothing();

      const auditLogId = `audit_${randomUUID()}`;
      await tx.insert(adminAuditLogs).values({
        id: auditLogId,
        adminUserId,
        action: "ADMIN_GRANT_DIAMONDS",
        targetType: "user",
        targetId: targetUserId,
        amount: Math.floor(amount),
        currency: "DIAMONDS",
        reason,
        idempotencyKey,
      });

      const balances = await getBalances(targetUserId, tx);
      return { status: 200, body: { success: true, ledgerId, auditLogId, balances } };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[admin] Grant diamonds error:", err);
    res.status(500).json({ error: "Failed to grant diamonds due to an internal error." });
  }
});

// Reverse Ledger Entry (Compensating Transaction)
adminRouter.post("/wallet/reverse", requirePermission("WALLET_REVERSE_TRANSACTION"), async (req, res) => {
  const adminUserId = req.userId!;
  const { originalLedgerId, reason, idempotencyKey } = req.body ?? {};

  if (typeof originalLedgerId !== "string" || originalLedgerId.length === 0) {
    res.status(400).json({ error: "Original ledger ID is required." });
    return;
  }
  if (typeof reason !== "string" || reason.trim().length === 0) {
    res.status(400).json({ error: "An explicit reason is required for transaction reversal." });
    return;
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
    res.status(400).json({ error: "An idempotencyKey is required." });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const existingAudit = await tx.query.adminAuditLogs.findFirst({ where: eq(adminAuditLogs.idempotencyKey, idempotencyKey) });
      if (existingAudit) {
        return { status: 200, body: { success: true, idempotencyKey, note: "Duplicate reversal handled idempotently." } };
      }

      // Check if original entry has already been reversed under any idempotencyKey
      const existingReversal = await tx.query.adminAuditLogs.findFirst({
        where: and(
          eq(adminAuditLogs.action, "ADMIN_REVERSE_LEDGER_ENTRY"),
          eq(adminAuditLogs.targetId, originalLedgerId),
        ),
      });
      if (existingReversal) {
        return { status: 409, body: { error: "Original ledger entry has already been reversed." } };
      }

      const originalEntry = await tx.query.ledgerEntries.findFirst({ where: eq(ledgerEntries.id, originalLedgerId) });
      if (!originalEntry) {
        return { status: 404, body: { error: "Original ledger entry not found." } };
      }

      const reversalReason = `admin_reversal_${originalLedgerId}_${idempotencyKey}`;
      const reversalId = `ledger_${randomUUID()}`;

      // Insert compensating inverse amount
      await tx.insert(ledgerEntries).values({
        id: reversalId,
        userId: originalEntry.userId,
        currency: originalEntry.currency,
        amount: -originalEntry.amount,
        reason: reversalReason,
      }).onConflictDoNothing();

      const auditLogId = `audit_${randomUUID()}`;
      await tx.insert(adminAuditLogs).values({
        id: auditLogId,
        adminUserId,
        action: "ADMIN_REVERSE_LEDGER_ENTRY",
        targetType: "ledger",
        targetId: originalLedgerId,
        amount: -originalEntry.amount,
        currency: originalEntry.currency,
        reason,
        idempotencyKey,
        details: { reversedUserId: originalEntry.userId, originalAmount: originalEntry.amount },
      });

      return { status: 200, body: { success: true, reversalId, auditLogId } };
    });

    res.status(result.status).json(result.body);
  } catch (err: any) {
    console.error("[admin] Reverse ledger entry error:", err);
    res.status(500).json({ error: "Failed to reverse ledger entry due to an internal error." });
  }
});

// ---------------------------------------------------------------------------
// 5. Audit Log Explorer
// ---------------------------------------------------------------------------
adminRouter.get("/audit-logs", requirePermission("ADMIN_VIEW_AUDIT"), async (req, res) => {
  const action = typeof req.query.action === "string" ? req.query.action.trim() : "";
  const targetType = typeof req.query.targetType === "string" ? req.query.targetType.trim() : "";
  const targetId = typeof req.query.targetId === "string" ? req.query.targetId.trim() : "";
  const adminUserId = typeof req.query.adminUserId === "string" ? req.query.adminUserId.trim() : "";
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (action.length > 0) conditions.push(eq(adminAuditLogs.action, action));
  if (targetType.length > 0) conditions.push(eq(adminAuditLogs.targetType, targetType));
  if (targetId.length > 0) conditions.push(eq(adminAuditLogs.targetId, targetId));
  if (adminUserId.length > 0) conditions.push(eq(adminAuditLogs.adminUserId, adminUserId));

  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const logs = await db.query.adminAuditLogs.findMany({
    where: whereCondition,
    limit,
    offset,
    orderBy: [desc(adminAuditLogs.createdAt)],
  });

  const [totalRes] = await db.select({ value: count() }).from(adminAuditLogs).where(whereCondition);

  res.json({
    auditLogs: logs,
    pagination: { page, limit, total: totalRes?.value ?? 0 },
  });
});
