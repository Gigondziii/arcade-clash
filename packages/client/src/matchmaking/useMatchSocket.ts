import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientToServerEvents,
  MatchedPayload,
  MatchResolvedPayload,
  ServerToClientEvents,
  SubmitScorePayload,
} from '@arcadeclash/shared'
import { io, type Socket } from 'socket.io-client'
import { API_URL } from '../lib/api'

export type MatchmakingConnectionState = 'connecting' | 'queued' | 'matched' | 'closed'

export type UseMatchSocketResult = {
  connectionState: MatchmakingConnectionState
  match: MatchedPayload | null
  resolution: MatchResolvedPayload | null
  error: string | null
  submitScore: (payload: SubmitScorePayload) => void
  // Evidence-only, fire-and-forget — see PROGRESS.md's freeze-frame Known
  // Gaps entry. No-ops if there's no active match yet (nothing to report
  // against).
  reportVisibilityHidden: (matchId: string) => void
  disconnect: () => void
}

// Owns exactly one socket connection for one "find opponent" attempt — the
// socket's lifetime IS the queue/match membership (see PROGRESS.md): connect
// on mount, join the queue immediately, disconnect on unmount. Cancelling
// mid-queue and leaving mid-match are both just "stop rendering this," which
// tears the socket down the same way a network drop would — one code path,
// covered server-side by matches.ts's disconnect handler either way.
//
// Deliberately doesn't track a "playing" phase — that's MatchLoader's own
// concern (has it mounted the GameModule yet), not something the transport
// layer needs an opinion on. This hook only reports what the server told it:
// queued, matched, resolved, or errored. ("ended" — a disconnect voiding the
// match — no longer exists as a distinct terminal state; a mid-match
// disconnect now resolves via matchResolved like anything else, see
// PROGRESS.md's session log.)
export function useMatchSocket(gameId: string): UseMatchSocketResult {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [connectionState, setConnectionState] = useState<MatchmakingConnectionState>('connecting')
  const [match, setMatch] = useState<MatchedPayload | null>(null)
  const [resolution, setResolution] = useState<MatchResolvedPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, { withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionState('queued')
      socket.emit('joinQueue', { gameId })
    })

    socket.on('matched', (payload) => {
      setConnectionState('matched')
      setMatch(payload)
    })

    socket.on('matchResolved', (payload) => {
      setResolution(payload)
    })

    socket.on('queueError', (payload) => {
      setError(payload.message)
    })

    socket.on('connect_error', (err) => {
      setError(err.message || 'Could not connect to matchmaking.')
      setConnectionState('closed')
    })

    socket.on('disconnect', () => {
      setConnectionState('closed')
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
    // gameId is fixed for the lifetime of one find-opponent attempt — a
    // different game means a fresh MatchLoader instance (new key), not a
    // reconnect of this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitScore = useCallback((payload: SubmitScorePayload) => {
    socketRef.current?.emit('submitScore', payload)
  }, [])

  const reportVisibilityHidden = useCallback((matchId: string) => {
    socketRef.current?.emit('visibilityHidden', { matchId })
  }, [])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
  }, [])

  return { connectionState, match, resolution, error, submitScore, reportVisibilityHidden, disconnect }
}
