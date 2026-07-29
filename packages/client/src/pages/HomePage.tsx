import Hero from '../components/Hero'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Hero />
        <TrendingArena />
      </main>
    </>
  )
}
