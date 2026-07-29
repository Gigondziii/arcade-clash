// This game's own neon palette — deliberately distinct from the app-shell
// theme (@arcadeclash/theme's violet/gold). Each game module owns its
// in-canvas visual identity; the shared theme only governs app chrome
// (nav, homepage, HUD-adjacent React UI like the results screen).
export const PALETTE = {
  bg: "#05060a",
  grid: "#1a1c2e",
  cyan: "#2de2ff",
  magenta: "#ff36e0",
  purple: "#9256ff",
  lime: "#c6ff3d",
  text: "#f0f2ff",
} as const;

export const PHYSICS = {
  gravity: 2200,
  jumpVelocity: -820,
  jumpCutMultiplier: 0.45,
  slideDurationMs: 500,
} as const;

export const WORLD = {
  initialSpeed: 320,
  maxSpeed: 780,
  speedRampPerSec: 14,
  initialSpawnIntervalMs: 1500,
  minSpawnIntervalMs: 650,
  spawnIntervalDecayPerSec: 35,
} as const;

export const PLAYER = {
  xFraction: 0.18,
  width: 34,
  heightStand: 52,
  heightSlide: 28,
} as const;

export const OBSTACLE = {
  hurdleHeight: 44,
  overhangGap: 38,
} as const;
