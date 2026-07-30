import { useEffect, useRef, useState } from 'react'
import type { GameModule, GameModuleFactory, GameOverPayload } from '@arcadeclash/shared'

type GameLoaderProps = {
  createModule: GameModuleFactory
  gameTitle: string
  onExit: () => void
}

// Thin host chrome around any GameModule: mounts it in practice mode,
// listens for gameOver, and renders the actual results screen (with
// navigation) itself — "back to lobby" is a host concern the module has no
// way to perform through its fixed init/start/pause/destroy interface.
export default function GameLoader({ createModule, gameTitle, onExit }: GameLoaderProps) {
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
            background: 'rgba(10,10,15,0.75)',
          }}
        >
          <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
            <h2 style={{ margin: '0 0 var(--space-2)' }}>Run Complete</h2>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>
              {result.reason === 'quit' ? 'Run ended early' : 'You hit an obstacle'}
            </p>
            <div
              style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 'var(--font-weight-bold)',
                marginBottom: 'var(--space-6)',
              }}
            >
              {result.score}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center' }}>
              <button type="button" className="ac-btn ac-btn--primary" onClick={handlePlayAgain}>
                Play Again
              </button>
              <button type="button" className="ac-btn ac-btn--ghost" onClick={onExit}>
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
