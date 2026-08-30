import { useState, useMemo } from 'react'
import { FAQ_CATEGORIES, FAQ_ITEMS, type FAQItem } from '../legal/faqData'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

type HelpCenterPageProps = {
  onNavigate: (path: string) => void
}

export default function HelpCenterPage({ onNavigate }: HelpCenterPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory
      if (!matchesCategory) return false
      if (!q) return true
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }, [selectedCategory, searchQuery])

  function toggleAccordion(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg, #0b0c14)', color: 'var(--color-text, #f1f5f9)' }}>
      <Navbar
        onNavigateHome={() => onNavigate('/')}
        onNavigateFriends={() => onNavigate('/friends')}
        onNavigateProfile={() => onNavigate('/profile')}
        onNavigateWallet={() => onNavigate('/wallet')}
      />

      <main style={{ flex: 1, padding: 'var(--space-8) var(--space-4)', maxWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Help Center Hero Header */}
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-10) var(--space-4)',
            background: 'linear-gradient(135deg, rgba(20, 25, 45, 0.6) 0%, rgba(10, 15, 30, 0.8) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 'var(--radius-lg, 12px)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-2)' }}>💡</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 var(--space-2)', color: '#fff', letterSpacing: '-0.02em' }}>
            Help Center & FAQ
          </h1>
          <p style={{ fontSize: '1.05rem', color: '#94a3b8', maxWidth: 600, margin: '0 auto var(--space-6)', lineHeight: 1.5 }}>
            Everything you need to know about Fugluck game modes, rules, matchmaking, anti-cheat, and wallet balances.
          </p>

          {/* Search Bar */}
          <div style={{ maxWidth: 540, margin: '0 auto', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions, matchmaking, rules, wallet..."
              style={{
                width: '100%',
                padding: '14px 44px 14px 20px',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                borderRadius: 30,
                color: '#fff',
                fontSize: '0.9375rem',
                outline: 'none',
                boxSizing: 'border-box',
                boxShadow: '0 0 20px rgba(0, 240, 255, 0.1)',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-8)',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`ac-pill ${selectedCategory === 'all' ? 'ac-pill--active' : ''}`}
            style={{ fontSize: '0.8125rem', padding: '6px 16px' }}
          >
            All Questions ({FAQ_ITEMS.length})
          </button>
          {FAQ_CATEGORIES.map((cat) => {
            const count = FAQ_ITEMS.filter((i) => i.categoryId === cat.id).length
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`ac-pill ${selectedCategory === cat.id ? 'ac-pill--active' : ''}`}
                style={{ fontSize: '0.8125rem', padding: '6px 14px' }}
              >
                {cat.icon} {cat.title} ({count})
              </button>
            )
          })}
        </div>

        {/* FAQ Accordion List */}
        <div style={{ maxWidth: 850, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)', background: 'rgba(15, 23, 42, 0.4)', borderRadius: 8 }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>🔍</div>
              <h3 style={{ margin: '0 0 var(--space-2)', color: '#fff' }}>No questions found</h3>
              <p style={{ color: 'var(--color-text-muted)', margin: '0 0 var(--space-4)' }}>
                No FAQ articles matched &quot;{searchQuery}&quot;.
              </p>
              <button type="button" onClick={() => setSearchQuery('')} className="ac-btn ac-btn--secondary">
                Clear Search
              </button>
            </div>
          ) : (
            filteredItems.map((item: FAQItem) => {
              const isExpanded = expandedId === item.id
              return (
                <div
                  key={item.id}
                  style={{
                    background: isExpanded ? 'rgba(30, 41, 59, 0.7)' : 'rgba(15, 23, 42, 0.5)',
                    border: `1px solid ${isExpanded ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(item.id)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-4) var(--space-5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: 'none',
                      color: '#f8fafc',
                      fontSize: '1rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span>{item.question}</span>
                    <span style={{ fontSize: '1.2rem', color: isExpanded ? '#00f0ff' : '#94a3b8', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                      ▼
                    </span>
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '0 var(--space-5) var(--space-5)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <p style={{ margin: 'var(--space-3) 0 var(--space-3)', color: '#cbd5e1', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                        {item.answer}
                      </p>
                      {item.relatedPolicySlug && (
                        <div style={{ marginTop: 'var(--space-3)' }}>
                          <button
                            type="button"
                            onClick={() => onNavigate(`/${item.relatedPolicySlug}`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--color-accent, #2de2ff)',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline',
                            }}
                          >
                            Read more in {item.relatedPolicyLabel || 'Policy'} →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Still Need Help Box */}
        <div
          style={{
            maxWidth: 850,
            margin: 'var(--space-10) auto 0',
            padding: 'var(--space-6)',
            background: 'linear-gradient(135deg, rgba(20, 25, 45, 0.5) 0%, rgba(10, 15, 30, 0.7) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 var(--space-1)', color: '#fff', fontSize: '1.1rem' }}>Still have questions?</h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.875rem' }}>
              Our support desk is ready to assist with match inquiries, dispute reviews, or feedback.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/contact')}
            className="ac-btn ac-btn--primary"
            style={{ padding: '8px 20px', fontSize: '0.875rem' }}
          >
            Contact Support →
          </button>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
