// Standard interface every mini-game plugs into. "match" mode is accepted
// for forward compatibility but isn't implemented during the games-only
// phase — modules should log and fall back to practice-like behavior if
// they receive it (see PROGRESS.md "Current phase").
export type GameMode = "practice" | "match";

// One recorded input transition, tagged with the fixed-timestep tick it
// occurred on (not wall-clock time — see PROGRESS.md's determinism brief
// for why tick is the correct key: replay steps ticks, not real time).
export type InputLogEntry = {
  tick: number;
  action: string;
  // Real elapsed wall-clock ms since run start, captured at record time.
  // EVIDENCE ONLY — tick stays the sole authoritative replay key, and
  // nothing in the simulation or in replay may ever read this field (see
  // scripts/determinism-check.ts's wallMs-invariance test, which asserts
  // replay produces identical state with these values stripped or
  // randomized). Exists to make freeze-frame/time-dilation stalling
  // detectable later — a stalled player's real inputLog will show large
  // gaps between consecutive wallMs values relative to their tick deltas,
  // even though tick-keyed replay alone can't see it. Optional so
  // hand-authored or synthetic logs (tests, tooling) aren't required to
  // fabricate a wall-clock trace they don't have.
  wallMs?: number;
};

export type GameOverPayload = {
  score: number;
  reason: string;
  durationMs: number;
  seed: number;
  inputLog: InputLogEntry[];
  // The container size last passed to the engine's resize(), captured at
  // beginRun() — some engines' spawn/collision math is a function of
  // width/height (see packages/shared/src/replay.ts's ReplayAdapter doc),
  // so server-side replay needs this to reproduce the same run. Not
  // re-captured on a mid-run container resize (rare; see PROGRESS.md Known
  // Gaps) — only the size in effect when the run started.
  viewport: { width: number; height: number };
};

export interface GameModule extends EventTarget {
  init(container: HTMLElement, mode: GameMode, opponentSocket: WebSocket | null, seed: number): void;
  start(): void;
  pause(): void;
  destroy(): void;
}

export type GameModuleFactory = () => GameModule;
