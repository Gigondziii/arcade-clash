import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

type ResetPasswordPageProps = {
  onNavigateHome: () => void
  onNavigateLogin: () => void
}

export default function ResetPasswordPage({ onNavigateHome, onNavigateLogin }: ResetPasswordPageProps) {
  const { resetPassword, forgotPassword } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Recovery request fallback if token is missing/expired
  const [requestEmail, setRequestEmail] = useState('')
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken && urlToken.trim().length > 0) {
      setToken(urlToken.trim())
    } else {
      setToken(null)
    }
  }, [])

  const hasMinLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const isPolicyValid = hasMinLength && hasLetter && hasNumber && passwordsMatch

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Reset token is missing from the URL. Please request a new reset link.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('Password must be at least 8 characters and include at least one letter and one number.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || 'Password reset failed. The reset token may be expired or already used.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestNewLink(e: FormEvent) {
    e.preventDefault()
    if (!requestEmail.trim()) return
    setRequesting(true)
    setRequestMessage(null)
    try {
      const msg = await forgotPassword(requestEmail.trim())
      setRequestMessage(msg || 'Password reset link sent if an account exists.')
    } catch (err: any) {
      setError(err?.message || 'Failed to request reset link.')
    } finally {
      setRequesting(false)
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
          maxWidth: 440,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🔒✨</div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>
              Password Reset Complete
            </h1>
            <p style={{ color: 'var(--color-success, #00ff88)', margin: 'var(--space-4) 0 var(--space-6)' }}>
              Your password has been successfully updated. You can now log in with your new credentials.
            </p>
            <button
              onClick={onNavigateLogin}
              className="ac-btn ac-btn--primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              Log In Now ▶
            </button>
          </div>
        ) : token ? (
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-2)' }}>
              Choose New Password
            </h1>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
              Set a strong password for your Fugluck account.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  New Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  Confirm New Password
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </label>

              {/* Password Policy Hints */}
              <div
                style={{
                  background: 'var(--color-surface-sunken, rgba(0,0,0,0.2))',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ color: hasMinLength ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {hasMinLength ? '✓' : '○'} At least 8 characters
                </div>
                <div style={{ color: hasLetter ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {hasLetter ? '✓' : '○'} Contains at least one letter
                </div>
                <div style={{ color: hasNumber ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {hasNumber ? '✓' : '○'} Contains at least one number
                </div>
                <div style={{ color: passwordsMatch ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {passwordsMatch ? '✓' : '○'} Passwords match
                </div>
              </div>

              {error && (
                <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={submitting || !isPolicyValid}
                style={{ padding: 'var(--space-3)' }}
              >
                {submitting ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>

            <div style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
              <button
                onClick={onNavigateHome}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Return to Home
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🔑</div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-2)' }}>
              Reset Your Password
            </h1>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
              Enter your email or username to receive password reset instructions.
            </p>

            <form
              onSubmit={handleRequestNewLink}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'left' }}
            >
              <input
                type="text"
                placeholder="Email address or username"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={requesting || !requestEmail.trim()}
                style={{ padding: 'var(--space-3)' }}
              >
                {requesting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            {requestMessage && (
              <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-4)' }}>
                {requestMessage}
              </p>
            )}

            {error && (
              <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-4)' }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: 'var(--space-6)' }}>
              <button
                onClick={onNavigateLogin}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Back to Log In
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
