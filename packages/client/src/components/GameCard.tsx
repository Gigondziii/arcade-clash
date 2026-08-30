import { useState } from 'react'
import type { GameEngine } from '@fugluck/games'
import { categoryColors } from '@fugluck/theme'
import { engineLabel } from '../lib/format'
import LaunchModal from './LaunchModal'

type GameCardProps = {
  title: string
  engine: GameEngine
  tagline?: string
  onPlay?: () => void
  onFindOpponent?: (stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  onLaunchGuestInvite?: () => void
  loading?: boolean
}

export default function GameCard({ title, engine, tagline, onPlay, onFindOpponent, onLaunchGuestInvite, loading }: GameCardProps) {
  const [showModal, setShowModal] = useState(false)
  const tagColor = categoryColors[engine]

  return (
    <>
      <div
        className="ac-card"
        role="button"
        tabIndex={0}
        onClick={() => setShowModal(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setShowModal(true)
          }
        }}
        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 10',
            background: `linear-gradient(135deg, color-mix(in srgb, ${tagColor} 30%, var(--color-surface)) 0%, var(--color-surface) 100%)`,
          }}
        >
          <span
            className="ac-tag"
            style={{ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)', ['--tag-color' as string]: tagColor }}
          >
            {engineLabel(engine)}
          </span>
        </div>
        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-1)' }}>{title}</div>
            {tagline && (
              <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', margin: '0 0 var(--space-3)', lineHeight: 1.4 }}>
                {tagline}
              </p>
            )}
          </div>

          {/* Prominent Play Button under every game card */}
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation()
              setShowModal(true)
            }}
            style={{
              width: '100%',
              height: '40px',
              justifyContent: 'center',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              marginTop: 'var(--space-2)',
            }}
          >
            ▶ Play
          </button>
        </div>
      </div>

      {showModal && (
        <LaunchModal
          gameTitle={title}
          onClose={() => setShowModal(false)}
          onLaunchPractice={() => {
            onPlay?.()
          }}
          onLaunchInviteLink={() => {
            onLaunchGuestInvite?.()
          }}
          onLaunchCoinsMatch={(stake) => {
            onFindOpponent?.(stake, 'COINS')
          }}
          onLaunchDiamondsMatch={(stake) => {
            onFindOpponent?.(stake, 'DIAMONDS')
          }}
        />
      )}
    </>
  )
}
