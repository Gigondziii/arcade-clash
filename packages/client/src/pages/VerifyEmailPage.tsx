import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

type VerifyEmailPageProps = {
  onNavigateHome: () => void
  onNavigateLogin: () => void
}

export default function VerifyEmailPage({ onNavigateHome, onNavigateLogin }: VerifyEmailPageProps) {
  const { verifyEmail, resendVerification, user } = useAuth()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken && urlToken.trim().length > 0) {
      setStatus('verifying')
      verifyEmail(urlToken.trim())
        .then(() => {
          setStatus('success')
        })
        .catch((err: any) => {
          setStatus('error')
          setErrorMessage(err?.message || 'Verification token is invalid or has expired.')
        })
    } else {
      setStatus('idle')
    }
  }, [])

  async function handleResend(e: FormEvent) {
    e.preventDefault()
    setResending(true)
    setResendSuccessMessage(null)
    setErrorMessage(null)
    try {
      const emailToUse = resendEmail.trim() || user?.email || undefined
      const msg = await resendVerification(emailToUse)
      setResendSuccessMessage(msg || 'Verification email has been sent.')
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to resend verification link.')
    } finally {
      setResending(false)
    }
  }

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
      <div
        className="ac-panel"
        style={{
          width: '100%',
          maxWidth: 480,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>
          {status === 'success' ? '✨' : status === 'error' ? '⚠️' : '✉️'}
        </div>

        <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>
          {status === 'success'
            ? 'Account Verified!'
            : status === 'verifying'
              ? 'Verifying Your Email...'
              : status === 'error'
                ? 'Verification Link Expired or Invalid'
                : 'Email Verification'}
        </h1>

        {status === 'verifying' && (
          <p className="ac-text-muted" style={{ margin: 'var(--space-4) 0' }}>
            Please wait while we confirm your email verification token...
          </p>
        )}

        {status === 'success' && (
          <div>
            <p style={{ color: 'var(--color-success, #00ff88)', margin: 'var(--space-4) 0 var(--space-6)' }}>
              Your email has been confirmed! Full matchmaking, wagering, and social features are now active.
            </p>
            <button
              onClick={onNavigateHome}
              className="ac-btn ac-btn--primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              Enter the Arena ▶
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: 'var(--color-danger, #ff4444)', margin: 'var(--space-3) 0 var(--space-6)' }}>
              {errorMessage}
            </p>

            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: 'var(--space-5)',
                marginTop: 'var(--space-4)',
                textAlign: 'left',
              }}
            >
              <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-base)' }}>
                Request a New Verification Link
              </h3>
              <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <input
                  type="email"
                  placeholder="Enter your registered email address"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  defaultValue={user?.email || ''}
                  style={inputStyle}
                  required
                />
                <button type="submit" className="ac-btn ac-btn--secondary" disabled={resending}>
                  {resending ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </form>
              {resendSuccessMessage && (
                <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
                  {resendSuccessMessage}
                </p>
              )}
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <button
                onClick={onNavigateHome}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Return to Home
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div>
            <p className="ac-text-muted" style={{ margin: 'var(--space-4) 0 var(--space-6)' }}>
              Need a new verification link sent to your registered email address?
            </p>

            <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <input
                type="email"
                placeholder="Enter your registered email address"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                defaultValue={user?.email || ''}
                style={inputStyle}
                required
              />
              <button type="submit" className="ac-btn ac-btn--primary" disabled={resending}>
                {resending ? 'Sending...' : 'Send Verification Email'}
              </button>
            </form>

            {resendSuccessMessage && (
              <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
                {resendSuccessMessage}
              </p>
            )}

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
              <button
                onClick={onNavigateHome}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Return to Home
              </button>
              <button
                onClick={onNavigateLogin}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent, #2de2ff)' }}
              >
                Log In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-3)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--font-size-base)',
  width: '100%',
}
