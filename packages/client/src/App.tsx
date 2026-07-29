import { useState } from 'react'
import type { GameModuleFactory } from '@arcadeclash/shared'
import GameLoader from './game-loader/GameLoader'
import { gameFactories } from './game-loader/gameFactories'
import HomePage from './pages/HomePage'

type ActiveGame = { id: string; title: string; factory: GameModuleFactory }

function App() {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null)

  async function handlePlayGame(id: string, title: string) {
    const loadFactory = gameFactories[id]
    if (!loadFactory) return
    setLoadingGameId(id)
    const mod = await loadFactory()
    setLoadingGameId(null)
    setActiveGame({ id, title, factory: mod.default })
  }

  if (activeGame) {
    return (
      <GameLoader
        key={activeGame.id}
        createModule={activeGame.factory}
        gameTitle={activeGame.title}
        onExit={() => setActiveGame(null)}
      />
    )
  }

  return <HomePage onPlayGame={handlePlayGame} loadingGameId={loadingGameId} />
}

export default App
