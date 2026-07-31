import type { ClientToServerEvents, ServerToClientEvents } from "@arcadeclash/shared";
import { eq } from "drizzle-orm";
import type { DefaultEventsMap, Socket } from "socket.io";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../auth/jwt";
import { db } from "../db/client";
import { users } from "../db/schema";

// The trust boundary: userId comes from the verified session cookie, and
// username is looked up here from that same verified userId — never taken
// from anything the client sends over the socket. A client can't put words
// in another player's mouth by claiming their display name.
export type MatchmakingSocketData = {
  userId: string;
  username: string;
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

// Socket.IO connection middleware — mirrors attachSession + requireAuth from
// the Express auth middleware, applied to the handshake instead of a request.
// Rejects the connection outright rather than letting an unauthenticated
// socket through, since every event in this namespace requires a real player.
export async function socketAuthMiddleware(socket: MatchmakingSocket, next: (err?: Error) => void): Promise<void> {
  const token = extractSessionCookie(socket.handshake.headers.cookie);
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    next(new Error("unauthorized"));
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
  if (!user) {
    next(new Error("unauthorized"));
    return;
  }

  socket.data.userId = user.id;
  socket.data.username = user.username;
  next();
}
