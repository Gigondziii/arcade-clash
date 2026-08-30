import type { GameEngine } from '@fugluck/games'

export type CatalogGame = {
  id: string
  title: string
  engine: GameEngine
  tagline?: string
}

export const activeGames: CatalogGame[] = [
  { id: 'neon-runner', title: 'Neon Runner', engine: 'runner', tagline: 'High-speed neon runner survival race' },
  { id: 'pixel-ninja-dash', title: 'Pixel Ninja Dash', engine: 'reflex-timing', tagline: 'Precision rooftop dash and leap reflex challenge' },
  { id: 'space-blaster', title: 'Space Blaster', engine: 'arena-shooter', tagline: 'Retro vector arcade space shooter' },
  { id: 'cyber-hopper', title: 'Cyber Hopper', engine: 'reflex-timing', tagline: 'Synthwave road-crossing timing and evasion' },
  { id: 'speed-trivia', title: 'Speed Trivia Clash', engine: 'quiz', tagline: '10-question speed trivia speed duel' },
  { id: 'tf-sprint', title: 'True / False Sprint', engine: 'quiz', tagline: 'Rapid-fire True or False trivia clash' },
]

export const trendingGames = activeGames

export const navFilters: Array<{ label: string; engine: GameEngine | 'all' }> = [
  { label: 'All', engine: 'all' },
  { label: 'Runner', engine: 'runner' },
  { label: 'Arena Shooter', engine: 'arena-shooter' },
  { label: 'Reflex Timing', engine: 'reflex-timing' },
  { label: 'Quiz', engine: 'quiz' },
]
