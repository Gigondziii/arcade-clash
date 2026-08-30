import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { navFilters } from '../mock/homeData'
import AuthModal from './AuthModal'
import Avatar from './Avatar'
import LanguageSwitcher from './LanguageSwitcher'
import { SearchIcon } from './icons'

type NavbarProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends?: () => void
  onNavigateWallet?: () => void
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export default function Navbar({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  selectedCategory = 'all',
  onSelectCategory,
  searchQuery = '',
  onSearchChange,
}: NavbarProps) {
  const { t } = useTranslation()
  const { user, logOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null)

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
      }}
    >
      <button
        type="button"
        onClick={onNavigateHome}
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-primary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        Fugluck
      </button>

      {onSearchChange && (
        <label className="ac-search" style={{ flex: 1, maxWidth: 380, position: 'relative' }}>
          <SearchIcon />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('common.search', { defaultValue: 'Search games…' })}
            style={{ paddingRight: searchQuery ? '32px' : undefined }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: '4px',
              }}
              title={t('common.clearSearch', { defaultValue: 'Clear search' })}
              aria-label={t('common.clearSearch', { defaultValue: 'Clear search' })}
            >
              ✕
            </button>
          )}
        </label>
      )}

      {onSelectCategory && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {navFilters.map((f) => {
            const isActive = selectedCategory.toLowerCase() === f.engine.toLowerCase()
            return (
              <button
                key={f.label}
                type="button"
                className={`ac-pill${isActive ? ' ac-pill--active' : ''}`}
                onClick={() => onSelectCategory(f.engine)}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginLeft: 'auto' }}>
        <LanguageSwitcher />

        {user && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-muted)',
              cursor: onNavigateWallet ? 'pointer' : 'default',
            }}
            onClick={onNavigateWallet}
            title={t('navigation.coinsTooltip')}
          >
            <span>
              <span style={{ color: 'var(--color-secondary, #fbbf24)' }}>{user.balances.coins}</span>{' '}
              {t('common.coins').toLowerCase()}
            </span>
            <span>
              <span style={{ color: 'var(--color-primary)' }}>{user.balances.diamonds}</span>{' '}
              {t('common.diamonds').toLowerCase()}
            </span>
          </div>
        )}

        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label={t('navigation.accountMenu')}
              onClick={() => setMenuOpen((open) => !open)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <Avatar username={user.username} />
            </button>
            {menuOpen && (
              <div
                className="ac-panel"
                style={{
                  position: 'absolute',
                  top: '44px',
                  right: 0,
                  padding: 'var(--space-2)',
                  minWidth: 160,
                  zIndex: 20,
                }}
              >
                <MenuItem
                  label={t('navigation.profile')}
                  onClick={() => {
                    setMenuOpen(false)
                    onNavigateProfile()
                  }}
                />
                {onNavigateWallet && (
                  <MenuItem
                    label={t('navigation.wallet', { defaultValue: 'Wallet' })}
                    onClick={() => {
                      setMenuOpen(false)
                      onNavigateWallet()
                    }}
                  />
                )}
                {onNavigateFriends && (
                  <MenuItem
                    label={t('navigation.friends')}
                    onClick={() => {
                      setMenuOpen(false)
                      onNavigateFriends()
                    }}
                  />
                )}
                <MenuItem
                  label={t('navigation.logout')}
                  onClick={() => {
                    setMenuOpen(false)
                    logOut()
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" className="ac-pill" onClick={() => setAuthModalMode('login')}>
              {t('navigation.login')}
            </button>
            <button type="button" className="ac-pill ac-pill--active" onClick={() => setAuthModalMode('signup')}>
              {t('navigation.signup')}
            </button>
          </div>
        )}
      </div>

      {authModalMode && <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />}
    </nav>
  )
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        color: 'var(--color-text)',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        fontSize: 'var(--font-size-sm)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-raised)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      {label}
    </button>
  )
}
