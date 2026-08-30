import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ClientToServerEvents, InviteReceivedPayload, ServerToClientEvents } from '@fugluck/shared'
import { io, type Socket } from 'socket.io-client'
import { getStoredAuthToken, useAuth } from '../auth/AuthContext'
import { API_URL } from '../lib/api'

type InviteContextValue = {
  incoming: InviteReceivedPayload | null
  declineIncoming: () => void
}

const InviteContext = createContext<InviteContextValue | null>(null)

type InviteProviderProps = {
  children: ReactNode
  onAcceptInvite: (invite: InviteReceivedPayload) => void
  // False while MatchLoader owns the matchmaking socket (avoids two sockets
  // fighting over presence). Re-enabling reconnects after the match exits.
  enabled?: boolean
}

// Keeps a presence socket open while logged in so friend invites can land
// even when the user isn't already in MatchLoader.
export function InviteProvider({ children, onAcceptInvite, enabled = true }: InviteProviderProps) {
  const { user } = useAuth()
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [incoming, setIncoming] = useState<InviteReceivedPayload | null>(null)

  useEffect(() => {
    if (!user || !enabled) {
      socketRef.current?.disconnect()
      socketRef.current = null
      if (!user) setIncoming(null)
      return
    }

    const token = getStoredAuthToken()
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      withCredentials: true,
      auth: { token: token || undefined },
    })
    socketRef.current = socket

    socket.on('inviteReceived', (payload) => {
      setIncoming(payload)
    })
    socket.on('inviteRejected', (payload) => {
      setIncoming((prev) => (prev?.inviteId === payload.inviteId ? null : prev))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user, enabled])

  const declineIncoming = useCallback(() => {
    if (!incoming) return
    socketRef.current?.emit('respondInvite', { inviteId: incoming.inviteId, accept: false })
    setIncoming(null)
  }, [incoming])

  const acceptIncoming = useCallback(() => {
    if (!incoming) return
    const invite = incoming
    setIncoming(null)
    onAcceptInvite(invite)
  }, [incoming, onAcceptInvite])

  return (
    <InviteContext.Provider value={{ incoming, declineIncoming }}>
      {children}
      {incoming && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--space-6)',
            right: 'var(--space-6)',
            zIndex: 60,
            maxWidth: 360,
          }}
        >
          <div className="ac-panel" style={{ padding: 'var(--space-4)' }}>
            <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-lg)' }}>
              Match invite
            </h3>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
              <strong style={{ color: 'var(--color-text)' }}>{incoming.fromUsername}</strong> invited you to
              play <strong style={{ color: 'var(--color-text)' }}>{incoming.gameId}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button type="button" className="ac-btn ac-btn--primary" onClick={acceptIncoming} style={{ flex: 1 }}>
                Accept
              </button>
              <button type="button" className="ac-btn ac-btn--ghost" onClick={declineIncoming} style={{ flex: 1 }}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </InviteContext.Provider>
  )
}

export function useInvites(): InviteContextValue {
  const ctx = useContext(InviteContext)
  if (!ctx) throw new Error('useInvites must be used within InviteProvider')
  return ctx
}
