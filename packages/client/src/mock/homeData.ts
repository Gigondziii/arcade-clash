import type { GameEngine } from '@arcadeclash/games'

// Placeholder homepage data. Replace with real API calls once the game
// registry has entries and the matchmaking/leaderboard services exist.

export type MockGame = {
  id: string
  title: string
  engine: GameEngine
  plays: number
  rating: number
}

export const trendingGames: MockGame[] = [
  // Real, playable (see gameFactories.ts) — plays/rating are honestly 0, not fabricated popularity.
  { id: 'neon-runner', title: 'Neon Runner', engine: 'runner', plays: 0, rating: 0 },
  { id: 'pixel-ninja-dash', title: 'Pixel Ninja Dash', engine: 'reflex-timing', plays: 0, rating: 0 },
  { id: 'turbo-drift', title: 'Turbo Drift', engine: 'racer', plays: 845_000, rating: 4.3 },
  { id: 'vault-siege', title: 'Vault Siege', engine: 'arena-shooter', plays: 2_100_000, rating: 4.8 },
  { id: 'sky-dodge', title: 'Sky Dodge', engine: 'falling-block', plays: 0, rating: 0 },
  { id: 'pinball-frenzy', title: 'Pinball Frenzy', engine: 'physics-table', plays: 110_000, rating: 3.9 },
  { id: 'grid-duel', title: 'Grid Duel', engine: 'turn-based-board', plays: 268_000, rating: 4.4 },
]

export const featuredGame: {
  id: string
  title: string
  engine: GameEngine
  tagline: string
  description: string
} = {
  id: 'skyline-ascent',
  title: 'Skyline Ascent',
  engine: 'runner',
  tagline: 'FEATURED GAME OF THE WEEK',
  description: 'Climb an endless tower before the storm catches you. How high can you go before it does?',
}

// Static placeholder until the matchmaking/WebSocket layer reports a real count.
export const liveArenaCount = 128

export const navFilters: Array<{ label: string; engine: GameEngine | 'all' | 'hot' }> = [
  { label: 'All', engine: 'all' },
  { label: 'Runner', engine: 'runner' },
  { label: 'Arena Shooter', engine: 'arena-shooter' },
  { label: 'Falling Block', engine: 'falling-block' },
  { label: 'Reflex Timing', engine: 'reflex-timing' },
  { label: 'Hot', engine: 'hot' },
]
