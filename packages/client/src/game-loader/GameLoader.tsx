import { useEffect, useRef, useState } from 'react'
import type { GameModule, GameModuleFactory, GameOverPayload } from '@fugluck/shared'

type GameLoaderProps = {
  createModule: GameModuleFactory
  gameTitle: string
  gameId?: string
  onExit: () => void
  onPlayMatch?: () => void
}

// Thin host chrome around any GameModule: mounts it in practice mode,
// listens for gameOver, and renders the actual results screen (with
// navigation) itself — "back to lobby" is a host concern the module has no
// way to perform through its fixed init/start/pause/destroy interface.
export default function GameLoader({ createModule, gameTitle, onExit, onPlayMatch }: GameLoaderProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const moduleRef = useRef<GameModule | null>(null)
  const [result, setResult] = useState<GameOverPayload | null>(null)

  function mount() {
    const container = containerRef.current
    if (!container) return
    const mod = createModule()
    moduleRef.current = mod
    mod.addEventListener('gameOver', ((e: Event) => {
      setResult((e as CustomEvent<GameOverPayload>).detail)
    }) as EventListener)
    // A fresh seed per mount (including Play Again, which remounts via a new
    // module instance) — this is the host picking an arbitrary starting
    // point for one run, not gameplay-affecting randomness, so it doesn't
    // go through the seeded gameplay/cosmetic streams inside the engine.
    const seed = Math.floor(Math.random() * 0x100000000)
    mod.init(container, 'practice', null, seed)
    mod.start()
  }

  useEffect(() => {
    const prevTitle = document.title
    document.title = `Fugluck — Practice: ${gameTitle}`
    return () => {
      document.title = prevTitle
    }
  }, [gameTitle])

  useEffect(() => {
    mount()
    return () => {
      moduleRef.current?.destroy()
      moduleRef.current = null
    }
    // Mount once per GameLoader instance — App.tsx remounts this component
    // (fresh key) whenever a different game is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePlayAgain() {
    moduleRef.current?.destroy()
    setResult(null)
    mount()
  }

  // Keyboard shortcut listener for instant Rematch / Play Again
  useEffect(() => {
    if (!result) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'KeyR' || e.code === 'Enter') {
        e.preventDefault()
        handlePlayAgain()
      } else if (e.code === 'Escape') {
        e.preventDefault()
        onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [result])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-bg)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          {gameTitle} · Practice
        </span>
        <button
          type="button"
          className="ac-btn ac-btn--ghost"
          onClick={onExit}
          style={{ padding: 'var(--space-1) var(--space-4)' }}
        >
          Exit
        </button>
      </div>

      <div ref={containerRef} style={{ flex: 1, position: 'relative' }} />

      {result && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10,10,15,0.82)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="ac-panel"
            style={{
              textAlign: 'center',
              minWidth: 320,
              maxWidth: 420,
              padding: 'var(--space-6)',
              boxShadow: 'var(--shadow-elevate-hover)',
              border: '1px solid var(--color-primary)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                background: 'rgba(124, 58, 237, 0.15)',
                color: 'var(--color-primary-hover)',
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'bold',
                marginBottom: 'var(--space-3)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              🏁 Run Complete
            </div>
            <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-2xl)' }}>{gameTitle}</h2>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
              {result.reason === 'quit' ? 'Run ended early' : 'Obstacle collision'}
            </p>
            <div
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-5)',
              }}
            >
              <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Final Score
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-4xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-text)',
                  lineHeight: '1.2',
                  marginTop: 'var(--space-1)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {result.score}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="ac-btn ac-btn--primary"
                onClick={handlePlayAgain}
                style={{
                  padding: 'var(--space-3) var(--space-5)',
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'bold',
                  boxShadow: 'var(--glow-primary)',
                }}
              >
                🔄 Rematch / Play Again
                <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)', fontWeight: 'normal' }}>
                  [Space / R]
                </span>
              </button>

              {onPlayMatch && (
                <button
                  type="button"
                  className="ac-btn ac-btn--secondary"
                  onClick={onPlayMatch}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'bold',
                  }}
                >
                  ⚔️ Find 1v1 Opponent
                </button>
              )}

              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={onExit}
                style={{ padding: 'var(--space-2) var(--space-4)' }}
              >
                Back to Home
                <span style={{ opacity: 0.5, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)' }}>
                  [Esc]
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
