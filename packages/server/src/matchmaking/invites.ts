import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db/client";
import { friendships } from "../db/schema";
import { createMatch } from "./matches";
import { getOnlineSocket } from "./presence";
import { generateSeed, isValidGameId, removeFromQueue, type QueueEntry } from "./queue";
import type { MatchmakingSocket } from "./socketAuth";

const INVITE_TTL_MS = 60_000;

type PendingInvite = {
  id: string;
  from: MatchmakingSocket;
  toUserId: string;
  gameId: string;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const pendingById = new Map<string, PendingInvite>();
// At most one outbound invite per inviter socket.
const pendingByFromSocket = new Map<MatchmakingSocket, string>();

async function areFriends(a: string, b: string): Promise<boolean> {
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, "accepted"),
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
      ),
    ),
  });
  return Boolean(row);
}

function clearInvite(invite: PendingInvite, notifyFrom: boolean, reason?: string): void {
  clearTimeout(invite.timer);
  pendingById.delete(invite.id);
  if (pendingByFromSocket.get(invite.from) === invite.id) {
    pendingByFromSocket.delete(invite.from);
  }
  if (notifyFrom && invite.from.connected && reason) {
    invite.from.emit("inviteRejected", { inviteId: invite.id, reason });
  }
}

export function cancelInvitesForSocket(socket: MatchmakingSocket): void {
  // Only clear invites this socket sent. Do NOT clear invites addressed to
  // this userId — the invitee may disconnect a presence socket and
  // immediately reconnect in MatchLoader to accept.
  const outboundId = pendingByFromSocket.get(socket);
  if (outboundId) {
    const invite = pendingById.get(outboundId);
    if (invite) {
      const target = getOnlineSocket(invite.toUserId);
      clearInvite(invite, false);
      target?.emit("inviteRejected", { inviteId: invite.id, reason: "Inviter went offline." });
    }
  }
}

export async function handleInviteFriend(
  socket: MatchmakingSocket,
  payload: { friendUserId?: unknown; gameId?: unknown },
): Promise<void> {
  if (!payload || typeof payload.friendUserId !== "string" || typeof payload.gameId !== "string") {
    socket.emit("inviteError", { message: "Invalid invite." });
    return;
  }
  if (!isValidGameId(payload.gameId)) {
    socket.emit("inviteError", { message: "Unknown game." });
    return;
  }
  if (payload.friendUserId === socket.data.userId) {
    socket.emit("inviteError", { message: "You can't invite yourself." });
    return;
  }
  if (!(await areFriends(socket.data.userId, payload.friendUserId))) {
    socket.emit("inviteError", { message: "You can only invite accepted friends." });
    return;
  }

  const target = getOnlineSocket(payload.friendUserId);
  if (!target) {
    socket.emit("inviteError", { message: "That friend is offline." });
    return;
  }

  // Replace any prior outbound invite from this socket.
  const priorId = pendingByFromSocket.get(socket);
  if (priorId) {
    const prior = pendingById.get(priorId);
    if (prior) clearInvite(prior, false);
  }

  const inviteId = randomUUID();
  const timer = setTimeout(() => {
    const invite = pendingById.get(inviteId);
    if (invite) clearInvite(invite, true, "Invite expired.");
  }, INVITE_TTL_MS);

  const invite: PendingInvite = {
    id: inviteId,
    from: socket,
    toUserId: payload.friendUserId,
    gameId: payload.gameId,
    expiresAt: Date.now() + INVITE_TTL_MS,
    timer,
  };
  pendingById.set(inviteId, invite);
  pendingByFromSocket.set(socket, inviteId);

  socket.emit("inviteSent", {
    inviteId,
    gameId: payload.gameId,
    toUsername: target.data.username,
  });
  target.emit("inviteReceived", {
    inviteId,
    fromUserId: socket.data.userId,
    fromUsername: socket.data.username,
    gameId: payload.gameId,
  });
}

export function handleRespondInvite(
  socket: MatchmakingSocket,
  payload: { inviteId?: unknown; accept?: unknown },
): void {
  if (!payload || typeof payload.inviteId !== "string" || typeof payload.accept !== "boolean") {
    socket.emit("inviteError", { message: "Invalid invite response." });
    return;
  }

  const invite = pendingById.get(payload.inviteId);
  if (!invite || invite.toUserId !== socket.data.userId) {
    socket.emit("inviteError", { message: "Invite not found or expired." });
    return;
  }

  if (!payload.accept) {
    clearInvite(invite, true, "Invite declined.");
    return;
  }

  if (!invite.from.connected) {
    clearInvite(invite, false);
    socket.emit("inviteError", { message: "Inviter went offline." });
    return;
  }

  // Pull both out of any random queue before starting the private match.
  removeFromQueue(invite.from);
  removeFromQueue(socket);

  const a: QueueEntry = {
    socket: invite.from,
    userId: invite.from.data.userId,
    username: invite.from.data.username,
  };
  const b: QueueEntry = {
    socket,
    userId: socket.data.userId,
    username: socket.data.username,
  };

  clearInvite(invite, false);
  createMatch(invite.gameId, a, b, generateSeed());
}

export function handleCancelInvite(socket: MatchmakingSocket, payload: { inviteId?: unknown }): void {
  if (!payload || typeof payload.inviteId !== "string") return;
  const invite = pendingById.get(payload.inviteId);
  if (!invite || invite.from !== socket) return;
  const target = getOnlineSocket(invite.toUserId);
  clearInvite(invite, false);
  target?.emit("inviteRejected", { inviteId: payload.inviteId, reason: "Invite cancelled." });
}
