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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
