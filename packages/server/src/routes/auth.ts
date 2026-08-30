import { CURRENT_POLICY_VERSIONS, type PolicyType, type PublicUser } from "@fugluck/shared";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { Router } from "express";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../auth/password";
import { getClearCookieOptions, getSessionCookieOptions, SESSION_COOKIE_NAME, signSessionToken } from "../auth/jwt";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { emailVerificationTokens, passwordResetTokens, policyAcceptances, users, type User } from "../db/schema";
import { ensureSignupGrant } from "../wallet/ledger";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";
import { sendPasswordResetEmail, sendVerificationEmail } from "../email/emailService";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function toPublicUser(user: User): Promise<PublicUser> {
  const balances = await ensureSignupGrant(user.id);
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    isEmailVerified: user.isEmailVerified ?? false,
    createdAt: user.createdAt.toISOString(),
    balances,
  };
}

function setSessionCookie(res: import("express").Response, userId: string) {
  const token = signSessionToken({ sub: userId });
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

const authLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: "Too many authentication attempts. Please try again later.",
});

const resendLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
  message: "Too many verification resend attempts. Please wait 15 minutes.",
});

const forgotPasswordLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: "Too many password reset requests. Please wait 15 minutes.",
});

export const authRouter = Router();

authRouter.get("/policies/versions", (_req, res) => {
  res.json({
    versions: CURRENT_POLICY_VERSIONS,
    requiredAtSignup: {
      terms: CURRENT_POLICY_VERSIONS.TERMS,
      privacy: CURRENT_POLICY_VERSIONS.PRIVACY,
    },
  });
});

authRouter.get("/policies/my-acceptances", attachSession, requireAuth, async (req, res) => {
  const acceptances = await db.query.policyAcceptances.findMany({
    where: eq(policyAcceptances.userId, req.userId!),
    orderBy: [desc(policyAcceptances.acceptedAt)],
  });
  res.json({ acceptances });
});

authRouter.post("/policies/accept", attachSession, requireAuth, async (req, res) => {
  const { policyType, policyVersion, source } = req.body ?? {};

  if (typeof policyType !== "string" || !(policyType in CURRENT_POLICY_VERSIONS)) {
    res.status(400).json({ error: "Invalid or unsupported policy type." });
    return;
  }
  const typedPolicy = policyType as PolicyType;
  const currentVersion = CURRENT_POLICY_VERSIONS[typedPolicy];
  if (typeof policyVersion !== "string" || policyVersion !== currentVersion) {
    res.status(400).json({
      error: `Policy version must match the current version (${currentVersion}).`,
      currentVersion,
    });
    return;
  }

  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = (req.headers["user-agent"] as string) || null;

  const id = `pa_${randomUUID()}`;
  await db.insert(policyAcceptances).values({
    id,
    userId: req.userId!,
    policyType: typedPolicy,
    policyVersion,
    source: typeof source === "string" ? source.slice(0, 32) : "user_action",
    ipAddress: clientIp,
    userAgent,
  });

  res.json({ success: true, id, policyType: typedPolicy, policyVersion });
});

authRouter.post("/signup", authLimiter, async (req, res) => {
  const { username, password, email, acceptedPolicies } = req.body ?? {};

  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." });
    return;
  }

  const passwordPolicy = validatePasswordPolicy(password);
  if (!passwordPolicy.valid) {
    res.status(400).json({ error: passwordPolicy.error });
    return;
  }
  if (email !== undefined && email !== null && (typeof email !== "string" || email.length > 255 || !email.includes("@"))) {
    res.status(400).json({ error: "Email must be valid and under 255 characters." });
    return;
  }

  // Server-side mandatory consent validation for current Terms & Privacy Policy
  if (
    !acceptedPolicies ||
    typeof acceptedPolicies !== "object" ||
    acceptedPolicies.termsVersion !== CURRENT_POLICY_VERSIONS.TERMS ||
    acceptedPolicies.privacyVersion !== CURRENT_POLICY_VERSIONS.PRIVACY
  ) {
    res.status(400).json({
      error: "You must agree to the current Terms of Service and acknowledge the Privacy Policy.",
      requiredVersions: {
        terms: CURRENT_POLICY_VERSIONS.TERMS,
        privacy: CURRENT_POLICY_VERSIONS.PRIVACY,
      },
    });
    return;
  }

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }

  if (email) {
    const existingEmail = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });
    if (existingEmail) {
      res.status(409).json({ error: "An account with that email already exists." });
      return;
    }
  }

  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = (req.headers["user-agent"] as string) || null;
  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  const [user] = await db
    .insert(users)
    .values({
      id,
      username,
      email: email ? email.trim() : null,
      passwordHash,
      isEmailVerified: false,
    })
    .returning();

  // Atomically record durable legal acceptance records for Terms and Privacy
  await db.insert(policyAcceptances).values([
    {
      id: `pa_${randomUUID()}`,
      userId: user.id,
      policyType: "TERMS",
      policyVersion: CURRENT_POLICY_VERSIONS.TERMS,
      source: "registration",
      ipAddress: clientIp,
      userAgent,
    },
    {
      id: `pa_${randomUUID()}`,
      userId: user.id,
      policyType: "PRIVACY",
      policyVersion: CURRENT_POLICY_VERSIONS.PRIVACY,
      source: "registration",
      ipAddress: clientIp,
      userAgent,
    },
  ]);

  // Create registration email verification token (24-hour expiration)
  const rawVerificationToken = randomUUID();
  const tokenHash = hashToken(rawVerificationToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(emailVerificationTokens).values({
    id: `evt_${randomUUID()}`,
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  // Dispatch transactional verification email if email provided
  if (user.email) {
    await sendVerificationEmail(user.email, user.username, rawVerificationToken).catch((err) => {
      console.error("[auth] Failed to dispatch verification email on signup:", err);
    });
  }

  setSessionCookie(res, user.id);

  const responsePayload: Record<string, unknown> = {
    user: await toPublicUser(user),
    verificationMessage: "Verification email sent. Please verify your email to complete registration.",
  };

  // Only expose raw token in non-production environments for automated testing/dev
  if (process.env.NODE_ENV !== "production") {
    responsePayload.verificationToken = rawVerificationToken;
  }

  res.status(201).json(responsePayload);
});

authRouter.post("/verify-email", async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "Verification token is required." });
    return;
  }

  const tokenHash = hashToken(token.trim());
  const record = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, tokenHash),
  });

  if (!record) {
    res.status(400).json({ error: "Invalid or expired verification token." });
    return;
  }

  if (Date.now() > record.expiresAt.getTime()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));
    res.status(400).json({ error: "Verification token has expired. Please request a new one." });
    return;
  }

  // Update user as verified
  const [updatedUser] = await db
    .update(users)
    .set({
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    })
    .where(eq(users.id, record.userId))
    .returning();

  // Delete used token (single-use enforcement)
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));

  res.json({
    message: "Email verified successfully.",
    user: await toPublicUser(updatedUser),
  });
});

authRouter.post("/resend-verification", resendLimiter, attachSession, async (req, res) => {
  const { email } = req.body ?? {};

  let user = null;
  if (req.userId) {
    user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  } else if (typeof email === "string" && email.trim().length > 0) {
    user = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });
  }

  let rawVerificationToken: string | undefined;
  if (user && !user.isEmailVerified && user.email) {
    // Delete any older verification tokens for this user
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id));

    rawVerificationToken = randomUUID();
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(emailVerificationTokens).values({
      id: `evt_${randomUUID()}`,
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await sendVerificationEmail(user.email, user.username, rawVerificationToken).catch((err) => {
      console.error("[auth] Failed to dispatch verification email on resend:", err);
    });
  }

  const responsePayload: Record<string, unknown> = {
    message: "If that account exists and is unverified, a verification link has been sent.",
  };

  if (process.env.NODE_ENV !== "production" && rawVerificationToken) {
    responsePayload.verificationToken = rawVerificationToken;
  }

  // Safe response regardless of account existence to prevent account enumeration
  res.json(responsePayload);
});

authRouter.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email, username } = req.body ?? {};

  let user = null;
  if (typeof email === "string" && email.trim().length > 0) {
    user = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });
  } else if (typeof username === "string" && username.trim().length > 0) {
    user = await db.query.users.findFirst({ where: eq(users.username, username.trim()) });
  }

  let rawResetToken: string | undefined;
  if (user && user.email && user.status !== "banned" && user.status !== "suspended") {
    // Invalidate any previous pending reset tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

    rawResetToken = randomUUID();
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour expiration

    await db.insert(passwordResetTokens).values({
      id: `prt_${randomUUID()}`,
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, user.username, rawResetToken).catch((err) => {
      console.error("[auth] Failed to dispatch password reset email:", err);
    });
  }

  const responsePayload: Record<string, unknown> = {
    message: "If that account exists, password reset instructions have been sent to the registered email.",
  };

  if (process.env.NODE_ENV !== "production" && rawResetToken) {
    responsePayload.resetToken = rawResetToken;
  }

  // Safe non-enumerating response
  res.json(responsePayload);
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const { token, newPassword } = req.body ?? {};

  if (typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }

  const passwordPolicy = validatePasswordPolicy(newPassword);
  if (!passwordPolicy.valid) {
    res.status(400).json({ error: passwordPolicy.error });
    return;
  }

  const tokenHash = hashToken(token.trim());
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!record) {
    res.status(400).json({ error: "Invalid or expired password reset link." });
    return;
  }

  if (Date.now() > record.expiresAt.getTime()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    res.status(400).json({ error: "Password reset link has expired. Please request a new one." });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  const newPasswordHash = await hashPassword(newPassword);

  // Update password and delete used token in transaction
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, record.userId));

    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
  });

  // Clear any existing session cookie so user must authenticate with new password
  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  res.json({ message: "Password reset successfully. You may now log in with your new password." });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  // Enforce account status check on login
  if (user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account suspended or banned." });
    return;
  }

  setSessionCookie(res, user.id);
  res.json({ user: await toPublicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  res.status(204).end();
});

authRouter.get("/me", attachSession, requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId!) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: await toPublicUser(user) });
});
