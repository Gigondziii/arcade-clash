import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle } from '@fugluck/shared'
import Avatar from '../components/Avatar'
import ChangePasswordModal from '../components/ChangePasswordModal'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'

type MatchHistoryItem = {
  id: string
  gameId: string
  opponentUsername: string
  outcome: string
  currency: string
  stake: number
  userScore: number
  opponentScore: number
  seed: number
  inputLog: Array<{ tick: number; action: string }>
  createdAt: string
}

type ProfilePageProps = {
  onNavigateHome: () => void
  onNavigateFriends?: () => void
  onNavigateWallet?: () => void
}

export default function ProfilePage({ onNavigateHome, onNavigateFriends, onNavigateWallet }: ProfilePageProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [matches, setMatches] = useState<MatchHistoryItem[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [matchError, setMatchError] = useState<string | null>(null)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  const currentLang = i18n.language || 'en'

  function loadMatches() {
    if (!user) return
    setLoadingMatches(true)
    setMatchError(null)
    apiFetch<{ matches: MatchHistoryItem[] }>('/api/matches/history')
      .then((res) => {
        setMatches(res.matches)
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : t('game.historyError', { defaultValue: 'Failed to load match history.' })
        setMatchError(msg)
      })
      .finally(() => setLoadingMatches(false))
  }

  useEffect(() => {
    loadMatches()
  }, [user])

  if (!user) {
    return (
      <>
        <Navbar
          onNavigateHome={onNavigateHome}
          onNavigateProfile={() => {}}
          onNavigateFriends={onNavigateFriends}
          onNavigateWallet={onNavigateWallet}
        />
        <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
          <p className="ac-text-muted">{t('auth.notLoggedIn')}</p>
        </main>
      </>
    )
  }

  const winRate = user.gamesPlayed > 0 ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%` : '—'

  return (
    <>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={() => {}}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
      />
      <main style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
          <Avatar username={user.username} size={72} />
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)' }}>{user.username}</h1>
            <p className="ac-text-muted" style={{ margin: 'var(--space-1) 0 0' }}>
              Joined {new Date(user.createdAt).toLocaleDateString(currentLang)}
            </p>
          </div>
        </div>

        <div
          className="ac-panel"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}
        >
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.coinsLabel')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-secondary, #fbbf24)' }}>
              {user.balances.coins.toLocaleString(currentLang)}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.diamondsLabel')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
              {user.balances.diamonds.toLocaleString(currentLang)}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.gamesPlayed')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.gamesPlayed.toLocaleString(currentLang)}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.winRate')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{winRate}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          {onNavigateWallet && (
            <button type="button" className="ac-btn ac-btn--ghost" onClick={onNavigateWallet} style={{ flex: '1 1 180px' }}>
              💳 {t('wallet.openWallet', { defaultValue: 'View Wallet & Ledger' })}
            </button>
          )}
          {onNavigateFriends && (
            <button type="button" className="ac-btn ac-btn--ghost" onClick={onNavigateFriends} style={{ flex: '1 1 180px' }}>
              👥 {t('friends.openFriendsList', { defaultValue: 'Friends & Invites' })}
            </button>
          )}
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={() => setIsChangePasswordOpen(true)}
            style={{ flex: '1 1 180px' }}
          >
            🔒 {t('auth.changePassword', { defaultValue: 'Change Password' })}
          </button>
        </div>

        {/* Match History Section */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>{t('game.matchHistoryTitle')}</h2>
            <button
              type="button"
              className="ac-btn ac-btn--ghost"
              onClick={loadMatches}
              disabled={loadingMatches}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              🔄 {t('common.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>

          {loadingMatches ? (
            <p className="ac-text-muted">{t('game.loadingHistory')}</p>
          ) : matchError ? (
            <div className="ac-panel" style={{ padding: 'var(--space-4)', borderColor: 'var(--color-danger, #f87171)' }}>
              <p style={{ color: 'var(--color-danger, #f87171)', margin: '0 0 var(--space-3)' }}>{matchError}</p>
              <button type="button" className="ac-btn ac-btn--primary" onClick={loadMatches}>
                🔄 {t('common.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : matches.length === 0 ? (
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('game.noMatchesRecorded')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {matches.map((m) => {
                const gameName = getGameTitle(m.gameId)
                const isWin = m.outcome === 'win'
                const isLoss = m.outcome === 'loss'
                const outcomeColor = isWin ? '#22c55e' : isLoss ? '#f87171' : '#fbbf24'
                const stakeDisplay = m.stake > 0 ? `${m.stake} ${m.currency}` : 'Free Play'

                return (
                  <div
                    key={m.id}
                    className="ac-panel"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                  >
                    <div>
                      <div>
                        <strong style={{ color: outcomeColor }}>
                          {(t(`game.${m.outcome}`) || m.outcome).toUpperCase()}
                        </strong>{' '}
                        — <strong>{gameName}</strong> vs <strong>{m.opponentUsername}</strong>
                      </div>
                      <div className="ac-text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                        {t('game.scoreLine', {
                          userScore: m.userScore,
                          opponentScore: m.opponentScore,
                          date: new Date(m.createdAt).toLocaleDateString(currentLang),
                        })}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)' }}>
                      <span
                        className="ac-tag"
                        style={{
                          background: m.stake > 0 ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-surface)',
                          borderColor: m.stake > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                        }}
                      >
                        {stakeDisplay}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      </main>
      <Footer onNavigate={onNavigateHome} />
    </>
  )
}
