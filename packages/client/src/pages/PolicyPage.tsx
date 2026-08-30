import { useEffect } from 'react'
import { POLICIES, type PolicyDocument } from '../legal/policyData'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

type PolicyPageProps = {
  policySlug: string
  onNavigate: (path: string) => void
}

export default function PolicyPage({ policySlug, onNavigate }: PolicyPageProps) {
  const doc: PolicyDocument | undefined = POLICIES[policySlug]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [policySlug])

  if (!doc) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg, #0b0c14)' }}>
        <Navbar onNavigateHome={() => onNavigate('/')} onNavigateFriends={() => onNavigate('/friends')} onNavigateProfile={() => onNavigate('/profile')} onNavigateWallet={() => onNavigate('/wallet')} />
        <main style={{ flex: 1, padding: 'var(--space-8) var(--space-4)', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-4)', color: '#fff' }}>Document Not Found</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-6)' }}>The requested policy page could not be found.</p>
          <button type="button" onClick={() => onNavigate('/help')} className="ac-btn ac-btn--primary">
            Visit Help Center
          </button>
        </main>
        <Footer onNavigate={onNavigate} />
      </div>
    )
  }

  const relatedDocs = doc.relatedSlugs.map((slug) => POLICIES[slug]).filter(Boolean) as PolicyDocument[]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg, #0b0c14)', color: 'var(--color-text, #f1f5f9)' }}>
      <Navbar
        onNavigateHome={() => onNavigate('/')}
        onNavigateFriends={() => onNavigate('/friends')}
        onNavigateProfile={() => onNavigate('/profile')}
        onNavigateWallet={() => onNavigate('/wallet')}
      />

      <main style={{ flex: 1, padding: 'var(--space-8) var(--space-4)', maxWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--color-text-muted, #94a3b8)', marginBottom: 'var(--space-6)' }}>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            style={{ background: 'none', border: 'none', color: 'var(--color-accent, #2de2ff)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
          >
            Home
          </button>
          <span>/</span>
          <button
            type="button"
            onClick={() => onNavigate('/help')}
            style={{ background: 'none', border: 'none', color: 'var(--color-accent, #2de2ff)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
          >
            Help & Legal
          </button>
          <span>/</span>
          <span style={{ color: '#fff' }}>{doc.title}</span>
        </div>

        {/* Header Title Section */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.7) 100%)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
            borderRadius: 'var(--radius-lg, 12px)',
            padding: 'var(--space-8) var(--space-6)',
            marginBottom: 'var(--space-8)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <h1 style={{ margin: 0, fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
              {doc.title}
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(0, 240, 255, 0.15)',
                color: 'var(--color-accent, #00f0ff)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
              }}
            >
              v{doc.version}
            </span>
          </div>
          <p style={{ margin: '0 0 var(--space-4)', fontSize: '1.05rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            {doc.subtitle}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', fontSize: '0.8125rem', color: '#94a3b8' }}>
            <span>Last updated: {doc.lastUpdated}</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="ac-btn ac-btn--secondary"
              style={{ padding: '4px 12px', fontSize: '0.75rem' }}
            >
              🖨️ Print Document
            </button>
          </div>
        </div>

        {/* 2-Column Content Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: 'var(--space-8)', alignItems: 'start' }}>
          {/* Main Document Body */}
          <div>
            {/* Plain-English Executive Summary */}
            <div
              style={{
                background: 'rgba(45, 226, 255, 0.05)',
                borderLeft: '4px solid var(--color-accent, #2de2ff)',
                padding: 'var(--space-5)',
                borderRadius: '0 8px 8px 0',
                marginBottom: 'var(--space-8)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent, #2de2ff)', marginBottom: 'var(--space-2)' }}>
                Plain-English Summary
              </div>
              <p style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.6, color: '#e2e8f0' }}>
                {doc.summary}
              </p>
            </div>

            {/* Document Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  style={{
                    scrollMarginTop: 90,
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: 'var(--space-6)',
                  }}
                >
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 var(--space-4)', color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 'var(--space-2)' }}>
                    {section.heading}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {section.content.map((paragraph, pIdx) => (
                      <p key={pIdx} style={{ margin: 0, fontSize: '0.9375rem', lineHeight: 1.65, color: '#cbd5e1' }}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                  {section.note && (
                    <div
                      style={{
                        marginTop: 'var(--space-4)',
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'rgba(255, 170, 0, 0.1)',
                        border: '1px solid rgba(255, 170, 0, 0.25)',
                        borderRadius: 6,
                        fontSize: '0.8125rem',
                        color: '#fde047',
                      }}
                    >
                      ℹ️ {section.note}
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Related Policies Footer */}
            {relatedDocs.length > 0 && (
              <div style={{ marginTop: 'var(--space-10, 3rem)', padding: 'var(--space-6)', background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 var(--space-3)', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Related Legal Documents
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                  {relatedDocs.map((rDoc) => (
                    <button
                      key={rDoc.slug}
                      type="button"
                      onClick={() => onNavigate(`/${rDoc.slug}`)}
                      className="ac-btn ac-btn--secondary"
                      style={{ fontSize: '0.8125rem', padding: '6px 14px' }}
                    >
                      {rDoc.title} →
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Table of Contents Sticky Sidebar */}
          <aside
            style={{
              position: 'sticky',
              top: 90,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: 'var(--space-4)',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 'var(--space-3)' }}>
              Table of Contents
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {doc.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  style={{
                    color: '#94a3b8',
                    textDecoration: 'none',
                    fontSize: '0.8125rem',
                    lineHeight: 1.4,
                    padding: '4px 0',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#00f0ff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                >
                  {section.heading}
                </a>
              ))}
            </nav>

            <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => onNavigate('/help')}
                style={{
                  width: '100%',
                  background: 'none',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  color: 'var(--color-accent, #2de2ff)',
                  borderRadius: 6,
                  padding: 'var(--space-2)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                ❓ Questions? Visit Help Center
              </button>
            </div>
          </aside>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  )
}
