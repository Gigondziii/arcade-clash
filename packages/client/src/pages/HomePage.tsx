import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import AuthModal from '../components/AuthModal'
import Footer from '../components/Footer'
import LiveQueueList from '../components/LiveQueueList'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  onLaunchGuestInvite?: (id: string, title: string) => void
  loadingGameId: string | null
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet?: () => void
  onNavigatePolicy?: (path: string) => void
  initialAuthModalMode?: 'login' | 'signup'
}

export default function HomePage({
  onPlayGame,
  onFindOpponent,
  onLaunchGuestInvite,
  loadingGameId,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigatePolicy,
  initialAuthModalMode,
}: HomePageProps) {
  const { user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(initialAuthModalMode ?? null)

  useEffect(() => {
    if (user) setAuthModalMode(null)
  }, [user])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onNavigateHome={() => {
          setSelectedCategory('all')
          setSearchQuery('')
        }}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <main style={{ flex: 1, maxWidth: 1400, width: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-4)', boxSizing: 'border-box' }}>
        <LiveQueueList onFindOpponent={onFindOpponent} />
        <TrendingArena
          onPlayGame={onPlayGame}
          onFindOpponent={onFindOpponent}
          onLaunchGuestInvite={onLaunchGuestInvite}
          loadingGameId={loadingGameId}
          selectedCategory={selectedCategory}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
        />
      </main>
      <Footer onNavigate={onNavigatePolicy ?? (() => {})} />
      {authModalMode && <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />}
    </div>
  )
}

