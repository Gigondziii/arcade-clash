import type { GameModuleFactory } from "@fugluck/shared";

// One entry per game id in games/registry.ts. Manual and explicit rather
// than auto-derived from the registry — with 51 games eventually this is a
// one-line addition each; revisit only if that becomes genuinely tedious.
export const gameFactories: Record<string, () => Promise<{ default: GameModuleFactory }>> = {
  "neon-runner": () => import("@fugluck/games/neon-runner"),
  "pixel-ninja-dash": () => import("@fugluck/games/pixel-ninja-dash"),
  "space-blaster": () => import("@fugluck/games/space-blaster"),
  "cyber-hopper": () => import("@fugluck/games/cyber-hopper"),
  "speed-trivia": () => import("@fugluck/games/speed-trivia"),
  "tf-sprint": () => import("@fugluck/games/tf-sprint"),
};
