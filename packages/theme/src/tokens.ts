// Mirrors the hex values in theme.css for canvas/WebGL games that can't use
// CSS custom properties directly. Keep in sync with theme.css by hand.
export const colors = {
  bg: "#05060a",
  surface: "#0d0f1a",
  surfaceRaised: "#14172a",
  border: "#262a42",
  cyan: "#2de2ff",
  cyanDim: "#1592a8",
  magenta: "#ff36e0",
  magentaDim: "#a01f92",
  purple: "#9256ff",
  purpleDim: "#5a349e",
  success: "#2dffb0",
  danger: "#ff3b5c",
  warning: "#ffcc33",
  text: "#e8e9f5",
  textMuted: "#8d90ad",
} as const;

export type ThemeColorName = keyof typeof colors;

// Reads a CSS custom property's live cascaded value from the document root.
// Use when a component needs the actual runtime value rather than the string "var(--x)".
export function getThemeColor(cssVarName: string, fallback = ""): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVarName).trim();
  return value || fallback;
}
