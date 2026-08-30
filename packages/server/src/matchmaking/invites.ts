import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db/client";
import { friendships } from "../db/schema";
import { createMatch, getMatchIdForSocket } from "./matches";
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

  parkGuestLinkForReconnect(socket);
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
    currency: "COINS",
    stake: 0,
  };
  const b: QueueEntry = {
    socket,
    userId: socket.data.userId,
    username: socket.data.username,
    currency: "COINS",
    stake: 0,
  };

  clearInvite(invite, false);
  void createMatch(invite.gameId, a, b, generateSeed());
}

export function handleCancelInvite(socket: MatchmakingSocket, payload: { inviteId?: unknown }): void {
  if (!payload || typeof payload.inviteId !== "string") return;
  const invite = pendingById.get(payload.inviteId);
  if (!invite || invite.from !== socket) return;
  const target = getOnlineSocket(invite.toUserId);
  clearInvite(invite, false);
  target?.emit("inviteRejected", { inviteId: payload.inviteId, reason: "Invite cancelled." });
}

export const GUEST_LINK_TTL_MS = 600_000; // 10 minutes
export const GUEST_LINK_RECONNECT_GRACE_MS = 45_000;

type GuestInviteLink = {
  code: string;
  hostUserId: string;
  hostUsername: string;
  hostSocket: MatchmakingSocket | null;
  gameId: string;
  createdAt: number;
  expiresAt: number;
  ttlTimer: ReturnType<typeof setTimeout>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pendingJoiner: MatchmakingSocket | null;
};

const guestLinksByCode = new Map<string, GuestInviteLink>();
const guestLinksByUserId = new Map<string, string>();

function generateGuestCode(): string {
  for (let i = 0; i < 8; i++) {
    const code = randomUUID().replace(/-/g, "").slice(0, 12);
    if (!guestLinksByCode.has(code)) return code;
  }
  return randomUUID().replace(/-/g, "");
}

function destroyGuestLink(link: GuestInviteLink, pendingReason?: string): void {
  clearTimeout(link.ttlTimer);
  if (link.reconnectTimer) {
    clearTimeout(link.reconnectTimer);
    link.reconnectTimer = null;
  }
  guestLinksByCode.delete(link.code);
  if (guestLinksByUserId.get(link.hostUserId) === link.code) {
    guestLinksByUserId.delete(link.hostUserId);
  }
  const pending = link.pendingJoiner;
  link.pendingJoiner = null;
  if (pendingReason && pending?.connected) {
    pending.emit("inviteError", { message: pendingReason });
  }
}

function emitGuestLinkCreated(socket: MatchmakingSocket, link: GuestInviteLink): void {
  socket.emit("inviteSent", {
    inviteId: link.code,
    gameId: link.gameId,
    toUsername: "Guest Link",
  });
  socket.emit("guestLinkCreated", {
    code: link.code,
    gameId: link.gameId,
    expiresAt: link.expiresAt,
  });
}

function startGuestMatch(link: GuestInviteLink, guest: MatchmakingSocket): void {
  const host = link.hostSocket;
  if (!host || !host.connected) {
    if (link.pendingJoiner && link.pendingJoiner !== guest && link.pendingJoiner.connected) {
      guest.emit("inviteError", { message: "Someone else is already joining this link." });
      return;
    }
    link.pendingJoiner = guest;
    guest.emit("guestLinkPending", { message: "Waiting for the host to reconnect…" });
    return;
  }

  if (host.data.userId === guest.data.userId) {
    guest.emit("inviteError", { message: "You cannot join your own guest link." });
    return;
  }

  removeFromQueue(host);
  removeFromQueue(guest);

  const a: QueueEntry = {
    socket: host,
    userId: host.data.userId,
    username: host.data.username,
    currency: "COINS",
    stake: 0,
  };
  const b: QueueEntry = {
    socket: guest,
    userId: guest.data.userId,
    username: guest.data.username,
    currency: "COINS",
    stake: 0,
  };

  const gameId = link.gameId;
  destroyGuestLink(link);
  void createMatch(gameId, a, b, generateSeed());
}

function parkGuestLinkForReconnect(socket: MatchmakingSocket): void {
  const code = guestLinksByUserId.get(socket.data.userId);
  if (!code) return;
  const link = guestLinksByCode.get(code);
  if (!link || (link.hostSocket && link.hostSocket !== socket)) return;

  link.hostSocket = null;
  if (link.reconnectTimer) clearTimeout(link.reconnectTimer);
  link.reconnectTimer = setTimeout(() => {
    const active = guestLinksByCode.get(code);
    if (active && !active.hostSocket?.connected) {
      destroyGuestLink(active, "Guest invite link expired or host is offline.");
    }
  }, GUEST_LINK_RECONNECT_GRACE_MS);
}

export function getGuestLinkInfo(code: string): {
  valid: boolean;
  gameId?: string;
  hostUsername?: string;
  hostOnline?: boolean;
  error?: string;
} {
  const link = guestLinksByCode.get(code);
  if (!link) {
    return { valid: false, error: "Guest invite link expired or host is offline." };
  }
  return {
    valid: true,
    gameId: link.gameId,
    hostUsername: link.hostUsername,
    hostOnline: Boolean(link.hostSocket?.connected),
  };
}

export function handleCancelGuestLink(socket: MatchmakingSocket): void {
  const code = guestLinksByUserId.get(socket.data.userId);
  if (!code) return;
  const link = guestLinksByCode.get(code);
  if (!link) return;
  destroyGuestLink(link, "The host cancelled this invite.");
}

export function handleCreateGuestLink(socket: MatchmakingSocket, payload: { gameId?: unknown }): void {
  if (getMatchIdForSocket(socket)) return;
  if (!payload || typeof payload.gameId !== "string" || !isValidGameId(payload.gameId)) {
    socket.emit("inviteError", { message: "Invalid game for guest link." });
    return;
  }

  const existingCode = guestLinksByUserId.get(socket.data.userId);
  if (existingCode) {
    const existing = guestLinksByCode.get(existingCode);
    if (existing && existing.gameId === payload.gameId) {
      existing.hostSocket = socket;
      existing.hostUsername = socket.data.username;
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer);
        existing.reconnectTimer = null;
      }
      emitGuestLinkCreated(socket, existing);
      if (existing.pendingJoiner?.connected) {
        const joiner = existing.pendingJoiner;
        existing.pendingJoiner = null;
        startGuestMatch(existing, joiner);
      }
      return;
    }
    if (existing) destroyGuestLink(existing, "The host started a new invite.");
  }

  const code = generateGuestCode();
  const expiresAt = Date.now() + GUEST_LINK_TTL_MS;
  const ttlTimer = setTimeout(() => {
    const active = guestLinksByCode.get(code);
    if (active) destroyGuestLink(active, "Guest invite link expired or host is offline.");
  }, GUEST_LINK_TTL_MS);

  const link: GuestInviteLink = {
    code,
    hostUserId: socket.data.userId,
    hostUsername: socket.data.username,
    hostSocket: socket,
    gameId: payload.gameId,
    createdAt: Date.now(),
    expiresAt,
    ttlTimer,
    reconnectTimer: null,
    pendingJoiner: null,
  };
  guestLinksByCode.set(code, link);
  guestLinksByUserId.set(socket.data.userId, code);
  emitGuestLinkCreated(socket, link);
}

export function handleJoinGuestLink(socket: MatchmakingSocket, payload: { code?: unknown }): void {
  if (getMatchIdForSocket(socket)) return;
  if (!payload || typeof payload.code !== "string") {
    socket.emit("inviteError", { message: "Invalid guest link code." });
    return;
  }

  const link = guestLinksByCode.get(payload.code);
  if (!link) {
    socket.emit("inviteError", { message: "Guest invite link expired or host is offline." });
    return;
  }

  startGuestMatch(link, socket);
}
