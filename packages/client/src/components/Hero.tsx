import { categoryColors } from '@arcadeclash/theme'
import { engineLabel } from '../lib/format'
import { featuredGame, liveArenaCount } from '../mock/homeData'
import { PlayIcon } from './icons'

// Background is a CSS gradient placeholder standing in for real per-game key
// art, which doesn't exist yet — swap for an actual image once games have assets.
export default function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        margin: 'var(--space-6)',
        minHeight: 420,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: `radial-gradient(circle at 15% 20%, color-mix(in srgb, var(--color-primary) 35%, var(--color-bg)) 0%, var(--color-bg) 55%),
                     radial-gradient(circle at 85% 75%, color-mix(in srgb, var(--color-primary) 20%, var(--color-bg)) 0%, var(--color-bg) 60%)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(10,10,15,0.15) 0%, rgba(10,10,15,0.95) 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 'var(--space-5)',
          right: 'var(--space-5)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          background: 'rgba(10,10,15,0.6)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-full)',
          padding: 'var(--space-1) var(--space-4)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-danger)',
          }}
        />
        LIVE ARENA · {liveArenaCount} players online now
      </div>

      <div
        style={{
          position: 'absolute',
          left: 'var(--space-8)',
          bottom: 'var(--space-8)',
          maxWidth: 560,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <span
            className="ac-tag"
            style={{ ['--tag-color' as string]: categoryColors[featuredGame.engine] }}
          >
            {engineLabel(featuredGame.engine)}
          </span>
          <span
            className="ac-text-muted"
            style={{ fontSize: 'var(--font-size-xs)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {featuredGame.tagline}
          </span>
        </div>

        <h1 style={{ fontSize: 'var(--font-size-4xl)', margin: '0 0 var(--space-3)' }}>{featuredGame.title}</h1>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>
          {featuredGame.description}
        </p>

        <button type="button" className="ac-btn ac-btn--primary">
          <PlayIcon /> PLAY NOW
        </button>
      </div>
    </section>
  )
}
