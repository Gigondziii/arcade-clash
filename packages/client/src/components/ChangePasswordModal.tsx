import { useState, type CSSProperties, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

type ChangePasswordModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const hasMinLength = newPassword.length >= 8
  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isDifferentFromCurrent = currentPassword.length > 0 && newPassword.length > 0 && currentPassword !== newPassword
  const isPolicyValid = hasMinLength && hasLetter && hasNumber && passwordsMatch && currentPassword.length > 0

  function handleClose() {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccessMessage(null)
    onClose()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentPassword) {
      setError('Please enter your current password.')
      return
    }
    if (!passwordsMatch) {
      setError('New passwords do not match.')
      return
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password.')
      return
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError('New password must be at least 8 characters and include at least one letter and one number.')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const msg = await changePassword(currentPassword, newPassword)
      setSuccessMessage(msg || 'Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please check your current password and try again.')
    } finally {
      setSubmitting(false)
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
        padding: 'var(--space-4)',
      }}
      onClick={handleClose}
    >
      <div
        className="ac-panel"
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>🔒 Change Password</h2>
          <button
            type="button"
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--font-size-lg)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
            }}
          >
            ✕
          </button>
        </div>

        {successMessage ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2) 0' }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-3)' }}>✨</div>
            <p style={{ color: 'var(--color-success, #00ff88)', margin: '0 0 var(--space-4)', fontWeight: 'bold' }}>
              {successMessage}
            </p>
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-5)' }}>
              Your account password has been updated. Your current session remains active.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="ac-btn ac-btn--primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                Current Password
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
                style={inputStyle}
                autoComplete="current-password"
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                New Password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                style={inputStyle}
                autoComplete="new-password"
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
                autoComplete="new-password"
              />
            </label>

            {/* Password Policy Requirements Checklist */}
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
              {newPassword.length > 0 && currentPassword.length > 0 && (
                <div style={{ color: isDifferentFromCurrent ? 'var(--color-success, #00ff88)' : 'var(--color-danger, #ff4444)' }}>
                  {isDifferentFromCurrent ? '✓' : '○'} Different from current password
                </div>
              )}
            </div>

            {error && (
              <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={handleClose}
                className="ac-btn ac-btn--ghost"
                style={{ flex: 1 }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                style={{ flex: 1 }}
                disabled={submitting || !isPolicyValid || !isDifferentFromCurrent}
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
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
