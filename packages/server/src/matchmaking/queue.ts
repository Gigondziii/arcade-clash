import { randomInt } from "node:crypto";
import { gameRegistry } from "@arcadeclash/games";
import type { MatchmakingSocket } from "./socketAuth";

export type QueueEntry = {
  socket: MatchmakingSocket;
  userId: string;
  username: string;
};

const VALID_GAME_IDS = new Set(gameRegistry.map((g) => g.id));

// In-memory only — "for fun" matches don't need durability, and a single
// Node process is the whole deployment for now. See PROGRESS.md for what
// this means on a server restart (queued/in-progress state is simply gone).
const queues = new Map<string, QueueEntry[]>();

export function isValidGameId(gameId: string): boolean {
  return VALID_GAME_IDS.has(gameId);
}

// Server-generated, cryptographically unpredictable — the whole point of
// moving this off the client is that nothing about it should be guessable or
// reproducible by a player trying to shop for an easy course.
export function generateSeed(): number {
  return randomInt(0x100000000);
}

// Adds socket to gameId's queue. Any earlier entry for the same userId is
// dropped first (e.g. a stale second tab) so a userId never appears twice in
// one queue — that invariant is what makes tryPair's self-match guard free
// (see below) rather than something it has to check per-pair.
export function enqueue(gameId: string, socket: MatchmakingSocket): void {
  const entries = queues.get(gameId) ?? [];
  const withoutStale = entries.filter((e) => e.userId !== socket.data.userId);
  withoutStale.push({ socket, userId: socket.data.userId, username: socket.data.username });
  queues.set(gameId, withoutStale);
}

// Pops the two longest-waiting entries for gameId, if at least two are
// present. Because enqueue guarantees at most one entry per userId per queue,
// any two distinct entries here already belong to different players — no
// separate self-match check needed. Returns null if fewer than two are
// queued yet.
export function tryPair(gameId: string): [QueueEntry, QueueEntry] | null {
  const entries = queues.get(gameId);
  if (!entries || entries.length < 2) return null;
  const [a, b, ...rest] = entries;
  queues.set(gameId, rest);
  return [a, b];
}

// Removes a socket from whichever queue it's sitting in, if any. Safe to call
// unconditionally (e.g. from disconnect cleanup) — no-ops if not queued.
// Covers both "player clicked Cancel" and "player disconnected while
// queued," since both tear down the socket the same way.
export function removeFromQueue(socket: MatchmakingSocket): void {
  for (const [gameId, entries] of queues) {
    const next = entries.filter((e) => e.socket !== socket);
    if (next.length !== entries.length) queues.set(gameId, next);
  }
}
