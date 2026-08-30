import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./jwt";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Attaches req.userId when a valid session cookie is present; never blocks
// the request. Use requireAuth for routes that must reject unauthenticated
// requests outright.
export function attachSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const payload = token ? verifySessionToken(token) : null;
  if (payload) req.userId = payload.sub;
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account suspended or banned." });
    return;
  }

  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  if (user.role !== "OWNER" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && user.role !== "MODERATOR" && user.role !== "SUPPORT") {
    res.status(403).json({ error: "Forbidden: Administrative privilege required." });
    return;
  }

  next();
}

export const ADMIN_SESSION_COOKIE_NAME = "ac_admin_session";

export async function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.isEmailVerified) {
    res.status(403).json({ error: "Email verification required to access this feature." });
    return;
  }

  next();
}

export async function requireOwnerAdmin(req: Request, res: Response, next: NextFunction) {
  const adminToken = req.cookies?.[ADMIN_SESSION_COOKIE_NAME];
  const payload = adminToken ? verifySessionToken(adminToken) : null;

  if (!payload || !payload.sub) {
    res.status(401).json({ error: "Not authenticated as administrator" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  if (user.role !== "OWNER" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden: Owner administrative privilege required." });
    return;
  }

  req.userId = user.id;
  next();
}
