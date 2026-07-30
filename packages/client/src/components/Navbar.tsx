import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { navFilters } from '../mock/homeData'
import AuthModal from './AuthModal'
import Avatar from './Avatar'
import { BellIcon, SearchIcon } from './icons'

type NavbarProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
}

export default function Navbar({ onNavigateHome, onNavigateProfile }: NavbarProps) {
  const { user, logOut } = useAuth()
  const [activeFilter, setActiveFilter] = useState('hot')
  const [menuOpen, setMenuOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null)

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
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
        ArcadeClash
      </button>

      <label className="ac-search" style={{ flex: 1, maxWidth: 420 }}>
        <SearchIcon />
        <input type="text" placeholder="Search games, creators, or genres..." />
      </label>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {navFilters.map((f) => (
          <button
            key={f.label}
            type="button"
            className={`ac-pill${activeFilter === f.engine ? ' ac-pill--active' : ''}`}
            onClick={() => setActiveFilter(f.engine)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginLeft: 'auto' }}>
        <button
          type="button"
          aria-label="Notifications"
          className="ac-btn--ghost"
          style={{
            display: 'inline-flex',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            padding: 'var(--space-2)',
          }}
        >
          <BellIcon />
        </button>

        {user ? (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              aria-label="Account menu"
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
                  label="Profile"
                  onClick={() => {
                    setMenuOpen(false)
                    onNavigateProfile()
                  }}
                />
                <MenuItem
                  label="Log out"
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
              Log in
            </button>
            <button type="button" className="ac-pill ac-pill--active" onClick={() => setAuthModalMode('signup')}>
              Sign up
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
