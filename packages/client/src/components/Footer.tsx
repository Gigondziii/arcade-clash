import { useTranslation } from 'react-i18next'
import { POLICY_NAV_ITEMS } from '@fugluck/shared'

type FooterProps = {
  onNavigate: (path: string) => void
}

export default function Footer({ onNavigate }: FooterProps) {
  const { t } = useTranslation()

  const fugluckItems = POLICY_NAV_ITEMS.filter((item) => item.category === 'FUGLUCK')
  const legalItems = POLICY_NAV_ITEMS.filter((item) => item.category === 'LEGAL')
  const playMoneyItems = POLICY_NAV_ITEMS.filter((item) => item.category === 'PLAY_AND_MONEY')
  const accountSafetyItems = POLICY_NAV_ITEMS.filter((item) => item.category === 'ACCOUNT_AND_SAFETY')

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, path: string) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    onNavigate(path)
  }

  return (
    <footer
      style={{
        background: 'linear-gradient(180deg, rgba(14, 14, 22, 0.95) 0%, rgba(8, 8, 14, 1) 100%)',
        borderTop: '1px solid var(--color-border, rgba(255,255,255,0.08))',
        padding: 'var(--space-8, 3rem) var(--space-6, 1.5rem) var(--space-6, 1.5rem)',
        marginTop: 'auto',
        color: 'var(--color-text-muted, #94a3b8)',
        fontSize: 'var(--font-size-sm, 0.875rem)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-8, 2rem)',
          marginBottom: 'var(--space-8, 2.5rem)',
        }}
      >
        {/* Col 1: Brand & Fugluck */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.5))' }}>⚡</span>
            <span
              style={{
                fontFamily: 'var(--font-heading, inherit)',
                fontSize: '1.15rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#fff',
                textTransform: 'uppercase',
              }}
            >
              Fugluck
            </span>
          </div>
          <p style={{ lineHeight: 1.6, margin: '0 0 var(--space-4)', fontSize: '0.8125rem' }}>
            The competitive skill-arcade platform where true player reflex and precision decide victory. 100% server-authoritative and fair by design.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {fugluckItems.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  style={linkStyle}
                  className="ac-footer-link"
                >
                  {t(item.titleKey, item.id === 'ABOUT' ? 'About Fugluck' : item.id === 'HELP' ? 'Help Center & FAQ' : 'Contact & Support')}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 2: Legal */}
        <div>
          <h4 style={headingStyle}>{t('policies.footer.legalHeading', 'Legal & Terms')}</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {legalItems.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  style={linkStyle}
                  className="ac-footer-link"
                >
                  {t(
                    item.titleKey,
                    item.id === 'TERMS'
                      ? 'Terms of Service'
                      : item.id === 'PRIVACY'
                      ? 'Privacy Policy'
                      : 'Cookie Policy'
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Play & Money */}
        <div>
          <h4 style={headingStyle}>{t('policies.footer.playHeading', 'Play & Balances')}</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {playMoneyItems.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  style={linkStyle}
                  className="ac-footer-link"
                >
                  {t(
                    item.titleKey,
                    item.id === 'RULES'
                      ? 'Official Rules'
                      : item.id === 'DIAMONDS'
                      ? 'Diamonds & Coins'
                      : item.id === 'WITHDRAWALS'
                      ? 'Withdrawal Policy'
                      : item.id === 'REFUNDS'
                      ? 'Refund Policy'
                      : item.id === 'RESPONSIBLE_PLAY'
                      ? 'Responsible Play'
                      : 'Fair Play & Anti-Cheat'
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 4: Account & Safety */}
        <div>
          <h4 style={headingStyle}>{t('policies.footer.accountHeading', 'Account & Safety')}</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {accountSafetyItems.map((item) => (
              <li key={item.path}>
                <a
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  style={linkStyle}
                  className="ac-footer-link"
                >
                  {t(
                    item.titleKey,
                    item.id === 'ELIGIBILITY'
                      ? 'Player Eligibility'
                      : item.id === 'DISPUTES'
                      ? 'Dispute Resolution'
                      : item.id === 'DATA_RIGHTS'
                      ? 'Your Data Rights'
                      : 'Platform Security'
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Bar: Disclaimers & Copyright */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          paddingTop: 'var(--space-6, 1.5rem)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          alignItems: 'center',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#64748b',
        }}
      >
        <p style={{ margin: 0, maxWidth: 800, lineHeight: 1.5 }}>
          Fugluck is a skill-based competitive gaming platform. COINS are virtual play currency with zero monetary value. Diamond staking and future cash-out redemption are subject to eligibility and platform terms.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}>
          <span>© 2026 Fugluck. All rights reserved.</span>
          <span>•</span>
          <span>Deterministic 60 FPS Fixed Engine</span>
          <span>•</span>
          <span>Server-Authoritative Anti-Cheat</span>
        </div>
      </div>
    </footer>
  )
}

const headingStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  color: '#e2e8f0',
  textTransform: 'uppercase',
  marginBottom: 'var(--space-3, 0.75rem)',
}

const linkStyle: React.CSSProperties = {
  color: '#94a3b8',
  textDecoration: 'none',
  fontSize: '0.8125rem',
  transition: 'color 0.15s ease',
  display: 'inline-block',
}
