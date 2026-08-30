import { useAuth } from '../auth/AuthContext'
import { gameFactories } from '../game-loader/gameFactories'
import { activeGames } from '../mock/homeData'
import GameCard from './GameCard'
import { TrendingIcon } from './icons'

type TrendingArenaProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  onLaunchGuestInvite?: (id: string, title: string) => void
  loadingGameId: string | null
  selectedCategory?: string
  searchQuery?: string
  onClearSearch?: () => void
}

export default function TrendingArena({
  onPlayGame,
  onFindOpponent,
  onLaunchGuestInvite,
  loadingGameId,
  selectedCategory = 'all',
  searchQuery = '',
  onClearSearch,
}: TrendingArenaProps) {
  const { user } = useAuth()

  const trimmedQuery = searchQuery.trim().toLowerCase()

  const filteredGames = activeGames.filter((game) => {
    // 1. Category match
    const categoryMatches =
      !selectedCategory || selectedCategory.toLowerCase() === 'all' || game.engine.toLowerCase() === selectedCategory.toLowerCase()
    if (!categoryMatches) return false

    // 2. Search query match
    if (trimmedQuery) {
      const titleMatches = game.title.toLowerCase().includes(trimmedQuery)
      const engineMatches = game.engine.toLowerCase().includes(trimmedQuery)
      const taglineMatches = game.tagline?.toLowerCase().includes(trimmedQuery)
      return Boolean(titleMatches || engineMatches || taglineMatches)
    }

    return true
  })

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
          <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>
            {trimmedQuery ? `Search Results: "${searchQuery}"` : 'Active Arena Games'}
          </h2>
        </div>
        {trimmedQuery && onClearSearch && (
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onClearSearch}
            style={{ fontSize: 'var(--font-size-xs)' }}
          >
            Clear Search
          </button>
        )}
      </div>

      {filteredGames.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            background: 'var(--color-bg-subtle)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-md)',
          }}
        >
          {trimmedQuery ? (
            <div>
              <p style={{ margin: '0 0 var(--space-3)' }}>No games found matching "{searchQuery}".</p>
              {onClearSearch && (
                <button type="button" className="ac-btn ac-btn--primary" onClick={onClearSearch}>
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <p style={{ margin: 0 }}>No active games found in this category.</p>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              title={game.title}
              engine={game.engine}
              tagline={game.tagline}
              loading={loadingGameId === game.id}
              onPlay={game.id in gameFactories ? () => onPlayGame(game.id, game.title) : undefined}
              onFindOpponent={
                user && game.id in gameFactories
                  ? (stake, currency) => onFindOpponent(game.id, game.title, stake, currency)
                  : undefined
              }
              onLaunchGuestInvite={
                game.id in gameFactories
                  ? () => onLaunchGuestInvite?.(game.id, game.title)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
