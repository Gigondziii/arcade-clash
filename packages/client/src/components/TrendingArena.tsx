import { useAuth } from '../auth/AuthContext'
import { gameFactories } from '../game-loader/gameFactories'
import { trendingGames } from '../mock/homeData'
import GameCard from './GameCard'
import { TrendingIcon } from './icons'

type TrendingArenaProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string) => void
  loadingGameId: string | null
}

export default function TrendingArena({ onPlayGame, onFindOpponent, loadingGameId }: TrendingArenaProps) {
  const { user } = useAuth()
  return (
    <section style={{ margin: '0 var(--space-6) var(--space-8)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <TrendingIcon className="ac-text-muted" />
          <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Trending Arena</h2>
        </div>
        <a href="#" className="ac-link--secondary">
          View Leaderboards →
        </a>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--space-5)',
        }}
      >
        {trendingGames.map((game) => (
          <GameCard
            key={game.id}
            title={game.title}
            engine={game.engine}
            plays={game.plays}
            rating={game.rating}
            loading={loadingGameId === game.id}
            onPlay={game.id in gameFactories ? () => onPlayGame(game.id, game.title) : undefined}
            onFindOpponent={
              user && game.id in gameFactories ? () => onFindOpponent(game.id, game.title) : undefined
            }
          />
        ))}
      </div>
    </section>
  )
}
