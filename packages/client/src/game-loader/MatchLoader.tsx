import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  GameModule,
  GameModuleFactory,
  GameOverPayload,
  MatchedPayload,
  MatchResolvedPayload,
  PlayerResult,
} from '@arcadeclash/shared'
import { useMatchSocket } from '../matchmaking/useMatchSocket'

type MatchLoaderProps = {
  createModule: GameModuleFactory
  gameTitle: string
  gameId: string
  onExit: () => void
}

// A separate host from GameLoader (practice mode) rather than a mode branch
// inside it — practice's mount() stays untouched (client-generated seed is
// still correct there: solo, nothing to cheat against). This host owns the
// find-opponent lifecycle end to end: queued -> countdown -> mounts the
// GameModule with the server-issued seed -> awaiting-opponent -> resolved.
// matchResolved is handled from any phase past 'countdown', not just
// 'awaiting-opponent' — a forfeit timeout or a mid-match opponent disconnect
// can resolve the match out from under a still-playing player (see
// PROGRESS.md's forfeit-timeout and disconnect-resolution sections). There
// is no separate "ended" terminal state anymore — a disconnect used to void
// the match with no result; it now resolves via matchResolved like anything
// else (see PROGRESS.md's session log for why voiding was a free escape from
// a losing position).
type Phase =
  | { kind: 'queued' }
  | { kind: 'countdown'; match: MatchedPayload; count: number }
  | { kind: 'playing'; match: MatchedPayload }
  | { kind: 'awaiting-opponent'; match: MatchedPayload; yourScore: number }
  | { kind: 'resolved'; resolution: MatchResolvedPayload }
  | { kind: 'connection-error'; message: string }

const COUNTDOWN_START = 3
const COUNTDOWN_STEP_MS = 800

function isTerminal(phase: Phase): boolean {
  return phase.kind === 'resolved' || phase.kind === 'connection-error'
}

export default function MatchLoader({ createModule, gameTitle, gameId, onExit }: MatchLoaderProps) {
  const { connectionState, match, resolution, error, submitScore, reportVisibilityHidden, disconnect } =
    useMatchSocket(gameId)
  const [phase, setPhase] = useState<Phase>({ kind: 'queued' })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const moduleRef = useRef<GameModule | null>(null)

  function destroyModule() {
    moduleRef.current?.destroy()
    moduleRef.current = null
  }

  // Evidence-only, for the whole component lifetime (queued through
  // resolved) — not gated to 'playing', so it keeps reporting after a run
  // has ended while still waiting on the opponent. See PROGRESS.md's
  // freeze-frame Known Gaps entry: this is one signal among several
  // client-side-only ones, not an enforcement mechanism on its own. A ref
  // (not a `match`-dependent effect) so the listener attaches once and
  // always reads the current matchId, rather than re-subscribing on every
  // match change.
  const matchIdRef = useRef<string | null>(null)
  useEffect(() => {
    matchIdRef.current = match?.matchId ?? null
  }, [match])

  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) return
      const matchId = matchIdRef.current
      if (matchId) reportVisibilityHidden(matchId)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [reportVisibilityHidden])

  // queued -> countdown, once the server pairs us with an opponent.
  useEffect(() => {
    if (!match) return
    setPhase((prev) => (prev.kind === 'queued' ? { kind: 'countdown', match, count: COUNTDOWN_START } : prev))
  }, [match])

  // countdown -> playing. Mounts the GameModule with the server-issued seed
  // once the count reaches zero — server generates, server sends, client
  // never proposes.
  useEffect(() => {
    if (phase.kind !== 'countdown') return

    if (phase.count <= 0) {
      const container = containerRef.current
      if (!container) return
      const mod = createModule()
      moduleRef.current = mod
      const matchInfo = phase.match
      mod.addEventListener('gameOver', ((e: Event) => {
        const payload = (e as CustomEvent<GameOverPayload>).detail
        // TEMPORARY DIAGNOSTIC — mirrors the server-side log in matches.ts's
        // submitScore. Remove both once the viewport/score-gap investigation
        // is resolved.
        console.log(
          `[match] DIAGNOSTIC gameOver: matchId=${matchInfo.matchId} seed=${matchInfo.seed} ` +
            `viewport=${payload.viewport.width}x${payload.viewport.height} score=${payload.score}`,
        )
        submitScore({
          matchId: matchInfo.matchId,
          score: payload.score,
          reason: payload.reason,
          durationMs: payload.durationMs,
          inputLog: payload.inputLog,
          viewport: payload.viewport,
        })
        setPhase((prev) =>
          prev.kind === 'playing' ? { kind: 'awaiting-opponent', match: prev.match, yourScore: payload.score } : prev,
        )
      }) as EventListener)
      mod.init(container, 'match', null, matchInfo.seed)
      mod.start()
      setPhase({ kind: 'playing', match: matchInfo })
      return
    }

    const timeoutId = setTimeout(() => {
      setPhase((prev) => (prev.kind === 'countdown' ? { ...prev, count: prev.count - 1 } : prev))
    }, COUNTDOWN_STEP_MS)
    return () => clearTimeout(timeoutId)
  }, [phase, createModule, submitScore])

  // Can arrive from any non-terminal phase — see the Phase type's comment.
  useEffect(() => {
    if (!resolution) return
    setPhase((prev) => {
      if (isTerminal(prev)) return prev
      destroyModule()
      return { kind: 'resolved', resolution }
    })
  }, [resolution])

  // Unexpected drop — a real error, or the socket closing before either
  // terminal server event arrived (e.g. a server restart mid-match).
  useEffect(() => {
    if (!error && connectionState !== 'closed') return
    setPhase((prev) => {
      if (isTerminal(prev)) return prev
      destroyModule()
      return { kind: 'connection-error', message: error ?? 'Connection lost.' }
    })
  }, [error, connectionState])

  useEffect(() => {
    return () => destroyModule()
  }, [])

  function handleLeave() {
    disconnect()
    onExit()
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
          {gameTitle} · Find Opponent
        </span>
        <button
          type="button"
          className="ac-btn ac-btn--ghost"
          onClick={handleLeave}
          style={{ padding: 'var(--space-1) var(--space-4)' }}
        >
          Exit
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {phase.kind === 'queued' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              <h2 style={{ margin: '0 0 var(--space-2)' }}>Finding an opponent...</h2>
              <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>
                Waiting for another {gameTitle} player
              </p>
              <button type="button" className="ac-btn ac-btn--ghost" onClick={handleLeave}>
                Cancel
              </button>
            </div>
          </Overlay>
        )}

        {phase.kind === 'countdown' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              <p className="ac-text-muted" style={{ margin: '0 0 var(--space-2)' }}>
                Opponent found: {phase.match.opponentUsername}
              </p>
              <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {phase.count > 0 ? phase.count : 'GO!'}
              </div>
            </div>
          </Overlay>
        )}

        {phase.kind === 'awaiting-opponent' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              <h2 style={{ margin: '0 0 var(--space-2)' }}>Your score: {phase.yourScore}</h2>
              <p className="ac-text-muted" style={{ margin: 0 }}>
                Waiting for {phase.match.opponentUsername} to finish...
              </p>
            </div>
          </Overlay>
        )}

        {phase.kind === 'resolved' && <ResolvedPanel resolution={phase.resolution} onLeave={handleLeave} />}

        {phase.kind === 'connection-error' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              <h2 style={{ margin: '0 0 var(--space-2)' }}>Connection lost</h2>
              <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>{phase.message}</p>
              <button type="button" className="ac-btn ac-btn--primary" onClick={handleLeave}>
                Back to Home
              </button>
            </div>
          </Overlay>
        )}
      </div>
    </div>
  )
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)',
      }}
    >
      {children}
    </div>
  )
}

function ResolvedPanel({ resolution, onLeave }: { resolution: MatchResolvedPayload; onLeave: () => void }) {
  const { you, opponent, outcome } = resolution
  // The server decides win/loss/draw/void (see packages/server/src/
  // validation/matchOutcome.ts) — this only picks display copy, it no
  // longer compares scores itself. `you.status === 'opponent_disconnected'`
  // (won because the opponent left mid-run, before this side ever
  // submitted) deliberately falls through to the outcome-based branches
  // below rather than getting its own message check — outcome is already
  // 'win' in that case, so "You win!" is correct without special-casing it
  // here; ScoreColumn is what shows the "opponent disconnected" detail.
  const message = you.status === 'forfeited'
    ? 'You forfeited — no result submitted in time.'
    : opponent.status === 'forfeited'
      ? `${opponent.username} forfeited — no result submitted in time.`
      : outcome === 'void'
        ? 'Result voided — a submitted score could not be verified.'
        : outcome === 'win'
          ? 'You win!'
          : outcome === 'loss'
            ? `${opponent.username} wins.`
            : "It's a tie."

  return (
    <Overlay>
      <div className="ac-panel" style={{ textAlign: 'center', minWidth: 320 }}>
        <h2 style={{ margin: '0 0 var(--space-2)' }}>Match Complete</h2>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
          <ScoreColumn label="You" result={you} />
          <ScoreColumn label={opponent.username} result={opponent} />
        </div>
        <button type="button" className="ac-btn ac-btn--primary" onClick={onLeave}>
          Back to Home
        </button>
      </div>
    </Overlay>
  )
}

function ScoreColumn({ label, result }: { label: string; result: PlayerResult }) {
  return (
    <div>
      <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
        {result.status === 'completed' ? result.score : '—'}
      </div>
      {result.status === 'forfeited' && (
        <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
          forfeited
        </div>
      )}
      {result.status === 'opponent_disconnected' && (
        <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
          opponent disconnected
        </div>
      )}
      {result.status === 'completed' && result.verdict === 'invalid' && (
        <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
          score rejected
        </div>
      )}
    </div>
  )
}
