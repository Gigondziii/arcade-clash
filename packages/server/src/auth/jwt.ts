import "dotenv/config";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  dotenv.config({ path: "packages/server/.env" });
}

// A plain guarded const doesn't narrow to `string` inside functions defined
// later in the module (TS control-flow analysis doesn't carry across
// closures) — routing through a function with an explicit return type does.
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set — copy packages/server/.env.example to .env and fill it in.");
  }
  return secret;
}
const JWT_SECRET = requireJwtSecret();

const EXPIRES_IN = "7d";

export type SessionTokenPayload = {
  sub: string; // user id
};

export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionTokenPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "ac_session";
export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches EXPIRES_IN

export type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  domain?: string;
  maxAge?: number;
};

export function getSessionCookieOptions(): SessionCookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";
  const domain = process.env.COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    sameSite,
    secure: isProduction || sameSite === "none",
    domain,
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  };
}

export function getClearCookieOptions(): Partial<SessionCookieOptions> {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";
  const domain = process.env.COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    sameSite,
    secure: isProduction || sameSite === "none",
    domain,
  };
}

