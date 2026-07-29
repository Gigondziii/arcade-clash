import { useState } from 'react'
import { navFilters } from '../mock/homeData'
import { BellIcon, SearchIcon } from './icons'

export default function Navbar() {
  const [activeFilter, setActiveFilter] = useState('hot')

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
      <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-primary)' }}>
        ArcadeClash
      </span>

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
        <div
          aria-label="Profile"
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}
        >
          U
        </div>
      </div>
    </nav>
  )
}
