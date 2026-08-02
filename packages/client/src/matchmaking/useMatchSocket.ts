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

export type MatchSocketMode =
  | { kind: 'queue' }
  | { kind: 'sendInvite'; friendUserId: string }
  | { kind: 'acceptInvite'; inviteId: string }

export type UseMatchSocketResult = {
  connectionState: MatchmakingConnectionState
  match: MatchedPayload | null
  resolution: MatchResolvedPayload | null
  error: string | null
  waitingLabel: string | null
  submitScore: (payload: SubmitScorePayload) => void
  // Evidence-only, fire-and-forget — see PROGRESS.md's freeze-frame Known
  // Gaps entry. No-ops if there's no active match yet (nothing to report
  // against).
  reportVisibilityHidden: (matchId: string) => void
  disconnect: () => void
}

// Owns exactly one socket connection for one matchmaking attempt — queue,
// outbound friend invite, or accept-invite. Connect on mount, act, disconnect
// on unmount. Same lifecycle as before; mode only changes the first emit.
export function useMatchSocket(gameId: string, mode: MatchSocketMode = { kind: 'queue' }): UseMatchSocketResult {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [connectionState, setConnectionState] = useState<MatchmakingConnectionState>('connecting')
  const [match, setMatch] = useState<MatchedPayload | null>(null)
  const [resolution, setResolution] = useState<MatchResolvedPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waitingLabel, setWaitingLabel] = useState<string | null>(null)

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, { withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnectionState('queued')
      if (mode.kind === 'queue') {
        setWaitingLabel('Looking for an opponent…')
        socket.emit('joinQueue', { gameId })
      } else if (mode.kind === 'sendInvite') {
        setWaitingLabel('Sending invite…')
        socket.emit('inviteFriend', { friendUserId: mode.friendUserId, gameId })
      } else {
        setWaitingLabel('Joining match…')
        socket.emit('respondInvite', { inviteId: mode.inviteId, accept: true })
      }
    })

    socket.on('inviteSent', (payload) => {
      setWaitingLabel(`Waiting for ${payload.toUsername} to accept…`)
    })

    socket.on('inviteRejected', (payload) => {
      setError(payload.reason || 'Invite was declined.')
      setConnectionState('closed')
    })

    socket.on('inviteError', (payload) => {
      setError(payload.message)
      setConnectionState('closed')
    })

    socket.on('matched', (payload) => {
      setConnectionState('matched')
      setWaitingLabel(null)
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
      if (mode.kind === 'sendInvite') {
        // Best-effort cancel so the friend isn't left with a dead invite.
        // inviteId isn't always known here; server clears outbound on disconnect.
      }
      socket.disconnect()
      socketRef.current = null
    }
    // Mode/gameId are fixed for the lifetime of one MatchLoader instance.
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

  return {
    connectionState,
    match,
    resolution,
    error,
    waitingLabel,
    submitScore,
    reportVisibilityHidden,
    disconnect,
  }
}
