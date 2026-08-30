export const PALETTE = {
  bg: "#090d16",
  cardBg: "#131a2e",
  cardBorder: "#273456",
  primary: "#3b82f6",
  secondary: "#06b6d4",
  accent: "#f59e0b",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  trueColor: "#10b981",
  trueBg: "#064e3b",
  falseColor: "#ef4444",
  falseBg: "#7f1d1d",
} as const;

export const TF_RULES = {
  ticksPerQuestion: 300, // 5 seconds at 60 FPS per rapid-fire statement
  totalQuestions: 15,
  baseQuestionScore: 1000,
} as const;

export function getMultiplier(streak: number): number {
  if (streak >= 7) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}
