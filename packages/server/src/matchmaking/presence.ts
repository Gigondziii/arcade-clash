import type { MatchmakingSocket } from "./socketAuth";

// userId -> currently connected matchmaking socket. One socket per user —
// a newer connection replaces the older one (second tab wins). Used for
// friend invites; queue pairing still uses the per-game queues.
const online = new Map<string, MatchmakingSocket>();

export function registerPresence(socket: MatchmakingSocket): void {
  const previous = online.get(socket.data.userId);
  if (previous && previous !== socket) {
    // Don't disconnect the old socket here — its own disconnect handler
    // will clean up queue/match state. Just stop routing invites to it.
  }
  online.set(socket.data.userId, socket);
}

export function unregisterPresence(socket: MatchmakingSocket): void {
  const current = online.get(socket.data.userId);
  if (current === socket) online.delete(socket.data.userId);
}

export function getOnlineSocket(userId: string): MatchmakingSocket | undefined {
  const socket = online.get(userId);
  if (!socket || !socket.connected) {
    if (socket) online.delete(userId);
    return undefined;
  }
  return socket;
}
