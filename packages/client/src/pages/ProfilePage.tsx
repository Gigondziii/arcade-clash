import { useState } from 'react'
import { DIAMOND_PACKS } from '@arcadeclash/shared'
import Avatar from '../components/Avatar'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'

type ProfilePageProps = {
  onNavigateHome: () => void
  onNavigateFriends?: () => void
}

export default function ProfilePage({ onNavigateHome, onNavigateFriends }: ProfilePageProps) {
  const { user, refreshUser } = useAuth()
  const [shopError, setShopError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  if (!user) {
    return (
      <>
        <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={() => {}} onNavigateFriends={onNavigateFriends} />
        <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
          <p className="ac-text-muted">You're not logged in.</p>
        </main>
      </>
    )
  }

  const winRate = user.gamesPlayed > 0 ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%` : '—'

  async function buyPack(packId: string) {
    setShopError(null)
    setBuyingId(packId)
    try {
      await apiFetch('/api/wallet/purchase-diamonds', {
        method: 'POST',
        body: JSON.stringify({ packId }),
      })
      await refreshUser()
    } catch (e) {
      setShopError(e instanceof ApiError ? e.message : 'Purchase failed')
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <>
      <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={() => {}} onNavigateFriends={onNavigateFriends} />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
          <Avatar username={user.username} size={72} />
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)' }}>{user.username}</h1>
            <p className="ac-text-muted" style={{ margin: 'var(--space-1) 0 0' }}>
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div
          className="ac-panel"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}
        >
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              Coins (free)
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.balances.coins}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              Diamonds
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.balances.diamonds}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              Games Played
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.gamesPlayed}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              Win Rate
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{winRate}</div>
          </div>
        </div>

        <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-6)' }}>
          New accounts start with 10 coins and 0 diamonds. Coin balances are play money and may reset when
          real-money launch happens.
        </p>

        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xl)' }}>Diamond shop</h2>
        <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-4)' }}>
          Stub purchases only — no real payment yet. Clicking a pack grants diamonds immediately for testing.
        </p>
        {shopError && (
          <p style={{ color: 'var(--color-danger, #f87171)', marginBottom: 'var(--space-3)' }}>{shopError}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {DIAMOND_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="ac-btn ac-btn--ghost"
              disabled={buyingId === pack.id}
              onClick={() => buyPack(pack.id)}
              style={{ justifyContent: 'space-between', display: 'flex' }}
            >
              <span>{pack.label}</span>
              <span>{buyingId === pack.id ? 'Granting…' : `+${pack.diamonds}`}</span>
            </button>
          ))}
        </div>
      </main>
    </>
  )
}
