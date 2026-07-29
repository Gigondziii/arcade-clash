export type GameEngine =
  | "runner"
  | "racer"
  | "arena-shooter"
  | "falling-block"
  | "physics-table"
  | "turn-based-board"
  | "reflex-timing"
  | "word-trivia";

export type GameRegistryEntry = {
  id: string;
  name: string;
  engine: GameEngine;
  modulePath: string;
};

export const gameRegistry: GameRegistryEntry[] = [
  { id: "neon-runner", name: "Neon Runner", engine: "runner", modulePath: "./neon-runner/index.ts" },
];
