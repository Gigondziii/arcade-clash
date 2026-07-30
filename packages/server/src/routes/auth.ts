import type { PublicUser } from "@arcadeclash/shared";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { hashPassword, verifyPassword } from "../auth/password";
import { SESSION_COOKIE_MAX_AGE_MS, SESSION_COOKIE_NAME, signSessionToken } from "../auth/jwt";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { users, type User } from "../db/schema";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    createdAt: user.createdAt.toISOString(),
  };
}

function setSessionCookie(res: import("express").Response, userId: string) {
  const token = signSessionToken({ sub: userId });
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
}

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { username, password, email } = req.body ?? {};

  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." });
    return;
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    return;
  }
  if (email !== undefined && email !== null && (typeof email !== "string" || !email.includes("@"))) {
    res.status(400).json({ error: "Email looks invalid." });
    return;
  }

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const [user] = await db
    .insert(users)
    .values({ id, username, email: email || null, passwordHash })
    .returning();

  setSessionCookie(res, user.id);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post("/login", async (req, res) => {
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

  setSessionCookie(res, user.id);
  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).end();
});

authRouter.get("/me", attachSession, requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId!) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: toPublicUser(user) });
});
