import type { FriendEntry } from "@fugluck/shared";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { Router } from "express";
import { attachSession, requireAuth, requireEmailVerified } from "../auth/middleware";
import { db } from "../db/client";
import { friendships, users } from "../db/schema";

import { createRateLimiterMiddleware } from "../utils/rateLimiter";

const socialLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: "Too many social actions. Please wait a moment.",
});

export const friendsRouter = Router();

friendsRouter.use(attachSession, requireAuth);

friendsRouter.get("/", async (req, res) => {
  const me = req.userId!;
  const rows = await db.query.friendships.findMany({
    where: or(eq(friendships.requesterId, me), eq(friendships.addresseeId, me)),
  });
  const active = rows.filter((r) => r.status !== "rejected");
  const otherIds = active.map((f) => (f.requesterId === me ? f.addresseeId : f.requesterId));
  const otherUsers =
    otherIds.length === 0
      ? []
      : await db.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, otherIds));
  const nameById = new Map(otherUsers.map((u) => [u.id, u.username]));

  const entries: FriendEntry[] = active.map((f) => {
    const iAmRequester = f.requesterId === me;
    const otherId = iAmRequester ? f.addresseeId : f.requesterId;
    let direction: FriendEntry["direction"];
    if (f.status === "accepted") direction = "friend";
    else direction = iAmRequester ? "outgoing" : "incoming";
    return {
      friendshipId: f.id,
      userId: otherId,
      username: nameById.get(otherId) ?? "unknown",
      direction,
      status: f.status as FriendEntry["status"],
      createdAt: f.createdAt.toISOString(),
    };
  });

  res.json({ friends: entries });
});

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

friendsRouter.post("/request", socialLimiter, requireEmailVerified, async (req, res) => {
  const me = req.userId!;
  const username = req.body?.username;
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." });
    return;
  }

  const target = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!target) {
    res.status(404).json({ error: "No user with that username." });
    return;
  }
  if (target.id === me) {
    res.status(400).json({ error: "You can't friend yourself." });
    return;
  }

  const existing = await db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, me), eq(friendships.addresseeId, target.id)),
      and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, me)),
    ),
  });

  if (existing) {
    if (existing.status === "accepted") {
      res.status(409).json({ error: "You're already friends." });
      return;
    }
    if (existing.status === "pending") {
      res.status(409).json({ error: "A friend request is already pending." });
      return;
    }
    // Previously rejected — allow a fresh request by updating the row.
    const [updated] = await db
      .update(friendships)
      .set({ status: "pending", requesterId: me, addresseeId: target.id, createdAt: new Date() })
      .where(eq(friendships.id, existing.id))
      .returning();
    res.status(201).json({
      friendship: {
        friendshipId: updated.id,
        userId: target.id,
        username: target.username,
        direction: "outgoing" as const,
        status: "pending" as const,
        createdAt: updated.createdAt.toISOString(),
      },
    });
    return;
  }

  const [created] = await db
    .insert(friendships)
    .values({ id: randomUUID(), requesterId: me, addresseeId: target.id, status: "pending" })
    .returning();

  res.status(201).json({
    friendship: {
      friendshipId: created.id,
      userId: target.id,
      username: target.username,
      direction: "outgoing" as const,
      status: "pending" as const,
      createdAt: created.createdAt.toISOString(),
    },
  });
});

friendsRouter.post("/:friendshipId/accept", socialLimiter, requireEmailVerified, async (req, res) => {
  const me = req.userId!;
  const friendshipId = String(req.params.friendshipId);
  const friendship = await db.query.friendships.findFirst({
    where: eq(friendships.id, friendshipId),
  });
  if (!friendship || friendship.addresseeId !== me || friendship.status !== "pending") {
    res.status(404).json({ error: "No pending request to accept." });
    return;
  }
  const [updated] = await db
    .update(friendships)
    .set({ status: "accepted" })
    .where(eq(friendships.id, friendship.id))
    .returning();
  res.json({ friendshipId: updated.id, status: updated.status });
});

friendsRouter.post("/:friendshipId/reject", socialLimiter, async (req, res) => {
  const me = req.userId!;
  const friendshipId = String(req.params.friendshipId);
  const friendship = await db.query.friendships.findFirst({
    where: eq(friendships.id, friendshipId),
  });
  if (!friendship || friendship.addresseeId !== me || friendship.status !== "pending") {
    res.status(404).json({ error: "No pending request to reject." });
    return;
  }
  await db.update(friendships).set({ status: "rejected" }).where(eq(friendships.id, friendship.id));
  res.status(204).end();
});

// Cancel outgoing pending friend request (requester only)
friendsRouter.delete("/:friendshipId/cancel", socialLimiter, async (req, res) => {
  const me = req.userId!;
  const friendshipId = String(req.params.friendshipId);
  const friendship = await db.query.friendships.findFirst({
    where: eq(friendships.id, friendshipId),
  });
  if (!friendship || friendship.requesterId !== me || friendship.status !== "pending") {
    res.status(404).json({ error: "No pending outgoing request found to cancel." });
    return;
  }
  await db.delete(friendships).where(eq(friendships.id, friendship.id));
  res.json({ success: true, friendshipId });
});

friendsRouter.post("/:friendshipId/cancel", socialLimiter, async (req, res) => {
  const me = req.userId!;
  const friendshipId = String(req.params.friendshipId);
  const friendship = await db.query.friendships.findFirst({
    where: eq(friendships.id, friendshipId),
  });
  if (!friendship || friendship.requesterId !== me || friendship.status !== "pending") {
    res.status(404).json({ error: "No pending outgoing request found to cancel." });
    return;
  }
  await db.delete(friendships).where(eq(friendships.id, friendship.id));
  res.json({ success: true, friendshipId });
});

// Remove / Unfriend accepted friendship (either participant)
friendsRouter.delete("/:friendshipId", socialLimiter, async (req, res) => {
  const me = req.userId!;
  const friendshipId = String(req.params.friendshipId);
  const friendship = await db.query.friendships.findFirst({
    where: eq(friendships.id, friendshipId),
  });
  if (!friendship || (friendship.requesterId !== me && friendship.addresseeId !== me) || friendship.status !== "accepted") {
    res.status(404).json({ error: "Friendship not found or not accepted." });
    return;
  }
  await db.delete(friendships).where(eq(friendships.id, friendship.id));
  res.json({ success: true, friendshipId });
});

