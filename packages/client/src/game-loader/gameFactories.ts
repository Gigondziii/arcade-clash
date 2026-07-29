import type { GameModuleFactory } from "@arcadeclash/shared";

// One entry per game id in games/registry.ts. Manual and explicit rather
// than auto-derived from the registry — with 51 games eventually this is a
// one-line addition each; revisit only if that becomes genuinely tedious.
export const gameFactories: Record<string, () => Promise<{ default: GameModuleFactory }>> = {
  "neon-runner": () => import("@arcadeclash/games/neon-runner"),
  "pixel-ninja-dash": () => import("@arcadeclash/games/pixel-ninja-dash"),
};
