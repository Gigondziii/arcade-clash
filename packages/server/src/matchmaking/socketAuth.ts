import { randomUUID } from "node:crypto";
import type { ClientToServerEvents, ServerToClientEvents } from "@fugluck/shared";
import { eq } from "drizzle-orm";
import type { DefaultEventsMap, Socket } from "socket.io";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../auth/jwt";
import { db } from "../db/client";
import { users } from "../db/schema";

// The trust boundary: userId comes from the verified session cookie, and
// username is looked up here from that same verified userId — never taken
// from anything the client sends over the socket. Unauthenticated guests
// are issued ephemeral guest_ IDs for zero-registration instant play.
export type MatchmakingSocketData = {
  userId: string;
  username: string;
  isGuest?: boolean;
  isEmailVerified?: boolean;
};

export type MatchmakingSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, MatchmakingSocketData>;

function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = part.slice(0, separatorIndex).trim();
    if (name === SESSION_COOKIE_NAME) return part.slice(separatorIndex + 1).trim();
  }
  return null;
}

function sanitizeGuestId(raw: string | undefined): string {
  const cleaned = typeof raw === "string" ? raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) : "";
  if (cleaned.length >= 6) return cleaned;
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function extractSessionToken(socket: MatchmakingSocket): string | null {
  const cookieToken = extractSessionCookie(socket.handshake.headers.cookie);
  if (cookieToken) return cookieToken;

  const handshakeAuth = socket.handshake.auth as { token?: string } | undefined;
  if (handshakeAuth?.token) return handshakeAuth.token;

  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

// Socket.IO connection middleware — mirrors attachSession + requireAuth from
// the Express auth middleware, applied to the handshake instead of a request.
// Allows unauthenticated guests with ephemeral IDs for Free-Play instant matches.
export async function socketAuthMiddleware(socket: MatchmakingSocket, next: (err?: Error) => void): Promise<void> {
  const token = extractSessionToken(socket);
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    // Unauthenticated connections are guests. Instant invite links and free
    // play must work without a prior login — requiring an explicit `isGuest`
    // handshake flag made copied links fail for anyone who wasn't already
    // signed in.
    const handshakeAuth = socket.handshake.auth as { guestId?: string } | undefined;
    const handshakeQuery = socket.handshake.query as { guestId?: string } | undefined;
    const rawId = sanitizeGuestId(handshakeAuth?.guestId || handshakeQuery?.guestId);
    socket.data.userId = `guest_${rawId}`;
    socket.data.username = `Guest_${rawId.slice(0, 4)}`;
    socket.data.isGuest = true;
    socket.data.isEmailVerified = false;
    next();
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
  if (!user) {
    next(new Error("unauthorized"));
    return;
  }

  if (user.status === "banned" || user.status === "suspended") {
    next(new Error("account_suspended"));
    return;
  }

  socket.data.userId = user.id;
  socket.data.username = user.username;
  socket.data.isGuest = false;
  socket.data.isEmailVerified = user.isEmailVerified ?? false;
  next();
}
