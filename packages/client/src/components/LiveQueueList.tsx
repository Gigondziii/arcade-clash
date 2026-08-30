import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type QueueStateEntry, type ServerToClientEvents, type ClientToServerEvents } from '@fugluck/shared'
import { io, type Socket } from 'socket.io-client'
import { getStoredAuthToken, useAuth } from '../auth/AuthContext'
import { API_URL } from '../lib/api'

type LiveQueueListProps = {
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
}

export default function LiveQueueList({ onFindOpponent }: LiveQueueListProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [entries, setEntries] = useState<QueueStateEntry[]>([])
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getStoredAuthToken()
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      withCredentials: true,
      auth: { token: token || undefined },
    })

    socket.on('queueStateUpdate', (payload) => {
      setEntries(payload.entries || [])
    })

    return () => {
      socket.disconnect()
    }
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  function formatTime(queuedAt: number): string {
    const elapsedSec = Math.max(0, Math.floor((now - queuedAt) / 1000))
    const mins = Math.floor(elapsedSec / 60)
      .toString()
      .padStart(2, '0')
    const secs = (elapsedSec % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  function handleDirectMatch(entry: QueueStateEntry) {
    setError(null)
    const gameTitle = getGameTitle(entry.gameId)

    // Guest enforcement guard
    if (!user && entry.stake > 0) {
      setError(
        t('lobby.guestWagerError', {
          defaultValue: 'Guests cannot join wager matches. Please sign up or log in.',
        }),
      )
      return
    }

    // Balance check
    if (user && entry.stake > 0) {
      const userBalance = entry.currency === 'COINS' ? user.balances.coins : user.balances.diamonds
      if (userBalance < entry.stake) {
        setError(
          t('lobby.insufficientBalance', {
            currency: entry.currency,
            available: userBalance,
            required: entry.stake,
            defaultValue: `Insufficient ${entry.currency} balance (${userBalance} available, ${entry.stake} required).`,
          }),
        )
        return
      }
    }

    onFindOpponent(entry.gameId, gameTitle, entry.stake, entry.currency)
  }

  return (
    <section
      className="ac-panel"
      aria-label={t('lobby.title', { defaultValue: 'Live Matchmaking Lobby' })}
      style={{
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-8)',
        background: 'linear-gradient(180deg, rgba(26, 26, 35, 0.6) 0%, var(--color-surface, #121218) 100%)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg, 20px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-5)',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md, 12px)',
              background: 'rgba(124, 58, 237, 0.15)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              color: 'var(--color-primary, #7c3aed)',
              flexShrink: 0,
            }}
          >
            ⚡
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--font-size-lg, 1.25rem)',
                fontWeight: 'var(--font-weight-bold, 700)',
                color: 'var(--color-text, #f5f5f7)',
                letterSpacing: '-0.01em',
              }}
            >
              {t('lobby.title', { defaultValue: 'Live Matchmaking Lobby' })}
            </h2>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: 'var(--font-size-xs, 0.75rem)',
                color: 'var(--color-text-muted, #9a9aa8)',
              }}
            >
              {t('lobby.subtitle', {
                defaultValue: 'Real-time arena queue — click Match to instantly join and play',
              })}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: entries.length > 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255, 255, 255, 0.04)',
            border: entries.length > 0 ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid var(--color-border)',
            color: entries.length > 0 ? 'var(--color-success, #34d399)' : 'var(--color-text-muted, #9a9aa8)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full, 9999px)',
            fontSize: 'var(--font-size-xs, 0.75rem)',
            fontWeight: 'var(--font-weight-medium, 500)',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: entries.length > 0 ? 'var(--color-success, #34d399)' : 'var(--color-text-muted, #9a9aa8)',
              boxShadow: entries.length > 0 ? '0 0 8px var(--color-success, #34d399)' : 'none',
            }}
          />
          <span>
            {entries.length === 0
              ? t('lobby.noPlayersWaiting', { defaultValue: '0 players waiting' })
              : t('lobby.playersWaiting', {
                  count: entries.length,
                  defaultValue: `${entries.length} players waiting`,
                })}
          </span>
        </div>
      </div>

      {/* Error / Alert Banner */}
      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            background: 'rgba(248, 113, 113, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.3)',
            color: 'var(--color-danger, #f87171)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md, 12px)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-danger, #f87171)',
              cursor: 'pointer',
              fontSize: '16px',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Lobby Content: Empty State vs Cards */}
      {entries.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-8) var(--space-4)',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md, 12px)',
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              marginBottom: 'var(--space-3)',
              color: 'var(--color-text-muted)',
            }}
          >
            🎮
          </div>
          <h3
            style={{
              margin: '0 0 var(--space-2) 0',
              fontSize: 'var(--font-size-base, 1rem)',
              fontWeight: 'var(--font-weight-bold, 700)',
              color: 'var(--color-text, #f5f5f7)',
            }}
          >
            {t('lobby.emptyTitle', { defaultValue: 'No Active Queues' })}
          </h3>
          <p
            style={{
              margin: 0,
              maxWidth: '520px',
              fontSize: 'var(--font-size-sm, 0.875rem)',
              color: 'var(--color-text-muted, #9a9aa8)',
              lineHeight: 1.5,
            }}
          >
            {t('lobby.emptyMessage', {
              defaultValue:
                'No players are currently waiting in the public queue. Select any game below to start playing or create an open match!',
            })}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 'var(--space-3)',
          }}
        >
          {entries.map((entry) => {
            const isSelf = user?.id === entry.userId
            const gameTitle = getGameTitle(entry.gameId)

            return (
              <div
                key={entry.socketId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  background: 'var(--color-surface-raised, #1a1a23)',
                  border: isSelf ? '1px solid rgba(124, 58, 237, 0.5)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md, 12px)',
                  padding: 'var(--space-3) var(--space-4)',
                  transition: 'border-color var(--transition-fast, 120ms), box-shadow var(--transition-fast, 120ms)',
                  position: 'relative',
                }}
              >
                {/* Player & Game Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: isSelf
                        ? 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)'
                        : 'linear-gradient(135deg, rgba(124, 58, 237, 0.3) 0%, rgba(56, 189, 248, 0.3) 100%)',
                      border: isSelf ? '2px solid var(--color-primary-hover, #8b5cf6)' : '1px solid var(--color-border)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'var(--font-weight-bold, 700)',
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      flexShrink: 0,
                      userSelect: 'none',
                    }}
                  >
                    {entry.username ? entry.username.slice(0, 2).toUpperCase() : '??'}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'var(--font-weight-bold, 700)',
                        fontSize: 'var(--font-size-sm, 0.875rem)',
                        color: 'var(--color-text, #f5f5f7)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.username}</span>
                      {isSelf && (
                        <span
                          style={{
                            fontSize: 'var(--font-size-xs, 0.75rem)',
                            color: 'var(--color-primary-hover, #8b5cf6)',
                            fontWeight: 'var(--font-weight-medium, 500)',
                            userSelect: 'none',
                          }}
                        >
                          {t('lobby.you', { defaultValue: '(You)' })}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 'var(--font-size-xs, 0.75rem)',
                        color: 'var(--color-text-muted, #9a9aa8)',
                        marginTop: '2px',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ color: 'var(--color-text, #f5f5f7)', fontWeight: 'var(--font-weight-medium, 500)' }}>
                        {gameTitle}
                      </span>
                      <span>·</span>
                      <span>{t('lobby.searching', { time: formatTime(entry.queuedAt) })}</span>
                    </div>
                  </div>
                </div>

                {/* Stake Pill & Primary Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full, 9999px)',
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                      fontWeight: 'var(--font-weight-bold, 700)',
                      userSelect: 'none',
                      background:
                        entry.stake === 0
                          ? 'rgba(148, 163, 184, 0.12)'
                          : entry.currency === 'COINS'
                          ? 'rgba(251, 191, 36, 0.12)'
                          : 'rgba(56, 189, 248, 0.12)',
                      border:
                        entry.stake === 0
                          ? '1px solid rgba(148, 163, 184, 0.25)'
                          : entry.currency === 'COINS'
                          ? '1px solid rgba(251, 191, 36, 0.25)'
                          : '1px solid rgba(56, 189, 248, 0.25)',
                      color:
                        entry.stake === 0
                          ? '#94a3b8'
                          : entry.currency === 'COINS'
                          ? 'var(--color-secondary, #fbbf24)'
                          : '#38bdf8',
                    }}
                  >
                    {entry.stake === 0
                      ? t('lobby.freePlay', { defaultValue: 'Free Play' })
                      : `${entry.stake} ${
                          entry.currency === 'COINS'
                            ? t('common.coins', { defaultValue: 'Coins' })
                            : t('common.diamonds', { defaultValue: 'Diamonds' })
                        }`}
                  </span>

                  {!isSelf ? (
                    <button
                      type="button"
                      className="ac-btn ac-btn--primary"
                      style={{
                        padding: '4px 12px',
                        fontSize: 'var(--font-size-xs, 0.75rem)',
                        fontWeight: 'var(--font-weight-bold, 700)',
                        height: '30px',
                        userSelect: 'none',
                      }}
                      onClick={() => handleDirectMatch(entry)}
                    >
                      ▶ {t('lobby.matchBtn', { defaultValue: 'Match' })}
                    </button>
                  ) : (
                    <span
                      style={{
                        fontSize: 'var(--font-size-xs, 0.75rem)',
                        color: 'var(--color-primary-hover, #8b5cf6)',
                        fontWeight: 'var(--font-weight-medium, 500)',
                        padding: '4px 8px',
                        userSelect: 'none',
                      }}
                    >
                      {t('lobby.waitingOpponent', { defaultValue: 'Waiting…' })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
