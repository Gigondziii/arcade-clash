import { randomInt } from "node:crypto";
import { gameRegistry } from "@fugluck/games";
import type { QueueStateEntry } from "@fugluck/shared";
import type { MatchmakingSocket } from "./socketAuth";

export type QueueEntry = {
  socket: MatchmakingSocket;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  currency: "COINS" | "DIAMONDS";
  stake: number;
  queuedAt?: number;
};

const VALID_GAME_IDS = new Set(gameRegistry.map((g) => g.id));

const queues = new Map<string, QueueEntry[]>();

type QueueChangeListener = () => void;
let queueChangeListener: QueueChangeListener | null = null;

export function setOnQueueChange(listener: QueueChangeListener | null): void {
  queueChangeListener = listener;
}

function notifyQueueChange(): void {
  if (queueChangeListener) {
    try {
      queueChangeListener();
    } catch (err) {
      console.error("[queue] Error in queue change listener:", err);
    }
  }
}

export function isValidGameId(gameId: string): boolean {
  return VALID_GAME_IDS.has(gameId);
}

export function generateSeed(): number {
  return randomInt(0x7fffffff);
}

export function makeQueueKey(gameId: string, currency: "COINS" | "DIAMONDS" = "COINS", stake: number = 0): string {
  return `${gameId}:${currency}:${stake}`;
}

export function getPublicQueueState(): QueueStateEntry[] {
  const publicEntries: QueueStateEntry[] = [];
  for (const [key, entries] of queues) {
    const gameId = key.split(":")[0];
    for (const e of entries) {
      publicEntries.push({
        socketId: e.socket.id,
        userId: e.userId,
        username: e.username,
        avatarUrl: e.avatarUrl ?? null,
        gameId,
        currency: e.currency,
        stake: e.stake,
        queuedAt: e.queuedAt ?? Date.now(),
      });
    }
  }
  return publicEntries;
}

export function enqueue(
  gameId: string,
  socket: MatchmakingSocket,
  currency: "COINS" | "DIAMONDS" = "COINS",
  stake: number = 0,
): void {
  const key = makeQueueKey(gameId, currency, stake);
  const entries = queues.get(key) ?? [];
  const withoutStale = entries.filter((e) => e.userId !== socket.data.userId);
  withoutStale.push({
    socket,
    userId: socket.data.userId,
    username: socket.data.username,
    currency,
    stake,
    queuedAt: Date.now(),
  });
  queues.set(key, withoutStale);
  notifyQueueChange();
}

export function tryPair(
  gameId: string,
  currency: "COINS" | "DIAMONDS" = "COINS",
  stake: number = 0,
): [QueueEntry, QueueEntry] | null {
  const key = makeQueueKey(gameId, currency, stake);
  const entries = queues.get(key);
  if (!entries || entries.length < 2) return null;
  const [a, b, ...rest] = entries;
  queues.set(key, rest);
  notifyQueueChange();
  return [a, b];
}

export function removeFromQueue(socket: MatchmakingSocket): void {
  let changed = false;
  for (const [key, entries] of queues) {
    const next = entries.filter((e) => e.socket !== socket);
    if (next.length !== entries.length) {
      queues.set(key, next);
      changed = true;
    }
  }
  if (changed) {
    notifyQueueChange();
  }
}
