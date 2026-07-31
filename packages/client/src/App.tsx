import { useState } from 'react'
import type { GameModuleFactory } from '@arcadeclash/shared'
import { AuthProvider } from './auth/AuthContext'
import GameLoader from './game-loader/GameLoader'
import { gameFactories } from './game-loader/gameFactories'
import MatchLoader from './game-loader/MatchLoader'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'

type ActiveGame = { id: string; title: string; factory: GameModuleFactory; mode: 'practice' | 'match' }
type View = 'home' | 'profile'

function App() {
  const [view, setView] = useState<View>('home')
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null)

  async function loadGame(id: string, title: string, mode: 'practice' | 'match') {
    const loadFactory = gameFactories[id]
    if (!loadFactory) return
    setLoadingGameId(id)
    const mod = await loadFactory()
    setLoadingGameId(null)
    setActiveGame({ id, title, factory: mod.default, mode })
  }

  function handlePlayGame(id: string, title: string) {
    return loadGame(id, title, 'practice')
  }

  function handleFindOpponent(id: string, title: string) {
    return loadGame(id, title, 'match')
  }

  return (
    <AuthProvider>
      {activeGame?.mode === 'practice' ? (
        <GameLoader
          key={activeGame.id}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          onExit={() => setActiveGame(null)}
        />
      ) : activeGame?.mode === 'match' ? (
        <MatchLoader
          key={activeGame.id}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          gameId={activeGame.id}
          onExit={() => setActiveGame(null)}
        />
      ) : view === 'profile' ? (
        <ProfilePage onNavigateHome={() => setView('home')} />
      ) : (
        <HomePage
          onPlayGame={handlePlayGame}
          onFindOpponent={handleFindOpponent}
          loadingGameId={loadingGameId}
          onNavigateProfile={() => setView('profile')}
        />
      )}
    </AuthProvider>
  )
}

export default App
