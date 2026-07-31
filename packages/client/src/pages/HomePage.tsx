import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string) => void
  loadingGameId: string | null
  onNavigateProfile: () => void
}

export default function HomePage({ onPlayGame, onFindOpponent, loadingGameId, onNavigateProfile }: HomePageProps) {
  return (
    <>
      <Navbar onNavigateHome={() => {}} onNavigateProfile={onNavigateProfile} />
      <main style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Hero />
        <TrendingArena onPlayGame={onPlayGame} onFindOpponent={onFindOpponent} loadingGameId={loadingGameId} />
      </main>
    </>
  )
}
