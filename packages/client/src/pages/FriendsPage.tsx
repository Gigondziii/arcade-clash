import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FriendEntry } from '@fugluck/shared'
import { gameRegistry } from '@fugluck/games'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { apiFetch, ApiError } from '../lib/api'

type FriendsPageProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateWallet?: () => void
  onInviteFriend: (friendUserId: string, gameId: string, gameTitle: string) => void
}

export default function FriendsPage({ onNavigateHome, onNavigateProfile, onNavigateWallet, onInviteFriend }: FriendsPageProps) {
  const { t } = useTranslation()
  const [friends, setFriends] = useState<FriendEntry[]>([])
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteFor, setInviteFor] = useState<FriendEntry | null>(null)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch<{ friends: FriendEntry[] }>('/api/friends')
      setFriends(res.friends)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('friends.loadFailed', { defaultValue: 'Failed to load friends list.' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
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
      setError(err instanceof ApiError ? err.message : t('friends.couldNotSend', { defaultValue: 'Could not send friend request.' }))
    }
  }

  async function accept(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/friends/${id}/accept`, { method: 'POST' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('friends.couldNotAccept', { defaultValue: 'Could not accept friend request.' }))
    }
  }

  async function reject(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/friends/${id}/reject`, { method: 'POST' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('friends.couldNotReject', { defaultValue: 'Could not reject friend request.' }))
    }
  }

  async function removeFriend(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/friends/${id}`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove friend.')
    }
  }

  async function cancelRequest(id: string) {
    setError(null)
    try {
      await apiFetch(`/api/friends/${id}/cancel`, { method: 'DELETE' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel request.')
    }
  }

  const accepted = friends.filter((f) => f.status === 'accepted')
  const incoming = friends.filter((f) => f.direction === 'incoming' && f.status === 'pending')
  const outgoing = friends.filter((f) => f.direction === 'outgoing' && f.status === 'pending')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onNavigateWallet={onNavigateWallet}
        onNavigateFriends={() => {}}
      />
      <main style={{ flex: 1, maxWidth: 720, width: '100%', margin: '0 auto', padding: 'var(--space-8) var(--space-5)', boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-3xl)' }}>{t('friends.title')}</h1>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-6)' }}>
          {t('friends.tagline')}
        </p>

        <form onSubmit={sendRequest} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('friends.usernamePlaceholder')}
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
            {t('friends.addFriendBtn')}
          </button>
        </form>

        {error && (
          <div className="ac-panel" style={{ padding: 'var(--space-3) var(--space-4)', borderColor: 'var(--color-danger, #f87171)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-danger, #f87171)' }}>{error}</span>
            <button type="button" className="ac-btn ac-btn--ghost" onClick={refresh} style={{ fontSize: 'var(--font-size-xs)' }}>
              🔄 Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="ac-text-muted">{t('common.loading')}</p>
        ) : (
          <>
            <Section title={t('friends.incomingRequests')}>
              {incoming.length === 0 ? (
                <Empty>{t('friends.noIncoming')}</Empty>
              ) : (
                incoming.map((f) => (
                  <Row key={f.friendshipId} label={f.username}>
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => accept(f.friendshipId)}>
                      {t('common.accept')}
                    </button>
                    <button type="button" className="ac-btn ac-btn--ghost" onClick={() => reject(f.friendshipId)}>
                      {t('common.reject')}
                    </button>
                  </Row>
                ))
              )}
            </Section>

            <Section title={t('friends.friendsSection')}>
              {accepted.length === 0 ? (
                <Empty>{t('friends.noFriends')}</Empty>
              ) : (
                accepted.map((f) => (
                  <Row key={f.friendshipId} label={f.username}>
                    <button type="button" className="ac-btn ac-btn--primary" onClick={() => setInviteFor(f)}>
                      {t('friends.inviteToPlay')}
                    </button>
                    <button
                      type="button"
                      className="ac-btn ac-btn--ghost"
                      style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}
                      onClick={() => removeFriend(f.friendshipId)}
                    >
                      Remove
                    </button>
                  </Row>
                ))
              )}
            </Section>

            <Section title={t('friends.outgoingRequests')}>
              {outgoing.length === 0 ? (
                <Empty>{t('friends.noOutgoing')}</Empty>
              ) : (
                outgoing.map((f) => (
                  <Row key={f.friendshipId} label={t('friends.pendingLabel', { username: f.username })}>
                    <button
                      type="button"
                      className="ac-btn ac-btn--ghost"
                      style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger, #f87171)' }}
                      onClick={() => cancelRequest(f.friendshipId)}
                    >
                      Cancel
                    </button>
                  </Row>
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
            <h2 style={{ margin: '0 0 var(--space-4)' }}>
              {t('friends.inviteUserModalTitle', { username: inviteFor.username })}
            </h2>
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
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
      <Footer onNavigate={onNavigateHome} />
    </div>
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
