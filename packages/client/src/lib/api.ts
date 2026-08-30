function resolveApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim()
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    if (hostname === 'staging.fugluck.com') {
      return 'https://api-staging.fugluck.com'
    }
    return `${window.location.protocol}//${hostname}:4000`
  }

  return 'http://localhost:4000'
}

export const API_URL = resolveApiUrl()

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(body.error ?? 'Request failed', res.status)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
