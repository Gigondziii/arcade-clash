import { useEffect, useState } from 'react'
import type { FriendEntry } from '@arcadeclash/shared'
import { gameRegistry } from '@arcadeclash/games'
import Navbar from '../components/Navbar'
import { apiFetch, ApiError } from '../lib/api'

type FriendsPageProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onInviteFriend: (friendUserId: string, gameId: string, gameTitle: string) => void
}

export default function FriendsPage({ onNavigateHome, onNavigateProfile, onInviteFriend }: FriendsPageProps) {
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteFor, setInviteFor] = useState<FriendEntry | null>(null)

  async function refresh() {
    const res = await apiFetch<{ friends: FriendEntry[] }>('/api/friends')
    setFriends(res.friends)
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load friends'))
      .finally(() => setLoading(false))
  }, [])

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await apiFetch('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim() }),
      })
      setUsername('')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send request')
    }
  }

  async function accept(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/friends/${id}/accept`, { method: 'POST' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept')
    }
  }

  async function reject(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/friends/${id}/reject`, { method: 'POST' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reject')
    }
  }

  const accepted = friends.filter((f) => f.status === 'accepted')
  const incoming = friends.filter((f) => f.direction === 'incoming' && f.status === 'pending')
  const outgoing = friends.filter((f) => f.direction === 'outgoing' && f.status === 'pending')

  return (
    <>
      <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={onNavigateProfile} onNavigateFriends={() => {}} />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
        <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-3xl)' }}>Friends</h1>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-6)' }}>
          Add friends by username, then invite them to a private match.
        </p>

        <form onSubmit={sendRequest} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
            minLength={3}
            style={{
              flex: 1,
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              color: 'var(--color-text)',
            }}
          />
          <button type="submit" className="ac-btn ac-btn--primary">
            Add friend
          </button>
        </form>

        {error && (
          <p style={{ color: 'var(--color-danger, #f87171)', marginBottom: 'var(--space-4)' }}>{error}</p>
        )}

        {loading ? (
          <p className="ac-text-muted">Loading…</p>
        ) : (
          <>
            <Section title="Incoming requests">
              {incoming.length === 0 ? (
                <Empty>No pending requests.</Empty>
              ) : (
                incoming.map((f) => (
                  <Row key={f.friendshipId} label={f.username}>
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => accept(f.friendshipId)}>
                      Accept
                    </button>
                    <button type="button" className="ac-btn ac-btn--ghost" onClick={() => reject(f.friendshipId)}>
                      Reject
                    </button>
                  </Row>
                ))
              )}
            </Section>

            <Section title="Friends">
              {accepted.length === 0 ? (
                <Empty>No friends yet — send a request above.</Empty>
              ) : (
                accepted.map((f) => (
                  <Row key={f.friendshipId} label={f.username}>
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => setInviteFor(f)}>
                      Invite to play
                    </button>
                  </Row>
                ))
              )}
            </Section>

            <Section title="Outgoing requests">
              {outgoing.length === 0 ? (
                <Empty>None.</Empty>
              ) : (
                outgoing.map((f) => (
                  <Row key={f.friendshipId} label={`${f.username} (pending)`} />
                ))
              )}
            </Section>
          </>
        )}
      </main>

      {inviteFor && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'color-mix(in srgb, var(--color-bg) 70%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
          onClick={() => setInviteFor(null)}
        >
          <div className="ac-panel" style={{ minWidth: 300, padding: 'var(--space-5)' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 var(--space-4)' }}>Invite {inviteFor.username}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {gameRegistry.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="ac-btn ac-btn--ghost"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    onInviteFriend(inviteFor.userId, g.id, g.name)
                    setInviteFor(null)
                  }}
                >
                  {g.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ac-btn ac-btn--ghost"
              style={{ marginTop: 'var(--space-4)', width: '100%' }}
              onClick={() => setInviteFor(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-lg)' }}>{title}</h2>
      <div className="ac-panel" style={{ padding: 'var(--space-2)' }}>
        {children}
      </div>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="ac-text-muted" style={{ margin: 0, padding: 'var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
      {children}
    </p>
  )
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span>{label}</span>
      {children && <div style={{ display: 'flex', gap: 'var(--space-2)' }}>{children}</div>}
    </div>
  )
}
