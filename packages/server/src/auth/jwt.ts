import jwt from "jsonwebtoken";

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
