type InviteLandingProps = {
  status: 'looking-up' | 'joining' | 'error'
  code: string
  hostUsername?: string
  gameTitle?: string
  message?: string
  onRetry?: () => void
  onHome: () => void
}

export default function InviteLanding({
  status,
  code,
  hostUsername,
  gameTitle,
  message,
  onRetry,
  onHome,
}: InviteLandingProps) {
  const heading =
    status === 'error' ? 'Invite unavailable' : status === 'joining' ? 'Joining match' : 'Opening invite'

  const body =
    status === 'error'
      ? message || 'This invite expired or the host went offline.'
      : status === 'joining'
        ? `${hostUsername ?? 'A player'} is waiting to play${gameTitle ? ` ${gameTitle}` : ''}. Connecting…`
        : 'Checking that this invite is still live…'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        background: 'var(--color-bg)',
      }}
    >
      <div className="ac-panel" style={{ textAlign: 'center', minWidth: 320, maxWidth: 440, padding: 'var(--space-6)' }}>
        <h1 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xl)' }}>{heading}</h1>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
          {body}
        </p>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-xs)' }}>
          Invite code: {code}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
          {status === 'error' && onRetry && (
            <button type="button" className="ac-btn ac-btn--primary" onClick={onRetry}>
              Try again
            </button>
          )}
          <button type="button" className={`ac-btn ${status === 'error' ? 'ac-btn--ghost' : 'ac-btn--primary'}`} onClick={onHome}>
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
