import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import LaunchModal from '../components/LaunchModal'

type NotFoundPageProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onPlayGame?: (id: string, title: string) => void
  onFindOpponent?: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
}

export default function NotFoundPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onPlayGame,
  onFindOpponent,
}: NotFoundPageProps) {
  const { t } = useTranslation()
  const [selectedGame, setSelectedGame] = useState<{ id: string; title: string } | null>(null)
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''

  const quickGames = [
    { id: 'neon-runner', title: 'Neon Runner', engine: 'Runner' },
    { id: 'pixel-ninja-dash', title: 'Pixel Ninja Dash', engine: 'Reflex Timing' },
    { id: 'space-blaster', title: 'Space Blaster', engine: 'Arena Shooter' },
    { id: 'cyber-hopper', title: 'Cyber Hopper', engine: 'Reflex Timing' },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8) var(--space-4)',
        }}
      >
        <div
          className="ac-panel"
          style={{
            maxWidth: 680,
            width: '100%',
            textAlign: 'center',
            padding: 'var(--space-8) var(--space-6)',
            boxShadow: 'var(--shadow-elevate), var(--glow-primary)',
            borderColor: 'var(--color-border)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative Glitch / Grid Glow Background */}
          <div
            style={{
              position: 'absolute',
              top: '-60px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '280px',
              height: '140px',
              background: 'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.25) 0%, rgba(10, 10, 15, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Status Badge */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span
              className="ac-tag"
              style={{
                fontSize: 'var(--font-size-xs)',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-mono)',
                borderColor: 'var(--color-warning)',
                color: 'var(--color-warning)',
                background: 'rgba(251, 146, 60, 0.1)',
                padding: 'var(--space-1) var(--space-3)',
              }}
            >
              {t('notFound.stageBadge')}
            </span>
          </div>

          {/* Large 404 Headline */}
          <h1
            style={{
              margin: '0 0 var(--space-2)',
              fontSize: 'clamp(3rem, 8vw, 5rem)',
              fontWeight: 'var(--font-weight-bold)',
              letterSpacing: '-2px',
              lineHeight: 'var(--line-height-tight)',
              background: 'linear-gradient(135deg, var(--color-text) 0%, var(--color-primary-hover) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            404
          </h1>

          <h2
            style={{
              margin: '0 0 var(--space-4)',
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text)',
            }}
          >
            {t('notFound.headline')}
          </h2>

          <p
            className="ac-text-muted"
            style={{
              margin: '0 auto var(--space-6)',
              maxWidth: 520,
              fontSize: 'var(--font-size-base)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            {t('notFound.bodyText', { path: currentPath || '/404' })}
          </p>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-8)',
            }}
          >
            <button type="button" className="ac-btn ac-btn--primary" onClick={onNavigateHome}>
              <span>&larr; {t('notFound.returnArena')}</span>
            </button>
            <button type="button" className="ac-btn ac-btn--ghost" onClick={onNavigateProfile}>
              <span>{t('notFound.myProfile')}</span>
            </button>
            <button type="button" className="ac-btn ac-btn--ghost" onClick={onNavigateFriends}>
              <span>{t('notFound.friendsList')}</span>
            </button>
          </div>

          {/* Jump into Active Games Section */}
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-6)',
              textAlign: 'left',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-muted)',
                margin: '0 0 var(--space-3)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {t('notFound.jumpIntoMatch')}
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {quickGames.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedGame({ id: game.id, title: game.title })}
                  className="ac-card"
                  style={{
                    background: 'var(--color-surface-raised)',
                    padding: 'var(--space-3)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: 'var(--color-text)',
                      marginBottom: 'var(--space-1)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {game.title}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-primary-hover)',
                    }}
                  >
                    {t('notFound.playNow')}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      {selectedGame && (
        <LaunchModal
          gameTitle={selectedGame.title}
          onClose={() => setSelectedGame(null)}
          onLaunchPractice={() => {
            const game = selectedGame
            setSelectedGame(null)
            onPlayGame?.(game.id, game.title)
          }}
          onLaunchInviteLink={() => {
            const game = selectedGame
            setSelectedGame(null)
            onFindOpponent?.(game.id, game.title)
          }}
          onLaunchCoinsMatch={(stake: number) => {
            const game = selectedGame
            setSelectedGame(null)
            onFindOpponent?.(game.id, game.title, stake, 'COINS')
          }}
          onLaunchDiamondsMatch={(stake: number) => {
            const game = selectedGame
            setSelectedGame(null)
            onFindOpponent?.(game.id, game.title, stake, 'DIAMONDS')
          }}
        />
      )}
    </div>
  )
}
