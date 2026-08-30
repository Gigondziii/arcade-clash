import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameTitle, type GameModuleFactory, type InviteReceivedPayload } from '@fugluck/shared'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AuthModal from './components/AuthModal'
import GameLoader from './game-loader/GameLoader'
import { gameFactories } from './game-loader/gameFactories'
import MatchLoader from './game-loader/MatchLoader'
import { InviteProvider } from './invites/InviteProvider'
import InviteLanding from './invites/InviteLanding'
import type { MatchSocketMode } from './matchmaking/useMatchSocket'
import AdminConsolePage from './admin/AdminConsolePage'
import FriendsPage from './pages/FriendsPage'
import HelpCenterPage from './pages/HelpCenterPage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import PolicyPage from './pages/PolicyPage'
import ProfilePage from './pages/ProfilePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import WalletPage from './pages/WalletPage'
import { apiFetch, ApiError } from './lib/api'

type ActiveGame = {
  id: string
  title: string
  factory: GameModuleFactory
  mode: 'practice' | 'match'
  matchMode?: MatchSocketMode
}

const POLICY_SLUGS = [
  'terms',
  'privacy',
  'cookies',
  'rules',
  'diamonds',
  'withdrawals',
  'refunds',
  'responsible-play',
  'eligibility',
  'fair-play',
  'disputes',
  'data-rights',
  'security',
  'about',
  'contact',
] as const

type PolicySlug = (typeof POLICY_SLUGS)[number]

type View =
  | 'home'
  | 'profile'
  | 'friends'
  | 'wallet'
  | 'login'
  | 'signup'
  | 'admin'
  | 'verify-email'
  | 'reset-password'
  | 'invite'
  | 'help'
  | `policy:${PolicySlug}`
  | 'not-found'

const ACTIVE_MATCH_STORAGE_KEY = 'fugluck_active_match'
const LEGACY_ACTIVE_MATCH_STORAGE_KEY = 'arcadeclash_active_match'

type StoredActiveMatch = { id: string; title: string }

function storeActiveMatch(match: StoredActiveMatch | null) {
  try {
    if (match) {
      sessionStorage.setItem(ACTIVE_MATCH_STORAGE_KEY, JSON.stringify(match))
    } else {
      sessionStorage.removeItem(ACTIVE_MATCH_STORAGE_KEY)
      sessionStorage.removeItem(LEGACY_ACTIVE_MATCH_STORAGE_KEY)
    }
  } catch {
    // A disabled storage surface should not prevent ordinary matchmaking.
  }
}

function readStoredActiveMatch(): StoredActiveMatch | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_MATCH_STORAGE_KEY) || sessionStorage.getItem(LEGACY_ACTIVE_MATCH_STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StoredActiveMatch>
    if (typeof value.id !== 'string' || typeof value.title !== 'string' || !gameFactories[value.id]) {
      storeActiveMatch(null)
      return null
    }
    return { id: value.id, title: value.title }
  } catch {
    storeActiveMatch(null)
    return null
  }
}

function parseInviteCode(pathname: string): string | null {
  const match = pathname.match(/^\/(?:play\/)?invite\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

function getViewFromPath(pathname: string): View {
  const cleanPath = pathname.replace(/\/$/, '') || '/'
  if (cleanPath === '/' || cleanPath === '/home') return 'home'
  if (cleanPath === '/profile') return 'profile'
  if (cleanPath === '/friends') return 'friends'
  if (cleanPath === '/wallet') return 'wallet'
  if (cleanPath === '/login') return 'login'
  if (cleanPath === '/signup') return 'signup'
  if (cleanPath === '/admin') return 'admin'
  if (cleanPath === '/verify-email') return 'verify-email'
  if (cleanPath === '/reset-password') return 'reset-password'
  if (cleanPath === '/help') return 'help'
  if (cleanPath.startsWith('/invite/') || cleanPath.startsWith('/play/invite/')) return 'invite'

  const stripped = cleanPath.slice(1)
  if (POLICY_SLUGS.includes(stripped as PolicySlug)) {
    return `policy:${stripped as PolicySlug}`
  }

  return 'not-found'
}

function getPathForView(view: View): string {
  if (view.startsWith('policy:')) {
    return `/${view.slice(7)}`
  }
  switch (view) {
    case 'profile':
      return '/profile'
    case 'friends':
      return '/friends'
    case 'wallet':
      return '/wallet'
    case 'login':
      return '/login'
    case 'signup':
      return '/signup'
    case 'admin':
      return '/admin'
    case 'verify-email':
      return '/verify-email'
    case 'reset-password':
      return '/reset-password'
    case 'help':
      return '/help'
    case 'home':
      return '/'
    case 'invite':
    case 'not-found':
    default:
      return window.location.pathname
  }
}

function updateSocialMetaTags(title: string, path: string) {
  const baseUrl = 'https://fugluck.com'
  const fullUrl = `${baseUrl}${path}`

  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', title)

  const twitterTitle = document.querySelector('meta[name="twitter:title"]')
  if (twitterTitle) twitterTitle.setAttribute('content', title)

  const ogUrl = document.querySelector('meta[property="og:url"]')
  if (ogUrl) ogUrl.setAttribute('content', fullUrl)

  const canonical = document.querySelector('link[rel="canonical"]')
  if (canonical) canonical.setAttribute('href', fullUrl)
}

function AppShell() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [view, setViewState] = useState<View>(() => getViewFromPath(window.location.pathname))
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null)
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null)
  const [restoringActiveMatch, setRestoringActiveMatch] = useState(() => readStoredActiveMatch() !== null)
  const [pendingRedirectView, setPendingRedirectView] = useState<View | null>(null)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null)
  const [inviteJoin, setInviteJoin] = useState<{
    status: 'looking-up' | 'joining' | 'error'
    code: string
    hostUsername?: string
    gameTitle?: string
    message?: string
  } | null>(null)
  const inviteJoinAttemptRef = useRef<string | null>(null)

  useEffect(() => {
    const stored = readStoredActiveMatch()
    if (stored) {
      void loadGame(stored.id, stored.title, 'match', { kind: 'resume' }).finally(() => setRestoringActiveMatch(false))
    } else {
      setRestoringActiveMatch(false)
    }
  }, [])

  // If unauthenticated and navigating to protected views, show login modal and remember destination
  useEffect(() => {
    const protectedViews: View[] = ['profile', 'friends', 'wallet', 'admin']
    if (!user && protectedViews.includes(view)) {
      setPendingRedirectView(view)
      setAuthModalMode('login')
    } else if (user && pendingRedirectView) {
      navigateTo(pendingRedirectView)
      setPendingRedirectView(null)
      setAuthModalMode(null)
    }
  }, [user, view])

  function getTitleForView(targetView: View): string {
    if (targetView.startsWith('policy:')) {
      const slug = targetView.slice(7)
      const formattedSlug = slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
      return `Fugluck — ${formattedSlug}`
    }
    switch (targetView) {
      case 'profile':
        return t('meta.titleProfile')
      case 'friends':
        return t('meta.titleFriends')
      case 'wallet':
        return t('meta.titleWallet')
      case 'login':
        return t('meta.titleLogin')
      case 'signup':
        return t('meta.titleSignup')
      case 'admin':
        return t('meta.titleAdmin')
      case 'verify-email':
        return 'Fugluck — Verify Account'
      case 'reset-password':
        return 'Fugluck — Reset Password'
      case 'help':
        return 'Fugluck — Help Center & FAQ'
      case 'not-found':
        return t('meta.titleNotFound')
      case 'home':
      default:
        return t('meta.titleHome')
    }
  }

  useEffect(() => {
    const title = getTitleForView(view)
    const path = getPathForView(view)
    document.title = title
    updateSocialMetaTags(title, path)
  }, [view, i18n.language, t])

  useEffect(() => {
    const handlePopState = () => {
      const newView = getViewFromPath(window.location.pathname)
      setViewState(newView)
      const title = getTitleForView(newView)
      const path = getPathForView(newView)
      document.title = title
      updateSocialMetaTags(title, path)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [i18n.language, t])

  function navigateTo(targetView: View) {
    setViewState(targetView)
    const targetPath = getPathForView(targetView)
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath)
    }
    const title = getTitleForView(targetView)
    document.title = title
    updateSocialMetaTags(title, targetPath)
  }

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

  useEffect(() => {
    if (view !== 'invite') {
      inviteJoinAttemptRef.current = null
      if (inviteJoin) setInviteJoin(null)
      return
    }
    const code = parseInviteCode(window.location.pathname)
    if (!code) {
      setInviteJoin({ status: 'error', code: '', message: 'This invite link is missing a code.' })
      return
    }
    void joinInviteLink(code)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  async function joinInviteLink(code: string) {
    if (inviteJoinAttemptRef.current === code) return
    inviteJoinAttemptRef.current = code
    setInviteJoin({ status: 'looking-up', code })
    try {
      const res = await apiFetch<{ valid: boolean; gameId: string; hostUsername: string }>(`/api/matches/guest-link/${code}`)
      if (!res.valid || !res.gameId || !gameFactories[res.gameId]) {
        setInviteJoin({
          status: 'error',
          code,
          message: 'This invite expired or the host went offline.',
        })
        return
      }
      const title = getGameTitle(res.gameId)
      setInviteJoin({ status: 'joining', code, hostUsername: res.hostUsername, gameTitle: title })
      storeActiveMatch({ id: res.gameId, title })
      await loadGame(res.gameId, title, 'match', { kind: 'joinGuest', code })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.'
      setInviteJoin({ status: 'error', code, message })
    }
  }

  function handlePlayGame(id: string, title: string) {
    return loadGame(id, title, 'practice')
  }

  function handleFindOpponent(id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') {
    storeActiveMatch({ id, title })
    return loadGame(id, title, 'match', { kind: 'queue', stake, currency })
  }

  function handleLaunchGuestInvite(id: string, title: string) {
    storeActiveMatch({ id, title })
    return loadGame(id, title, 'match', { kind: 'createGuest' })
  }

  function handleInviteFriend(friendUserId: string, gameId: string, gameTitle: string) {
    storeActiveMatch({ id: gameId, title: gameTitle })
    return loadGame(gameId, gameTitle, 'match', { kind: 'sendInvite', friendUserId })
  }

  function handleAcceptInvite(invite: InviteReceivedPayload) {
    const title = getGameTitle(invite.gameId)
    storeActiveMatch({ id: invite.gameId, title })
    void loadGame(invite.gameId, title, 'match', { kind: 'acceptInvite', inviteId: invite.inviteId })
  }

  const clearActiveMatch = useCallback(() => {
    storeActiveMatch(null)
  }, [])

  return (
    <InviteProvider
      onAcceptInvite={handleAcceptInvite}
      enabled={!restoringActiveMatch && (!activeGame || activeGame.mode === 'practice')}
    >
      {activeGame?.mode === 'practice' ? (
        <GameLoader
          key={activeGame.id}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          gameId={activeGame.id}
          onPlayMatch={() => handleFindOpponent(activeGame.id, activeGame.title)}
          onExit={() => setActiveGame(null)}
        />
      ) : activeGame?.mode === 'match' ? (
        <MatchLoader
          key={`${activeGame.id}-${activeGame.matchMode?.kind ?? 'queue'}`}
          createModule={activeGame.factory}
          gameTitle={activeGame.title}
          gameId={activeGame.id}
          matchMode={activeGame.matchMode}
          onMatchResolved={clearActiveMatch}
          onFindNewOpponent={() => {
            const stake = activeGame.matchMode && 'stake' in activeGame.matchMode ? activeGame.matchMode.stake : undefined
            const currency = activeGame.matchMode && 'currency' in activeGame.matchMode ? activeGame.matchMode.currency : undefined
            clearActiveMatch()
            setActiveGame(null)
            setTimeout(() => {
              void handleFindOpponent(activeGame.id, activeGame.title, stake, currency)
            }, 50)
          }}
          onPlayPractice={() => {
            clearActiveMatch()
            setActiveGame(null)
            setTimeout(() => {
              void handlePlayGame(activeGame.id, activeGame.title)
            }, 50)
          }}
          onExit={() => {
            clearActiveMatch()
            setActiveGame(null)
            if (view === 'invite') navigateTo('home')
          }}
        />
      ) : view === 'profile' ? (
        <ProfilePage
          onNavigateHome={() => navigateTo('home')}
          onNavigateFriends={() => navigateTo('friends')}
          onNavigateWallet={() => navigateTo('wallet')}
        />
      ) : view === 'wallet' ? (
        <WalletPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateProfile={() => navigateTo('profile')}
          onNavigateFriends={() => navigateTo('friends')}
        />
      ) : view === 'admin' ? (
        <AdminConsolePage onNavigateHome={() => navigateTo('home')} />
      ) : view === 'friends' ? (
        <FriendsPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateProfile={() => navigateTo('profile')}
          onNavigateWallet={() => navigateTo('wallet')}
          onInviteFriend={handleInviteFriend}
        />
      ) : view === 'verify-email' ? (
        <VerifyEmailPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateLogin={() => navigateTo('login')}
        />
      ) : view === 'reset-password' ? (
        <ResetPasswordPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateLogin={() => navigateTo('login')}
        />
      ) : view === 'help' ? (
        <HelpCenterPage onNavigate={(path) => navigateTo(getViewFromPath(path))} />
      ) : view.startsWith('policy:') ? (
        <PolicyPage
          policySlug={view.slice(7)}
          onNavigate={(path) => navigateTo(getViewFromPath(path))}
        />
      ) : view === 'invite' ? (
        <InviteLanding
          status={inviteJoin?.status ?? 'looking-up'}
          code={inviteJoin?.code ?? parseInviteCode(window.location.pathname) ?? ''}
          hostUsername={inviteJoin?.hostUsername}
          gameTitle={inviteJoin?.gameTitle}
          message={inviteJoin?.message}
          onRetry={inviteJoin?.code ? () => {
            inviteJoinAttemptRef.current = null
            void joinInviteLink(inviteJoin.code)
          } : undefined}
          onHome={() => {
            inviteJoinAttemptRef.current = null
            setInviteJoin(null)
            navigateTo('home')
          }}
        />
      ) : view === 'not-found' ? (
        <NotFoundPage
          onNavigateHome={() => navigateTo('home')}
          onNavigateProfile={() => navigateTo('profile')}
          onNavigateFriends={() => navigateTo('friends')}
          onPlayGame={handlePlayGame}
          onFindOpponent={handleFindOpponent}
        />
      ) : (
        <HomePage
          onPlayGame={handlePlayGame}
          onFindOpponent={handleFindOpponent}
          onLaunchGuestInvite={handleLaunchGuestInvite}
          loadingGameId={loadingGameId}
          onNavigateProfile={() => navigateTo('profile')}
          onNavigateFriends={() => navigateTo('friends')}
          onNavigateWallet={() => navigateTo('wallet')}
          onNavigatePolicy={(path) => navigateTo(getViewFromPath(path))}
          initialAuthModalMode={view === 'login' ? 'login' : view === 'signup' ? 'signup' : undefined}
        />
      )}

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => {
            setAuthModalMode(null)
            if (!user && pendingRedirectView) {
              setPendingRedirectView(null)
              navigateTo('home')
            }
          }}
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
