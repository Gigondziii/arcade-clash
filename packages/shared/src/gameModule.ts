// Standard interface every mini-game plugs into. "match" mode is accepted
// for forward compatibility but isn't implemented during the games-only
// phase — modules should log and fall back to practice-like behavior if
// they receive it (see PROGRESS.md "Current phase").
export type GameMode = "practice" | "match";

// Canonical virtual viewport across all games — physics, obstacle spawn,
// and server-side validation are locked to this 16:9 resolution (1280x720).
// Client containers letterbox this viewport to guarantee identical physics
// and scoring regardless of client monitor size or aspect ratio.
export const VIRTUAL_VIEWPORT = { width: 1280, height: 720 };

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

export type GameCategory =
  | "runner"
  | "racer"
  | "arena-shooter"
  | "falling-block"
  | "physics-table"
  | "turn-based-board"
  | "reflex-timing"
  | "word-trivia"
  | "quiz";

export type GameRegistryItem = {
  id: string;
  name: string;
  engine: GameCategory | string;
  modulePath: string;
};

export const GAME_REGISTRY: GameRegistryItem[] = [
  { id: "neon-runner", name: "Neon Runner", engine: "runner", modulePath: "./neon-runner/index.ts" },
  { id: "pixel-ninja-dash", name: "Pixel Ninja Dash", engine: "reflex-timing", modulePath: "./pixel-ninja-dash/index.ts" },
  { id: "space-blaster", name: "Space Blaster", engine: "arena-shooter", modulePath: "./space-blaster/index.ts" },
  { id: "cyber-hopper", name: "Cyber Hopper", engine: "reflex-timing", modulePath: "./cyber-hopper/index.ts" },
  { id: "speed-trivia", name: "Speed Trivia Clash", engine: "quiz", modulePath: "./speed-trivia/index.ts" },
  { id: "tf-sprint", name: "True / False Sprint", engine: "quiz", modulePath: "./tf-sprint/index.ts" },
];

export function getGameTitle(gameId: string): string {
  const item = GAME_REGISTRY.find((g) => g.id === gameId);
  return item?.name ?? gameId;
}


