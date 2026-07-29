import type { GameEngine } from '@arcadeclash/games'

export function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

export function engineLabel(engine: GameEngine): string {
  return engine
    .split('-')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}
