import { useState } from 'react'
import type { GameModuleFactory, InviteReceivedPayload } from '@arcadeclash/shared'
import { AuthProvider } from './auth/AuthContext'
import GameLoader from './game-loader/GameLoader'
import { gameFactories } from './game-loader/gameFactories'
import MatchLoader from './game-loader/MatchLoader'
import { InviteProvider } from './invites/InviteProvider'
import type { MatchSocketMode } from './matchmaking/useMatchSocket'
import FriendsPage from './pages/FriendsPage'
import HomePage from './pages/HomePage'
import ProfilePage from './pages/ProfilePage'

type ActiveGame = {
  id: string
  title: string
  factory: GameModuleFactory
  mode: 'practice' | 'match'
  matchMode?: MatchSocketMode
}
type View = 'home' | 'profile' | 'friends'

const GAME_TITLES: Record<string, string> = {
  'neon-runner': 'Neon Runner',
  'pixel-ninja-dash': 'Pixel Ninja Dash',
  'sky-dodge': 'Sky Dodge',
}

function AppShell() {
  const [view, setView] = useState<View>('home')
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null)

  async function loadGame(
    id: string,
    title: string,
    mode: 'practice' | 'match',
    matchMode?: MatchSocketMode,
  ) {
    const loadFactory = gameFactories[id]
    if (!loadFactory) return
    setLoadingGameId(id)
    const mod = await loadFactory()
    setLoadingGameId(null)
    setActiveGame({ id, title, factory: mod.default, mode, matchMode })
  }

  function handlePlayGame(id: string, title: string) {
    return loadGame(id, title, 'practice')
  }

  function handleFindOpponent(id: string, title: string) {
    return loadGame(id, title, 'match', { kind: 'queue' })
  }

  function handleInviteFriend(friendUserId: string, gameId: string, gameTitle: string) {
    return loadGame(gameId, gameTitle, 'match', { kind: 'sendInvite', friendUserId })
  }

  function handleAcceptInvite(invite: InviteReceivedPayload) {
    const title = GAME_TITLES[invite.gameId] ?? invite.gameId
    void loadGame(invite.gameId, title, 'match', { kind: 'acceptInvite', inviteId: invite.inviteId })
  }

  return (
    <InviteProvider onAcceptInvite={handleAcceptInvite} enabled={!activeGame || activeGame.mode === 'practice'}>
      {activeGame?.mode === 'practice' ? (
        <GameLoader
          key={activeGame.id}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          onExit={() => setActiveGame(null)}
        />
      ) : activeGame?.mode === 'match' ? (
        <MatchLoader
          key={`${activeGame.id}-${activeGame.matchMode?.kind ?? 'queue'}`}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          gameId={activeGame.id}
          matchMode={activeGame.matchMode}
          onExit={() => setActiveGame(null)}
        />
      ) : view === 'profile' ? (
        <ProfilePage
          onNavigateHome={() => setView('home')}
          onNavigateFriends={() => setView('friends')}
        />
      ) : view === 'friends' ? (
        <FriendsPage
          onNavigateHome={() => setView('home')}
          onNavigateProfile={() => setView('profile')}
          onInviteFriend={handleInviteFriend}
        />
      ) : (
        <HomePage
          onPlayGame={handlePlayGame}
          onFindOpponent={handleFindOpponent}
          loadingGameId={loadingGameId}
          onNavigateProfile={() => setView('profile')}
          onNavigateFriends={() => setView('friends')}
        />
      )}
    </InviteProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App
