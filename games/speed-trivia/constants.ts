export const PALETTE = {
  bg: "#080a14",
  cardBg: "#12172b",
  cardBorder: "#252e50",
  primary: "#7c3aed",
  secondary: "#06b6d4",
  accent: "#f59e0b",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  success: "#10b981",
  danger: "#ef4444",
} as const;

export const TRIVIA_RULES = {
  ticksPerQuestion: 600, // 10 seconds at 60 FPS
  totalQuestions: 10,
  baseQuestionScore: 1000,
} as const;
