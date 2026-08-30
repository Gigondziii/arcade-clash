export const VIRTUAL_WIDTH = 1280;
export const VIRTUAL_HEIGHT = 720;

export const GRID_COLS = 20;
export const GRID_ROWS = 11;
export const CELL_WIDTH = VIRTUAL_WIDTH / GRID_COLS; // 64px
export const CELL_HEIGHT = VIRTUAL_HEIGHT / GRID_ROWS; // ~65.45px

export const HOPPER_WIDTH = 48;
export const HOPPER_HEIGHT = 48;

export const CYBER_COLORS = {
  bg: "#060913",
  gridLine: "rgba(0, 240, 255, 0.12)",
  safeZone: "#0d1b2a",
  finishZone: "#1b4332",
  playerPrimary: "#00ff66", // Cyber neon green
  playerSecondary: "#00ffff",
  playerGlow: "rgba(0, 255, 102, 0.5)",
  carLeft: "#ff0055", // Neon red/pink
  carRight: "#7000ff", // Neon purple
  plasma: "#ffaa00", // Gold/Orange
  laser: "#00f0ff", // Cyan
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
};
