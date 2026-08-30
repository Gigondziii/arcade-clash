import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientToServerEvents,
  MatchedPayload,
  MatchResolvedPayload,
  RematchOfferedPayload,
  ServerToClientEvents,
  SubmitScorePayload,
} from '@fugluck/shared'
import { io, type Socket } from 'socket.io-client'
import { API_URL } from '../lib/api'
import { getStoredAuthToken } from '../auth/AuthContext'
import { getOrCreateGuestId } from '../lib/guestId'

export type MatchmakingConnectionState = 'connecting' | 'queued' | 'matched' | 'reconnecting' | 'closed'

export type MatchSocketMode =
  | { kind: 'queue'; stake?: number; currency?: 'COINS' | 'DIAMONDS' }
  | { kind: 'sendInvite'; friendUserId: string }
  | { kind: 'acceptInvite'; inviteId: string }
  | { kind: 'createGuest' }
  | { kind: 'joinGuest'; code: string }
  | { kind: 'resume' }

export type RematchState =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'offered'; fromUsername: string }
  | { kind: 'unavailable'; reason: string }

export type UseMatchSocketResult = {
  connectionState: MatchmakingConnectionState
  match: MatchedPayload | null
  resolution: MatchResolvedPayload | null
  error: string | null
  waitingLabel: string | null
  guestLinkCode: string | null
  rematchState: RematchState
  submitScore: (payload: SubmitScorePayload) => void
  // Evidence-only, fire-and-forget — see PROGRESS.md's freeze-frame Known
  // Gaps entry. No-ops if there's no active match yet (nothing to report
  // against).
  reportVisibilityHidden: (matchId: string) => void
  requestRematch: () => void
  declineRematch: () => void
  disconnect: () => void
}

// Owns exactly one socket connection for one matchmaking attempt — queue,
// outbound friend invite, accept-invite, or guest link. Connect on mount, act, disconnect
// on unmount. Same lifecycle as before; mode only changes the first emit.
export function useMatchSocket(gameId: string, mode: MatchSocketMode = { kind: 'queue' }): UseMatchSocketResult {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const intentionalDisconnectRef = useRef(false)
  const resolutionMatchIdRef = useRef<string | null>(null)
  const hasMatchRef = useRef(false)
  const [connectionState, setConnectionState] = useState<MatchmakingConnectionState>('connecting')
  const [match, setMatch] = useState<MatchedPayload | null>(null)
  const [resolution, setResolution] = useState<MatchResolvedPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waitingLabel, setWaitingLabel] = useState<string | null>(null)
  const [guestLinkCode, setGuestLinkCode] = useState<string | null>(null)
  const [rematchState, setRematchState] = useState<RematchState>({ kind: 'idle' })

  useEffect(() => {
    const token = getStoredAuthToken()
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      withCredentials: true,
      auth: {
        token: token || undefined,
        isGuest: !token,
        guestId: getOrCreateGuestId(),
      },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
      autoConnect: false,
    })
    socketRef.current = socket

    function emitModeAction() {
      if (mode.kind === 'queue') {
        setWaitingLabel('Looking for an opponent…')
        socket.emit('joinQueue', { gameId, currency: mode.currency, stake: mode.stake })
      } else if (mode.kind === 'sendInvite') {
        setWaitingLabel('Sending invite…')
        socket.emit('inviteFriend', { friendUserId: mode.friendUserId, gameId })
      } else if (mode.kind === 'acceptInvite') {
        setWaitingLabel('Joining match…')
        socket.emit('respondInvite', { inviteId: mode.inviteId, accept: true })
      } else if (mode.kind === 'createGuest') {
        setWaitingLabel('Creating shareable guest link…')
        socket.emit('createGuestLink', { gameId })
      } else if (mode.kind === 'joinGuest') {
        setWaitingLabel('Joining guest match…')
        socket.emit('joinGuestLink', { code: mode.code })
      } else {
        // The server checks authenticated sockets for an active match before
        // this callback runs and emits the authoritative matched payload when
        // one exists. Do not join a fresh queue while restoring that match.
        setWaitingLabel('Restoring your active match…')
      }
    }

    socket.on('connect', () => {
      setError(null)
      const inPlay = hasMatchRef.current || Boolean(resolutionMatchIdRef.current)
      if (inPlay) {
        setConnectionState('matched')
        return
      }
      setConnectionState('queued')
      emitModeAction()
    })

    socket.on('guestLinkCreated', (payload) => {
      setGuestLinkCode(payload.code)
      setWaitingLabel('Waiting for opponent to join via link…')
    })

    socket.on('guestLinkPending', (payload) => {
      setWaitingLabel(payload.message)
    })

    socket.on('inviteSent', (payload) => {
      if (payload.toUsername === 'Guest Link') {
        setGuestLinkCode(payload.inviteId)
        setWaitingLabel('Waiting for opponent to join via link…')
      } else {
        setWaitingLabel(`Waiting for ${payload.toUsername} to accept…`)
      }
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
      hasMatchRef.current = true
      setConnectionState('matched')
      setWaitingLabel(null)
      setRematchState({ kind: 'idle' })
      setResolution(null)
      resolutionMatchIdRef.current = null
      setMatch(payload)
    })

    socket.on('matchResolved', (payload) => {
      resolutionMatchIdRef.current = payload.matchId
      setRematchState(payload.canRematch ? { kind: 'idle' } : { kind: 'unavailable', reason: 'Opponent left.' })
      setResolution(payload)
    })

    socket.on('rematchOffered', (payload: RematchOfferedPayload) => {
      setRematchState({ kind: 'offered', fromUsername: payload.fromUsername })
    })

    socket.on('rematchWaiting', () => {
      setRematchState({ kind: 'waiting' })
    })

    socket.on('rematchUnavailable', (payload) => {
      setRematchState({ kind: 'unavailable', reason: payload.reason })
    })

    socket.on('queueError', (payload) => {
      if (resolutionMatchIdRef.current) {
        setRematchState({ kind: 'unavailable', reason: payload.message })
        return
      }
      setError(payload.message)
    })

    socket.on('connect_error', (err) => {
      if (intentionalDisconnectRef.current) return
      setError(err.message || 'Could not connect to matchmaking.')
      setConnectionState('closed')
    })

    socket.on('disconnect', (reason) => {
      if (intentionalDisconnectRef.current || reason === 'io client disconnect') {
        setConnectionState('closed')
        return
      }
      setConnectionState('reconnecting')
      setWaitingLabel('Connection interrupted, reconnecting…')
    })

    socket.io.on('reconnect_failed', () => {
      if (intentionalDisconnectRef.current) return
      setError('Could not reconnect to matchmaking.')
      setConnectionState('closed')
    })

    // Reconnect can emit `matched` immediately during the server connection
    // callback. Attach every listener before opening the transport so that
    // authoritative resume payload cannot be missed.
    socket.connect()

    return () => {
      intentionalDisconnectRef.current = true
      if (mode.kind === 'createGuest') {
        socket.emit('cancelGuestLink')
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

  const requestRematch = useCallback(() => {
    const matchId = resolutionMatchIdRef.current
    if (!matchId) return
    setRematchState({ kind: 'waiting' })
    socketRef.current?.emit('requestRematch', { matchId })
  }, [])

  const declineRematch = useCallback(() => {
    const matchId = resolutionMatchIdRef.current
    if (!matchId) return
    socketRef.current?.emit('declineRematch', { matchId })
    setRematchState({ kind: 'unavailable', reason: 'Rematch declined.' })
  }, [])

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true
    const socket = socketRef.current
    if (!socket) return
    if (mode.kind === 'createGuest') {
      socket.emit('cancelGuestLink')
    }
    const matchId = resolutionMatchIdRef.current
    if (matchId) {
      socket.emit('declineRematch', { matchId })
    }
    socket.disconnect()
  }, [mode.kind])

  return {
    connectionState,
    match,
    resolution,
    error,
    waitingLabel,
    guestLinkCode,
    rematchState,
    submitScore,
    reportVisibilityHidden,
    requestRematch,
    declineRematch,
    disconnect,
  }
}
