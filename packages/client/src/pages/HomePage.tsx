import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  loadingGameId: string | null
}

export default function HomePage({ onPlayGame, loadingGameId }: HomePageProps) {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Hero />
        <TrendingArena onPlayGame={onPlayGame} loadingGameId={loadingGameId} />
      </main>
    </>
  )
}
