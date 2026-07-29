import type { GameEngine } from '@arcadeclash/games'
import { categoryColors } from '@arcadeclash/theme'
import { engineLabel, formatPlays } from '../lib/format'
import StarRating from './StarRating'

type GameCardProps = {
  title: string
  engine: GameEngine
  plays: number
  rating: number
  onPlay?: () => void
  loading?: boolean
}

export default function GameCard({ title, engine, plays, rating, onPlay, loading }: GameCardProps) {
  const tagColor = categoryColors[engine]

  return (
    <div
      className="ac-card"
      role={onPlay ? 'button' : undefined}
      tabIndex={onPlay ? 0 : undefined}
      onClick={onPlay}
      onKeyDown={
        onPlay
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPlay()
              }
            }
          : undefined
      }
      style={onPlay ? { cursor: 'pointer' } : undefined}
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
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)' }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <StarRating rating={rating} />
          <span className="ac-text-muted ac-text-mono" style={{ fontSize: 'var(--font-size-xs)' }}>
            {loading ? 'Loading…' : `${formatPlays(plays)} PLAYS`}
          </span>
        </div>
      </div>
    </div>
  )
}
