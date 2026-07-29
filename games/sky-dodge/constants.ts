// This game's own neon palette — see games/neon-runner/constants.ts for why
// each game owns its palette independent of the app-shell theme.
export const PALETTE = {
  bg: "#05060a",
  cyan: "#2de2ff",
  magenta: "#ff36e0",
  purple: "#9256ff",
  lime: "#c6ff3d",
  text: "#f0f2ff",
} as const;

export const WORLD = {
  shipMoveSpeed: 420, // px/s while an arrow key is held
  dragLerpRatePerSec: 14, // how snappily the ship follows a drag target
  shipWidth: 40,
  shipHeight: 28,
  baseFallSpeed: 160,
  maxFallSpeed: 520,
  fallSpeedRampPerSec: 6,
  baseSpawnIntervalSec: 0.9,
  minSpawnIntervalSec: 0.28,
  spawnIntervalRampPerSec: 0.012,
  hazardMinSize: 22,
  hazardMaxSize: 40,
} as const;

export const SHIELD = {
  durationSec: 1.2,
  cooldownSec: 8,
} as const;
