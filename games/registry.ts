export type GameEngine =
  | "runner"
  | "racer"
  | "arena-shooter"
  | "falling-block"
  | "physics-table"
  | "turn-based-board"
  | "reflex-timing"
  | "word-trivia"
  | "quiz";

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
  {
    id: "space-blaster",
    name: "Space Blaster",
    engine: "arena-shooter",
    modulePath: "./space-blaster/index.ts",
  },
  {
    id: "cyber-hopper",
    name: "Cyber Hopper",
    engine: "reflex-timing",
    modulePath: "./cyber-hopper/index.ts",
  },
  {
    id: "speed-trivia",
    name: "Speed Trivia Clash",
    engine: "quiz",
    modulePath: "./speed-trivia/index.ts",
  },
  {
    id: "tf-sprint",
    name: "True / False Sprint",
    engine: "quiz",
    modulePath: "./tf-sprint/index.ts",
  },
];
