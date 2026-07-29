// Standard interface every mini-game plugs into. "match" mode is accepted
// for forward compatibility but isn't implemented during the games-only
// phase — modules should log and fall back to practice-like behavior if
// they receive it (see PROGRESS.md "Current phase").
export type GameMode = "practice" | "match";

export type GameOverPayload = {
  score: number;
  reason: string;
  durationMs: number;
};

export interface GameModule extends EventTarget {
  init(container: HTMLElement, mode: GameMode, opponentSocket: WebSocket | null): void;
  start(): void;
  pause(): void;
  destroy(): void;
}

export type GameModuleFactory = () => GameModule;
