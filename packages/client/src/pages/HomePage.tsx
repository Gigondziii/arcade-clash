import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string) => void
  loadingGameId: string | null
  onNavigateProfile: () => void
  onNavigateFriends: () => void
}

export default function HomePage({
  onPlayGame,
  onFindOpponent,
  loadingGameId,
  onNavigateProfile,
  onNavigateFriends,
}: HomePageProps) {
  return (
    <>
      <Navbar
        onNavigateHome={() => {}}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
      />
      <main style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Hero />
        <TrendingArena onPlayGame={onPlayGame} onFindOpponent={onFindOpponent} loadingGameId={loadingGameId} />
      </main>
    </>
  )
}
