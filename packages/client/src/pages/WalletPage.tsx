import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DIAMOND_PACKS, type DiamondPack } from '@fugluck/shared'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'

export type LedgerHistoryItem = {
  id: string
  currency: string
  amount: number
  reason: string
  label: string
  createdAt: string
}

type WalletPageProps = {
  onNavigateHome: () => void
  onNavigateProfile?: () => void
  onNavigateFriends?: () => void
  onNavigatePolicy?: (path: string) => void
}

export default function WalletPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigatePolicy,
}: WalletPageProps) {
  const { t, i18n } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [history, setHistory] = useState<LedgerHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [shopError, setShopError] = useState<string | null>(null)
  const [shopSuccess, setShopSuccess] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const currentLang = i18n.language || 'en'

  function loadHistory() {
    if (!user) return
    setLoadingHistory(true)
    setHistoryError(null)
    apiFetch<{ history: LedgerHistoryItem[] }>('/api/wallet/history')
      .then((res) => {
        setHistory(res.history)
      })
      .catch((err) => {
        setHistoryError(err instanceof ApiError ? err.message : 'Failed to load transaction history.')
      })
      .finally(() => {
        setLoadingHistory(false)
      })
  }

  useEffect(() => {
    loadHistory()
  }, [user])

  async function buyPack(packId: string) {
    setBuyingId(packId)
    setShopError(null)
    setShopSuccess(null)
    try {
      await apiFetch('/api/wallet/diamonds/stub-buy', {
        method: 'POST',
        body: JSON.stringify({ packId }),
      })
      await refreshUser()
      loadHistory()
      setShopSuccess(t('wallet.purchaseSuccess', { defaultValue: 'Diamonds granted successfully!' }))
    } catch (e) {
      setShopError(e instanceof ApiError ? e.message : t('wallet.purchaseFailed', { defaultValue: 'Purchase failed' }))
    } finally {
      setBuyingId(null)
    }
  }

  function formatTimestamp(iso: string): string {
    try {
      const d = new Date(iso)
      const dateStr = d.toLocaleDateString(currentLang, { month: 'short', day: 'numeric', year: 'numeric' })
      const timeStr = d.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })
      return `${dateStr} • ${timeStr}`
    } catch {
      return iso
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile ?? onNavigateHome}
        onNavigateFriends={onNavigateFriends}
      />
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-4)', boxSizing: 'border-box' }}>
        <h1 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-2xl)' }}>
          {t('wallet.title', { defaultValue: 'Wallet & Ledger' })}
        </h1>

        {/* Live Balance Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div className="ac-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.coinsLabel', { defaultValue: 'COINS Balance' })}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-accent, #2de2ff)' }}>
              🪙 {user?.balances.coins.toLocaleString() ?? '0'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              {t('wallet.coinsDesc', { defaultValue: 'Free-play virtual currency (0% rake fee)' })}
            </div>
          </div>

          <div className="ac-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.diamondsLabel', { defaultValue: 'DIAMONDS Balance' })}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: '#38bdf8' }}>
              💎 {user?.balances.diamonds.toLocaleString() ?? '0'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              {t('wallet.diamondsDesc', { defaultValue: 'Competitive staking currency (5% rake fee)' })}
            </div>
          </div>
        </div>

        {/* Ledger Transaction History Section */}
        <section className="ac-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>
              {t('wallet.historyTitle', { defaultValue: 'Transaction History' })}
            </h2>
            <button
              type="button"
              onClick={loadHistory}
              disabled={loadingHistory}
              className="ac-btn ac-btn--ghost"
              style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-3)' }}
            >
              🔄 {t('common.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>

          {loadingHistory ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0' }}>
              {t('wallet.loadingHistory', { defaultValue: 'Loading transaction ledger…' })}
            </p>
          ) : historyError ? (
            <div style={{ padding: 'var(--space-4) 0', color: 'var(--color-danger, #f87171)' }}>
              <p style={{ margin: '0 0 var(--space-3)' }}>{historyError}</p>
              <button type="button" onClick={loadHistory} className="ac-btn ac-btn--primary">
                🔄 {t('common.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0' }}>
              {t('wallet.noHistory', { defaultValue: 'No transactions recorded yet.' })}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Type / Description</th>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Amount</th>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Currency</th>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => {
                    const isCredit = tx.amount > 0
                    const isZero = tx.amount === 0
                    const sign = isCredit ? '+' : ''
                    const amountColor = isZero ? 'var(--color-text-muted)' : isCredit ? '#22c55e' : '#f87171'

                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-border) 40%, transparent)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-2)', fontWeight: 500 }}>{tx.label}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-2)', color: amountColor, fontWeight: 'bold' }}>
                          {sign}{tx.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                          {tx.currency === 'COINS' ? '🪙 COINS' : '💎 DIAMONDS'}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                          {formatTimestamp(tx.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Diamond Shop Section (Development Sandbox) */}
        <section className="ac-card" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--space-2)' }}>
            {t('wallet.diamondShopTitle', { defaultValue: 'Diamond Shop' })}
          </h2>

          <div
            className="ac-card"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              borderColor: 'var(--color-primary)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            ⚠️ <strong>{t('wallet.devNoticeTitle', { defaultValue: 'Development Sandbox' })}:</strong>{' '}
            {t('wallet.devNoticeDesc', {
              defaultValue: 'No real payments are integrated. Clicking grant issues test diamonds for platform verification.',
            })}
          </div>

          {shopError && <p style={{ color: 'var(--color-danger, #f87171)', marginBottom: 'var(--space-3)' }}>{shopError}</p>}
          {shopSuccess && <p style={{ color: '#22c55e', marginBottom: 'var(--space-3)' }}>{shopSuccess}</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {DIAMOND_PACKS.map((pack: DiamondPack) => (
              <button
                key={pack.id}
                type="button"
                className="ac-btn ac-btn--ghost"
                disabled={buyingId === pack.id}
                onClick={() => buyPack(pack.id)}
                style={{ justifyContent: 'space-between', display: 'flex' }}
              >
                <span>{pack.label}</span>
                <span>{buyingId === pack.id ? t('wallet.granting', { defaultValue: 'Granting…' }) : t('wallet.packGrant', { count: pack.diamonds, defaultValue: `Grant +${pack.diamonds} 💎` })}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />
    </div>
  )
}
