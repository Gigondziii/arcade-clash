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
  {
    id: "pixel-ninja-dash",
    name: "Pixel Ninja Dash",
    engine: "reflex-timing",
    modulePath: "./pixel-ninja-dash/index.ts",
  },
  { id: "sky-dodge", name: "Sky Dodge", engine: "falling-block", modulePath: "./sky-dodge/index.ts" },
];
