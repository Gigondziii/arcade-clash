import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PublicUser } from '@arcadeclash/shared'
import { apiFetch, ApiError } from '../lib/api'

type AuthContextValue = {
  user: PublicUser | null
  loading: boolean
  error: string | null
  signUp: (username: string, password: string, email?: string) => Promise<void>
  logIn: (username: string, password: string) => Promise<void>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ user: PublicUser }>('/api/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function signUp(username: string, password: string, email?: string) {
    setError(null)
    try {
      const res = await apiFetch<{ user: PublicUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, password, email }),
      })
      setUser(res.user)
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
      setUser(res.user)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Log in failed')
      throw e
    }
  }

  async function logOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, signUp, logIn, logOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
