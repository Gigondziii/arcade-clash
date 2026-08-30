// Mirrors the hex values in theme.css for canvas/WebGL games that can't use
// CSS custom properties directly. Keep in sync with theme.css by hand.
export const colors = {
  bg: "#0a0a0f",
  surface: "#121218",
  surfaceRaised: "#1a1a23",
  border: "#26262f",
  primary: "#7c3aed",
  primaryHover: "#8b5cf6",
  primaryActive: "#6d28d9",
  secondary: "#fbbf24",
  secondaryHover: "#fcd34d",
  secondaryActive: "#d97706",
  success: "#34d399",
  danger: "#f87171",
  warning: "#fb923c",
  text: "#f5f5f7",
  textMuted: "#9a9aa8",
} as const;

export type ThemeColorName = keyof typeof colors;

// Per-engine tag color, keyed to match the GameEngine union in games/registry.ts.
// Duplicated here (rather than imported) so this package never depends on games/.
export const categoryColors = {
  runner: "#34d399",
  racer: "#38bdf8",
  "arena-shooter": "#fb7185",
  "falling-block": "#fb923c",
  "physics-table": "#e879f9",
  "turn-based-board": "#818cf8",
  "reflex-timing": "#a3e635",
  "word-trivia": "#22d3ee",
  quiz: "#22d3ee",
} as const;

export type CategoryName = keyof typeof categoryColors;

// Reads a CSS custom property's live cascaded value from the document root.
// Use when a component needs the actual runtime value rather than the string "var(--x)".
export function getThemeColor(cssVarName: string, fallback = ""): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  return value || fallback;
}
