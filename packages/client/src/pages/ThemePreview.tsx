import { colors } from '@arcadeclash/theme'

const swatches: Array<{ name: string; varName: string; hex: string }> = [
  { name: 'bg', varName: '--color-bg', hex: colors.bg },
  { name: 'surface', varName: '--color-surface', hex: colors.surface },
  { name: 'surface-raised', varName: '--color-surface-raised', hex: colors.surfaceRaised },
  { name: 'border', varName: '--color-border', hex: colors.border },
  { name: 'cyan', varName: '--color-cyan', hex: colors.cyan },
  { name: 'magenta', varName: '--color-magenta', hex: colors.magenta },
  { name: 'purple', varName: '--color-purple', hex: colors.purple },
  { name: 'success', varName: '--color-success', hex: colors.success },
  { name: 'danger', varName: '--color-danger', hex: colors.danger },
  { name: 'warning', varName: '--color-warning', hex: colors.warning },
  { name: 'text', varName: '--color-text', hex: colors.text },
  { name: 'text-muted', varName: '--color-text-muted', hex: colors.textMuted },
]

const typeScale: Array<{ label: string; varName: string }> = [
  { label: 'xs', varName: '--font-size-xs' },
  { label: 'sm', varName: '--font-size-sm' },
  { label: 'base', varName: '--font-size-base' },
  { label: 'md', varName: '--font-size-md' },
  { label: 'lg', varName: '--font-size-lg' },
  { label: 'xl', varName: '--font-size-xl' },
  { label: '2xl', varName: '--font-size-2xl' },
  { label: '3xl', varName: '--font-size-3xl' },
  { label: '4xl', varName: '--font-size-4xl' },
]

export default function ThemePreview() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
      <h1 style={{ fontSize: 'var(--font-size-4xl)', margin: 0 }}>ArcadeClash</h1>
      <p className="ac-text-muted" style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-8)' }}>
        Design system preview — colors, type, glow panels, buttons
      </p>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Colors</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
          {swatches.map((s) => (
            <div key={s.name}>
              <div
                style={{
                  height: 64,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: s.hex,
                }}
              />
              <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>{s.name}</div>
              <div className="ac-text-mono ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                {s.hex}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Typography</h2>
        {typeScale.map((t) => (
          <div key={t.label} style={{ fontSize: `var(${t.varName})`, marginBottom: 'var(--space-1)' }}>
            {t.label} — The quick neon fox
          </div>
        ))}
        <p className="ac-text-mono" style={{ marginTop: 'var(--space-3)' }}>
          mono — 00:59 · WAGER 250
        </p>
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Glow panels</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-5)' }}>
          <div className="ac-panel ac-border--cyan">
            <h3 style={{ marginTop: 0 }}>Practice</h3>
            <p className="ac-text-muted">Solo, no opponent, no stakes.</p>
          </div>
          <div className="ac-panel ac-border--magenta">
            <h3 style={{ marginTop: 0 }}>For Fun</h3>
            <p className="ac-text-muted">Matched opponent, no stakes.</p>
          </div>
          <div className="ac-panel ac-border--purple">
            <h3 style={{ marginTop: 0 }}>For Stakes</h3>
            <p className="ac-text-muted">Matched opponent, play-money escrow.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--font-size-xl)' }}>Buttons</h2>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button className="ac-btn ac-btn--cyan">Queue: Practice</button>
          <button className="ac-btn ac-btn--magenta">Queue: For Fun</button>
          <button className="ac-btn ac-btn--purple">Queue: For Stakes</button>
        </div>
      </section>
    </div>
  )
}
