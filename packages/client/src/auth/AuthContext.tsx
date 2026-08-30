import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CURRENT_POLICY_VERSIONS, type PublicUser, type SignupAcceptedPolicies } from '@fugluck/shared'
import { apiFetch, ApiError } from '../lib/api'

const AUTH_STORAGE_KEY = 'fugluck_auth_user'
const LEGACY_AUTH_STORAGE_KEY = 'arcadeclash_auth_user'

export function getStoredAuthToken(): string | null {
  return null
}

type AuthContextValue = {
  user: PublicUser | null
  loading: boolean
  error: string | null
  signUp: (username: string, password: string, email?: string, acceptedPolicies?: SignupAcceptedPolicies) => Promise<{ user: PublicUser; verificationMessage?: string }>
  logIn: (username: string, password: string) => Promise<void>
  logOut: () => Promise<void>
  refreshUser: () => Promise<void>
  verifyEmail: (token: string) => Promise<PublicUser>
  resendVerification: (email?: string) => Promise<string>
  forgotPassword: (emailOrUsername: string) => Promise<string>
  resetPassword: (token: string, newPassword: string) => Promise<string>
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(LEGACY_AUTH_STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function updateUser(u: PublicUser | null) {
    setUser(u)
    try {
      if (u) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u))
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
      }
    } catch {
      // Ignore storage errors
    }
  }

  useEffect(() => {
    let mounted = true

    async function initSession() {
      try {
        const res = await apiFetch<{ user: PublicUser }>('/api/auth/me')
        if (mounted) updateUser(res.user)
      } catch {
        if (mounted) {
          // If server /me rejects, the session is invalid — clear local cache
          updateUser(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void initSession()

    return () => {
      mounted = false
    }
  }, [])

  async function signUp(
    username: string,
    password: string,
    email?: string,
    acceptedPolicies?: SignupAcceptedPolicies,
  ) {
    setError(null)
    const policies = acceptedPolicies ?? {
      termsVersion: CURRENT_POLICY_VERSIONS.TERMS,
      privacyVersion: CURRENT_POLICY_VERSIONS.PRIVACY,
    }
    try {
      const res = await apiFetch<{ user: PublicUser; verificationMessage?: string }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, email, acceptedPolicies: policies }),
      })
      updateUser(res.user)
      return res
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sign up failed')
      throw e
    }
  }

  async function logIn(username: string, password: string) {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      updateUser(res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Log in failed')
      throw e
    }
  }

  async function logOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    updateUser(null)
  }

  async function refreshUser() {
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/me')
      updateUser(res.user)
    } catch {
      updateUser(null)
    }
  }

  async function verifyEmail(token: string): Promise<PublicUser> {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser; message: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      if (res.user) {
        updateUser(res.user)
      }
      return res.user
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Email verification failed')
      throw e
    }
  }

  async function resendVerification(email?: string): Promise<string> {
    setError(null)
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      return res.message
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to resend verification email')
      throw e
    }
  }

  async function forgotPassword(emailOrUsername: string): Promise<string> {
    setError(null)
    try {
      const body = emailOrUsername.includes('@')
        ? { email: emailOrUsername }
        : { username: emailOrUsername }
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.message
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Password reset request failed')
      throw e
    }
  }

  async function resetPassword(token: string, newPassword: string): Promise<string> {
    setError(null)
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      return res.message
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Password reset failed')
      throw e
    }
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
    setError(null)
    try {
      const res = await apiFetch<{ success: boolean; message: string }>('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      return res.message
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Password change failed'
      setError(msg)
      throw e
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signUp,
        logIn,
        logOut,
        refreshUser,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
