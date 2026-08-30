import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'

type AuthModalMode = 'login' | 'signup' | 'forgot-password' | 'verification-sent'

type AuthModalProps = {
  initialMode: 'login' | 'signup'
  onClose: () => void
}

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { t } = useTranslation()
  const { signUp, logIn, forgotPassword, resendVerification, error } = useAuth()
  const [mode, setMode] = useState<AuthModalMode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const prevTitle = document.title
    if (mode === 'signup') document.title = t('meta.titleSignup')
    else if (mode === 'login') document.title = t('meta.titleLogin')
    return () => {
      document.title = prevTitle
    }
  }, [mode, t])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setInfoMessage(null)
    try {
      if (mode === 'signup') {
        if (!agreeToTerms) {
          setInfoMessage('You must agree to the Terms of Service and Privacy Policy.')
          setSubmitting(false)
          return
        }
        await signUp(username, password, email || undefined)
        if (email && email.trim().length > 0) {
          setMode('verification-sent')
        } else {
          onClose()
        }
      } else if (mode === 'login') {
        await logIn(username, password)
        onClose()
      } else if (mode === 'forgot-password') {
        const msg = await forgotPassword(recoveryIdentifier.trim())
        setInfoMessage(msg || 'Password reset link sent if an account exists.')
      }
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResendVerification() {
    setResending(true)
    setInfoMessage(null)
    try {
      const msg = await resendVerification(email || undefined)
      setInfoMessage(msg || 'Verification email resent.')
    } catch {
      // Error handled by useAuth()
    } finally {
      setResending(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,15,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div className="ac-panel" style={{ width: 360 }} onClick={(e) => e.stopPropagation()}>
        {mode === 'verification-sent' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 'var(--space-3)' }}>✉️</div>
            <h2 style={{ margin: '0 0 var(--space-2)' }}>Check Your Email</h2>
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-4)' }}>
              We sent a verification link to <strong>{email}</strong>. Please check your inbox and verify your account to unlock full wagering and social features.
            </p>

            {infoMessage && (
              <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-3)' }}>
                {infoMessage}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <button
                type="button"
                onClick={onClose}
                className="ac-btn ac-btn--primary"
                style={{ padding: 'var(--space-3)' }}
              >
                Continue to Dashboard ▶
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 'var(--space-2)' }}
              >
                {resending ? 'Resending...' : 'Didn’t receive it? Resend Email'}
              </button>
            </div>
          </div>
        ) : mode === 'forgot-password' ? (
          <div>
            <h2 style={{ margin: '0 0 var(--space-2)' }}>Reset Password</h2>
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-4)' }}>
              Enter your email or username and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  Email or Username
                </span>
                <input
                  type="text"
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </label>

              {infoMessage && (
                <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {infoMessage}
                </p>
              )}

              {error && (
                <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={submitting || !recoveryIdentifier.trim()}
                style={{ padding: 'var(--space-3)' }}
              >
                {submitting ? t('common.pleaseWait') : 'Send Reset Link'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode('login')
                setInfoMessage(null)
              }}
              className="ac-link--secondary"
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-4)', padding: 0 }}
            >
              ← Back to Log In
            </button>
          </div>
        ) : (
          <div>
            <h2 style={{ margin: '0 0 var(--space-5)' }}>
              {mode === 'signup' ? t('auth.signupTitle') : t('auth.loginTitle')}
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('auth.username')}
                </span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  autoFocus
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {t('auth.password')}
                  </span>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot-password')
                        setInfoMessage(null)
                      }}
                      className="ac-link--secondary"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-xs)',
                        padding: 0,
                        color: 'var(--color-accent, #2de2ff)',
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </label>

              {mode === 'signup' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    Email Address
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={inputStyle}
                  />
                </label>
              )}

              {mode === 'signup' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', cursor: 'pointer', marginTop: 'var(--space-1)' }}>
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    required
                    style={{ marginTop: 3, accentColor: 'var(--color-primary, #00f0ff)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    I agree to the{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent, #2de2ff)', textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </a>{' '}
                    and acknowledge the{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent, #2de2ff)', textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>.
                  </span>
                </label>
              )}

              {infoMessage && (
                <p style={{ color: 'var(--color-accent, #2de2ff)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {infoMessage}
                </p>
              )}

              {error && (
                <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={submitting || (mode === 'signup' && !agreeToTerms)}
              >
                {submitting
                  ? t('common.pleaseWait')
                  : mode === 'signup'
                    ? t('auth.submitSignup')
                    : t('auth.submitLogin')}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup')
                setInfoMessage(null)
              }}
              className="ac-link--secondary"
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-4)', padding: 0 }}
            >
              {mode === 'signup' ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
            </button>
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
  boxSizing: 'border-box',
}
