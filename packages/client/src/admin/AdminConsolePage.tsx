import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type {
  Tab,
  AdminUser,
  Metrics,
  UserItem,
  MatchItem,
  LedgerItem,
  AuditItem,
  UserDetail,
  MatchDetail,
} from './adminTypes'
import {
  ActionConfirmModal,
  GrantCurrencyModal,
  UserDetailModal,
  MatchDetailModal,
  type ConfirmModalConfig,
} from './AdminModals'
import type { AdminPermission } from '@fugluck/shared'

const GAME_OPTIONS = [
  { id: '', label: 'All Games' },
  { id: 'neon-runner', label: 'Neon Runner' },
  { id: 'pixel-ninja-dash', label: 'Pixel Ninja Dash' },
  { id: 'space-blaster', label: 'Space Blaster' },
  { id: 'cyber-hopper', label: 'Cyber Hopper' },
  { id: 'speed-trivia', label: 'Speed Trivia Clash' },
  { id: 'tf-sprint', label: 'True / False Sprint' },
]

export default function AdminConsolePage({ onNavigateHome }: { onNavigateHome: () => void }) {


  // Admin Session State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null)
  const [adminUsernameInput, setAdminUsernameInput] = useState('')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Navigation & General UI
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tab 1: Dashboard
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditItem[]>([])

  // Tab 2: Users
  const [userQuery, setUserQuery] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetail | null>(null)

  // Tab 3: Matches
  const [matchGameFilter, setMatchGameFilter] = useState('')
  const [matchStatusFilter, setMatchStatusFilter] = useState('')
  const [matchCurrencyFilter, setMatchCurrencyFilter] = useState('')
  const [matchIdQuery, setMatchIdQuery] = useState('')
  const [matchPage, setMatchPage] = useState(1)
  const [matchTotal, setMatchTotal] = useState(0)
  const [matchesList, setMatchesList] = useState<MatchItem[]>([])
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<MatchDetail | null>(null)

  // Tab 4: Ledger
  const [ledgerCurrencyFilter, setLedgerCurrencyFilter] = useState('')
  const [ledgerUserIdQuery, setLedgerUserIdQuery] = useState('')
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerList, setLedgerList] = useState<LedgerItem[]>([])

  // Tab 5: Audit Log
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditTargetTypeFilter, setAuditTargetTypeFilter] = useState('')
  const [auditTargetIdQuery, setAuditTargetIdQuery] = useState('')
  const [auditAdminIdQuery, setAuditAdminIdQuery] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditList, setAuditList] = useState<AuditItem[]>([])
  const [viewingAuditJson, setViewingAuditJson] = useState<AuditItem | null>(null)

  // Modals state
  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalConfig | null>(null)
  const [grantModalUser, setGrantModalUser] = useState<UserItem | null>(null)

  // Permission Check Helper
  const hasPerm = useCallback(
    (perm: AdminPermission): boolean => {
      if (!adminUser) return false
      if (adminUser.role === 'OWNER' || adminUser.role === 'SUPER_ADMIN') return true
      return permissions.includes(perm)
    },
    [adminUser, permissions]
  )

  // ---------------------------------------------------------------------------
  // Check Admin Session on Mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    document.title = 'Fugluck — Operational Console'
    checkAdminSession()
  }, [])

  async function checkAdminSession() {
    try {
      const res = await apiFetch<{ user: AdminUser; permissions: AdminPermission[] }>('/api/admin/me')
      if (res && res.user) {
        setAdminUser(res.user)
        setPermissions(res.permissions || [])
        setIsAdminAuthenticated(true)
        setAdminAuthError(null)
      } else {
        setIsAdminAuthenticated(false)
      }
    } catch {
      setIsAdminAuthenticated(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Login / Logout Handlers
  // ---------------------------------------------------------------------------
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setAdminAuthError(null)
    setIsLoggingIn(true)
    try {
      const res = await apiFetch<{ success: boolean; user: AdminUser }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: adminUsernameInput.trim(),
          password: adminPasswordInput,
        }),
      })
      if (res.success && res.user) {
        setAdminUser(res.user)
        setIsAdminAuthenticated(true)
        setAdminAuthError(null)
        setAdminPasswordInput('')
        // Fetch refreshed permissions
        await checkAdminSession()
        fetchDashboard()
      }
    } catch (err: any) {
      setAdminAuthError(err instanceof ApiError ? err.message : 'Admin authentication failed.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleAdminLogout() {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // Ignore cleanup error
    }
    setIsAdminAuthenticated(false)
    setAdminUser(null)
    setPermissions([])
    onNavigateHome()
  }

  // ---------------------------------------------------------------------------
  // Data Fetching Handlers
  // ---------------------------------------------------------------------------
  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<{ metrics: Metrics; recentAuditLogs: AuditItem[] }>('/api/admin/dashboard')
      setMetrics(res.metrics)
      setRecentAuditLogs(res.recentAuditLogs || [])
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load dashboard metrics.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (page = userPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (userQuery.trim()) params.append('query', userQuery.trim())
      if (userStatusFilter) params.append('status', userStatusFilter)
      if (userRoleFilter) params.append('role', userRoleFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ users: UserItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/users?${params.toString()}`
      )
      setUsersList(res.users || [])
      setUserTotal(res.pagination?.total ?? 0)
      setUserPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load users list.')
    } finally {
      setIsLoading(false)
    }
  }, [userQuery, userStatusFilter, userRoleFilter, userPage])

  const fetchMatches = useCallback(async (page = matchPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (matchIdQuery.trim()) params.append('matchId', matchIdQuery.trim())
      if (matchGameFilter) params.append('gameId', matchGameFilter)
      if (matchStatusFilter) params.append('status', matchStatusFilter)
      if (matchCurrencyFilter) params.append('currency', matchCurrencyFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ matches: MatchItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/matches?${params.toString()}`
      )
      setMatchesList(res.matches || [])
      setMatchTotal(res.pagination?.total ?? 0)
      setMatchPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load matches list.')
    } finally {
      setIsLoading(false)
    }
  }, [matchIdQuery, matchGameFilter, matchStatusFilter, matchCurrencyFilter, matchPage])

  const fetchLedger = useCallback(async (page = ledgerPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (ledgerUserIdQuery.trim()) params.append('userId', ledgerUserIdQuery.trim())
      if (ledgerCurrencyFilter) params.append('currency', ledgerCurrencyFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ ledger: LedgerItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/ledger?${params.toString()}`
      )
      setLedgerList(res.ledger || [])
      setLedgerTotal(res.pagination?.total ?? 0)
      setLedgerPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load ledger records.')
    } finally {
      setIsLoading(false)
    }
  }, [ledgerUserIdQuery, ledgerCurrencyFilter, ledgerPage])

  const fetchAudit = useCallback(async (page = auditPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (auditActionFilter) params.append('action', auditActionFilter)
      if (auditTargetTypeFilter) params.append('targetType', auditTargetTypeFilter)
      if (auditTargetIdQuery.trim()) params.append('targetId', auditTargetIdQuery.trim())
      if (auditAdminIdQuery.trim()) params.append('adminUserId', auditAdminIdQuery.trim())
      params.append('page', String(page))
      params.append('limit', '25')

      const res = await apiFetch<{ auditLogs: AuditItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/audit-logs?${params.toString()}`
      )
      setAuditList(res.auditLogs || [])
      setAuditTotal(res.pagination?.total ?? 0)
      setAuditPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load audit logs.')
    } finally {
      setIsLoading(false)
    }
  }, [auditActionFilter, auditTargetTypeFilter, auditTargetIdQuery, auditAdminIdQuery, auditPage])

  // Switch tabs & trigger data loads
  useEffect(() => {
    if (!isAdminAuthenticated) return
    setStatusMessage(null)
    setErrorMessage(null)
    if (activeTab === 'dashboard') fetchDashboard()
    if (activeTab === 'users') fetchUsers(1)
    if (activeTab === 'matches') fetchMatches(1)
    if (activeTab === 'ledger') fetchLedger(1)
    if (activeTab === 'audit') fetchAudit(1)
  }, [activeTab, isAdminAuthenticated])

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  async function inspectUser(userId: string) {
    setIsLoading(true)
    try {
      const res = await apiFetch<UserDetail>(`/api/admin/users/${userId}`)
      setSelectedUserDetail(res)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load user details.')
    } finally {
      setIsLoading(false)
    }
  }

  async function inspectMatch(matchId: string) {
    setIsLoading(true)
    try {
      const res = await apiFetch<MatchDetail>(`/api/admin/matches/${matchId}`)
      setSelectedMatchDetail(res)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load match details.')
    } finally {
      setIsLoading(false)
    }
  }

  function triggerUserAction(action: 'suspend' | 'ban' | 'unban' | 'role', user: UserItem) {
    if (action === 'suspend') {
      setConfirmModalConfig({
        title: `Suspend Account: ${user.username}`,
        actionLabel: 'Suspend Account',
        intent: 'warning',
        targetDescription: `User ${user.username} (${user.id})`,
        impactWarning: 'Account will be immediately restricted from logging in, matchmaking, and wagering.',
        onConfirm: async (reason) => {
          await apiFetch(`/api/admin/users/${user.id}/suspend`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          })
          setStatusMessage(`User "${user.username}" suspended successfully.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    } else if (action === 'ban') {
      setConfirmModalConfig({
        title: `Ban Account: ${user.username}`,
        actionLabel: 'Permanently Ban',
        intent: 'danger',
        targetDescription: `User ${user.username} (${user.id})`,
        impactWarning: 'User will be banned from all platform features. Active sessions and socket connections are terminated.',
        onConfirm: async (reason) => {
          await apiFetch(`/api/admin/users/${user.id}/ban`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          })
          setStatusMessage(`User "${user.username}" banned successfully.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    } else if (action === 'unban') {
      setConfirmModalConfig({
        title: `Reactivate Account: ${user.username}`,
        actionLabel: 'Reactivate Account',
        intent: 'primary',
        targetDescription: `User ${user.username} (${user.id})`,
        impactWarning: 'Restores user account status to ACTIVE.',
        onConfirm: async (reason) => {
          await apiFetch(`/api/admin/users/${user.id}/unban`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          })
          setStatusMessage(`User "${user.username}" reactivated to active status.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    } else if (action === 'role') {
      setConfirmModalConfig({
        title: `Change Administrative Role: ${user.username}`,
        actionLabel: 'Update Role',
        intent: 'warning',
        roleSelection: true,
        currentRole: user.role,
        targetDescription: `User ${user.username} (Current: ${user.role})`,
        impactWarning: 'Administrative privilege grants or revokes access to the Operational Console and sensitive APIs.',
        onConfirm: async (reason, newRole) => {
          await apiFetch(`/api/admin/users/${user.id}/role`, {
            method: 'POST',
            body: JSON.stringify({ role: newRole, reason }),
          })
          setStatusMessage(`User "${user.username}" role updated to ${newRole}.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    }
  }

  function triggerVoidMatch(matchId: string, match?: MatchItem) {
    const stakeText = match ? `${match.stake} ${match.currency}` : 'active stakes'
    setConfirmModalConfig({
      title: `Void Match: ${matchId}`,
      actionLabel: 'Confirm Void & Refund',
      intent: 'danger',
      targetDescription: `Match ID: ${matchId}`,
      impactWarning: `Voiding will permanently cancel this match and issue AUTOMATIC COMPENSATING REFUNDS (${stakeText}) to both participating players in the ledger.`,
      onConfirm: async (reason) => {
        const idempotencyKey = `ui_void_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        await apiFetch(`/api/admin/matches/${matchId}/void`, {
          method: 'POST',
          body: JSON.stringify({ reason, idempotencyKey }),
        })
        setStatusMessage(`Match [${matchId}] voided and compensating refunds issued.`)
        fetchMatches()
        if (selectedMatchDetail) setSelectedMatchDetail(null)
      },
      onClose: () => setConfirmModalConfig(null),
    })
  }

  function triggerReverseLedger(entry: LedgerItem) {
    setConfirmModalConfig({
      title: `Reverse Ledger Entry: ${entry.id}`,
      actionLabel: 'Issue Compensating Reversal',
      intent: 'danger',
      targetDescription: `Entry ${entry.id} | User: ${entry.userId} | Amount: ${entry.amount} ${entry.currency}`,
      impactWarning: `This will insert a new compensating ledger entry of ${-entry.amount} ${entry.currency} into the append-only ledger.`,
      onConfirm: async (reason) => {
        const idempotencyKey = `ui_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        await apiFetch('/api/admin/wallet/reverse', {
          method: 'POST',
          body: JSON.stringify({ originalLedgerId: entry.id, reason, idempotencyKey }),
        })
        setStatusMessage(`Ledger entry [${entry.id}] reversed successfully.`)
        fetchLedger()
      },
      onClose: () => setConfirmModalConfig(null),
    })
  }

  async function handleGrantCurrency(userId: string, currency: 'coins' | 'diamonds', amount: number, reason: string) {
    const idempotencyKey = `ui_grant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    await apiFetch(`/api/admin/wallet/grant-${currency}`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId: userId, amount, reason, idempotencyKey }),
    })
    setStatusMessage(`Successfully granted ${amount} ${currency.toUpperCase()} to user ${userId}.`)
    fetchUsers()
    if (selectedUserDetail) inspectUser(userId)
    if (activeTab === 'ledger') fetchLedger()
    if (activeTab === 'dashboard') fetchDashboard()
  }

  // ---------------------------------------------------------------------------
  // Render: Loading Admin Auth Session
  // ---------------------------------------------------------------------------
  if (isAdminAuthenticated === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Verifying operator credentials...</div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Admin Login Form (Unauthenticated)
  // ---------------------------------------------------------------------------
  if (!isAdminAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '16px' }}>
        <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '12px', padding: '36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', color: '#fbbf24', margin: '0 0 8px 0', letterSpacing: '0.05em', fontWeight: 700 }}>
            FUGLUCK OPERATOR CONSOLE
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '24px' }}>
            Administrative authentication required. Access is protected by server-side IP lockouts and immutable audit logs.
          </p>

          {adminAuthError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '20px', textAlign: 'left', lineHeight: 1.4 }}>
              <strong>Authentication Error: </strong>{adminAuthError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                ADMINISTRATOR USERNAME
              </label>
              <input
                type="text"
                value={adminUsernameInput}
                onChange={(e) => setAdminUsernameInput(e.target.value)}
                placeholder="Enter operator username"
                required
                disabled={isLoggingIn}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid #1e2030', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                ADMINISTRATOR PASSWORD
              </label>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Enter operator password"
                required
                disabled={isLoggingIn}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid #1e2030', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                background: '#d97706',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                marginTop: '6px',
                letterSpacing: '0.05em',
                opacity: isLoggingIn ? 0.6 : 1,
              }}
            >
              {isLoggingIn ? 'Authenticating...' : 'Authenticate Console Session'}
            </button>
          </form>

          <div style={{ marginTop: '24px', borderTop: '1px solid #1e2030', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={onNavigateHome}
              style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              ← Return to Main Application
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Authenticated Operational Console
  // ---------------------------------------------------------------------------
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      {/* Modals */}
      {confirmModalConfig && <ActionConfirmModal config={confirmModalConfig} />}
      {grantModalUser && (
        <GrantCurrencyModal
          user={grantModalUser}
          onClose={() => setGrantModalUser(null)}
          onGrant={handleGrantCurrency}
        />
      )}
      {selectedUserDetail && (
        <UserDetailModal
          detail={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          onOpenAction={(action, user) => {
            if (action === 'grant') {
              setGrantModalUser(user)
            } else {
              triggerUserAction(action as any, user)
            }
          }}
        />
      )}
      {selectedMatchDetail && (
        <MatchDetailModal
          detail={selectedMatchDetail}
          onClose={() => setSelectedMatchDetail(null)}
          onVoidMatch={(matchId) => triggerVoidMatch(matchId, selectedMatchDetail.match)}
        />
      )}
      {viewingAuditJson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setViewingAuditJson(null)}>
          <div style={{ background: '#12131c', border: '1px solid #282a36', borderRadius: '8px', padding: '20px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#fbbf24' }}>Audit Event Details: {viewingAuditJson.action}</h4>
              <button type="button" onClick={() => setViewingAuditJson(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <pre style={{ background: '#0a0a0f', padding: '12px', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', overflowX: 'auto' }}>
              {JSON.stringify(viewingAuditJson, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#12131c', borderBottom: '1px solid #1e2030' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.05em' }}>FUGLUCK</span>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>OPERATIONAL CONSOLE</span>
          </div>
          <span style={{ fontSize: '11px', background: '#064e3b', color: '#6ee7b7', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
            ● SERVER AUTHORIZED
          </span>
          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Admin: <strong>{adminUser?.username}</strong> ({adminUser?.role})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'dashboard') fetchDashboard()
              if (activeTab === 'users') fetchUsers()
              if (activeTab === 'matches') fetchMatches()
              if (activeTab === 'ledger') fetchLedger()
              if (activeTab === 'audit') fetchAudit()
            }}
            style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
          >
            ↻ Refresh View
          </button>
          <button
            type="button"
            onClick={handleAdminLogout}
            style={{ background: '#7f1d1d', border: '1px solid #991b1b', color: '#fecaca', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Logout & Exit
          </button>
        </div>
      </header>

      {/* Notifications */}
      {statusMessage && (
        <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '10px 24px', fontSize: '13px', borderBottom: '1px solid #047857', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {errorMessage && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 24px', fontSize: '13px', borderBottom: '1px solid #b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '4px', padding: '10px 24px', background: '#0f1017', borderBottom: '1px solid #1e2030' }}>
        {[
          { id: 'dashboard', label: '📊 Dashboard Overview' },
          { id: 'users', label: '👥 User Management' },
          { id: 'matches', label: '⚔️ Match Operations' },
          { id: 'ledger', label: '💰 Wallet & Ledger' },
          { id: 'audit', label: '📜 Audit Log Explorer' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as Tab)}
            style={{
              background: activeTab === t.id ? '#1e2030' : 'transparent',
              border: activeTab === t.id ? '1px solid #334155' : '1px solid transparent',
              color: activeTab === t.id ? '#fbbf24' : '#94a3b8',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === t.id ? 700 : 500,
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Main Body */}
      <main style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && metrics && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Platform Telemetry & Circulation Overview
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>TOTAL USERS</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc' }}>{metrics.registeredUsers.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  <span style={{ color: '#34d399' }}>{metrics.activeUsers} active</span> · <span style={{ color: '#fbbf24' }}>{metrics.suspendedUsers} susp</span> · <span style={{ color: '#f87171' }}>{metrics.bannedUsers} ban</span>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, border: '1px solid #2563eb' }}>
                <div style={{ ...kpiLabelStyle, color: '#60a5fa' }}>ACTIVE MATCHES NOW</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#60a5fa' }}>{metrics.activeMatchesCount}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>In progress on server</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>COMPLETED MATCHES</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc' }}>{metrics.completedMatchesTotal.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>+{metrics.matchesCompletedToday} completed today</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>VOIDED MATCHES</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: metrics.totalMatchesVoided > 0 ? '#fca5a5' : '#f8fafc' }}>
                  {metrics.totalMatchesVoided}
                </div>
                <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{metrics.matchesVoidedToday} voided today</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>CIRCULATING COINS</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>{metrics.coinsCirculation.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Free-play aggregate</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>CIRCULATING DIAMONDS</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24' }}>{metrics.diamondsCirculation.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px' }}>Rake: {metrics.platformRakeDiamonds} 💎</div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Administrative Actions
            </h3>
            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <AuditTable logs={recentAuditLogs} onViewDetails={setViewingAuditJson} />
            </div>
          </div>
        )}

        {/* TAB 2: USERS */}
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search username, email, or user ID..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                style={{ flex: 1, minWidth: '240px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value)
                }}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value)
                }}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="SUPPORT">Support</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="OWNER">Owner</option>
              </select>
              <button
                type="button"
                onClick={() => fetchUsers(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Search
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>User / ID</th>
                    <th style={{ padding: '12px' }}>Role</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Balances</th>
                    <th style={{ padding: '12px' }}>Registered</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No users matching criteria.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{u.username}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{u.id}</div>
                          {u.email && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{u.email}</div>}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: '#1e293b', color: '#cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: u.status === 'banned' ? '#7f1d1d' : u.status === 'suspended' ? '#78350f' : '#064e3b',
                              color: u.status === 'banned' ? '#fca5a5' : u.status === 'suspended' ? '#fcd34d' : '#6ee7b7',
                            }}
                          >
                            {u.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div><span style={{ color: '#34d399', fontWeight: 600 }}>{u.balances.coins.toLocaleString()}</span> Coins</div>
                          <div><span style={{ color: '#fbbf24', fontWeight: 600 }}>{u.balances.diamonds.toLocaleString()}</span> Diamonds</div>
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => inspectUser(u.id)}
                              style={{ background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Inspect
                            </button>
                            {hasPerm('WALLET_GRANT_COINS') && (
                              <button
                                type="button"
                                onClick={() => setGrantModalUser(u)}
                                style={{ background: '#065f46', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                + Grant
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* User Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {userTotal} user(s)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={userPage <= 1 || isLoading}
                  onClick={() => fetchUsers(userPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: userPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {userPage}</span>
                <button
                  type="button"
                  disabled={usersList.length < 20 || isLoading}
                  onClick={() => fetchUsers(userPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: usersList.length < 20 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MATCHES */}
        {activeTab === 'matches' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Filter by Match ID..."
                value={matchIdQuery}
                onChange={(e) => setMatchIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchMatches(1)}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <select
                value={matchGameFilter}
                onChange={(e) => setMatchGameFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                {GAME_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              <select
                value={matchStatusFilter}
                onChange={(e) => setMatchStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="DISCONNECTED">DISCONNECTED</option>
                <option value="INTERRUPTED">INTERRUPTED</option>
                <option value="VOIDED">VOIDED</option>
              </select>
              <select
                value={matchCurrencyFilter}
                onChange={(e) => setMatchCurrencyFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Currencies</option>
                <option value="COINS">COINS</option>
                <option value="DIAMONDS">DIAMONDS</option>
              </select>
              <button
                type="button"
                onClick={() => fetchMatches(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Filter Matches
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Game / Match ID</th>
                    <th style={{ padding: '12px' }}>Players & Scores</th>
                    <th style={{ padding: '12px' }}>Stake</th>
                    <th style={{ padding: '12px' }}>Winner</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No matches found.
                      </td>
                    </tr>
                  ) : (
                    matchesList.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{m.gameId}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{m.id}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div>P1: <span style={{ color: '#cbd5e1' }}>{m.player1Id}</span> {m.scoreP1 != null && <strong style={{ color: '#38bdf8' }}>({m.scoreP1} pts)</strong>}</div>
                          <div>P2: <span style={{ color: '#cbd5e1' }}>{m.player2Id}</span> {m.scoreP2 != null && <strong style={{ color: '#38bdf8' }}>({m.scoreP2} pts)</strong>}</div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#fbbf24' }}>
                          {m.stake} {m.currency}
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#cbd5e1' }}>
                          {m.winnerId || 'Draw / None'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: m.status === 'VOIDED' ? '#7f1d1d' : m.status === 'ACTIVE' ? '#1e3a8a' : '#064e3b',
                              color: m.status === 'VOIDED' ? '#fca5a5' : m.status === 'ACTIVE' ? '#93c5fd' : '#6ee7b7',
                            }}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => inspectMatch(m.id)}
                              style={{ background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Inspect
                            </button>
                            {m.status !== 'VOIDED' && hasPerm('MATCHES_VOID') && (
                              <button
                                type="button"
                                onClick={() => triggerVoidMatch(m.id, m)}
                                style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Void
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Matches Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {matchTotal} match(es)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={matchPage <= 1 || isLoading}
                  onClick={() => fetchMatches(matchPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: matchPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {matchPage}</span>
                <button
                  type="button"
                  disabled={matchesList.length < 20 || isLoading}
                  onClick={() => fetchMatches(matchPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: matchesList.length < 20 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LEDGER */}
        {activeTab === 'ledger' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Filter by User ID..."
                value={ledgerUserIdQuery}
                onChange={(e) => setLedgerUserIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLedger(1)}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <select
                value={ledgerCurrencyFilter}
                onChange={(e) => setLedgerCurrencyFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Currencies</option>
                <option value="COINS">COINS</option>
                <option value="DIAMONDS">DIAMONDS</option>
              </select>
              <button
                type="button"
                onClick={() => fetchLedger(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Filter Ledger
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Entry ID / Date</th>
                    <th style={{ padding: '12px' }}>User ID</th>
                    <th style={{ padding: '12px' }}>Amount</th>
                    <th style={{ padding: '12px' }}>Reason</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No ledger entries found.
                      </td>
                    </tr>
                  ) : (
                    ledgerList.map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{l.id}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(l.createdAt).toLocaleString()}</div>
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', color: '#f1f5f9' }}>{l.userId}</td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: l.amount >= 0 ? '#34d399' : '#f87171',
                            }}
                          >
                            {l.amount >= 0 ? `+${l.amount.toLocaleString()}` : l.amount.toLocaleString()} {l.currency}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#cbd5e1', fontSize: '12px' }}>{l.reason}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          {!l.reason.includes('admin_reversal_') && hasPerm('WALLET_REVERSE_TRANSACTION') && (
                            <button
                              type="button"
                              onClick={() => triggerReverseLedger(l)}
                              style={{
                                background: '#7f1d1d',
                                color: '#fca5a5',
                                border: '1px solid #991b1b',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                              }}
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {ledgerTotal} ledger row(s)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={ledgerPage <= 1 || isLoading}
                  onClick={() => fetchLedger(ledgerPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: ledgerPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {ledgerPage}</span>
                <button
                  type="button"
                  disabled={ledgerList.length < 20 || isLoading}
                  onClick={() => fetchLedger(ledgerPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: ledgerList.length < 20 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Action Types</option>
                <option value="ADMIN_BAN_USER">ADMIN_BAN_USER</option>
                <option value="ADMIN_SUSPEND_USER">ADMIN_SUSPEND_USER</option>
                <option value="ADMIN_UNBAN_USER">ADMIN_UNBAN_USER</option>
                <option value="ADMIN_UPDATE_USER_ROLE">ADMIN_UPDATE_USER_ROLE</option>
                <option value="ADMIN_GRANT_COINS">ADMIN_GRANT_COINS</option>
                <option value="ADMIN_GRANT_DIAMONDS">ADMIN_GRANT_DIAMONDS</option>
                <option value="ADMIN_VOID_MATCH">ADMIN_VOID_MATCH</option>
                <option value="ADMIN_REVERSE_LEDGER_ENTRY">ADMIN_REVERSE_LEDGER_ENTRY</option>
              </select>
              <select
                value={auditTargetTypeFilter}
                onChange={(e) => setAuditTargetTypeFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Target Types</option>
                <option value="user">User</option>
                <option value="match">Match</option>
                <option value="ledger">Ledger</option>
                <option value="system">System</option>
              </select>
              <input
                type="text"
                placeholder="Target ID..."
                value={auditTargetIdQuery}
                onChange={(e) => setAuditTargetIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAudit(1)}
                style={{ width: '160px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <input
                type="text"
                placeholder="Admin ID..."
                value={auditAdminIdQuery}
                onChange={(e) => setAuditAdminIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAudit(1)}
                style={{ width: '160px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={() => fetchAudit(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Filter Logs
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <AuditTable logs={auditList} onViewDetails={setViewingAuditJson} />
            </div>

            {/* Audit Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {auditTotal} audit event(s)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={auditPage <= 1 || isLoading}
                  onClick={() => fetchAudit(auditPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: auditPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {auditPage}</span>
                <button
                  type="button"
                  disabled={auditList.length < 25 || isLoading}
                  onClick={() => fetchAudit(auditPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: auditList.length < 25 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents & Helpers
// ---------------------------------------------------------------------------
function AuditTable({ logs, onViewDetails }: { logs: AuditItem[]; onViewDetails?: (log: AuditItem) => void }) {
  if (logs.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No audit records found.</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
          <th style={{ padding: '12px' }}>Timestamp</th>
          <th style={{ padding: '12px' }}>Admin</th>
          <th style={{ padding: '12px' }}>Action</th>
          <th style={{ padding: '12px' }}>Target</th>
          <th style={{ padding: '12px' }}>Amount</th>
          <th style={{ padding: '12px' }}>Reason</th>
          {onViewDetails && <th style={{ padding: '12px', textAlign: 'right' }}>Details</th>}
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} style={{ borderBottom: '1px solid #1e2030' }}>
            <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>
              {new Date(log.createdAt).toLocaleString()}
            </td>
            <td style={{ padding: '12px', fontFamily: 'monospace', color: '#cbd5e1' }}>{log.adminUserId}</td>
            <td style={{ padding: '12px' }}>
              <span style={{ background: '#1e293b', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                {log.action}
              </span>
            </td>
            <td style={{ padding: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>{log.targetType}: </span>
              <span style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{log.targetId ?? 'N/A'}</span>
            </td>
            <td style={{ padding: '12px' }}>
              {log.amount != null ? (
                <span style={{ color: log.amount >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                  {log.amount >= 0 ? `+${log.amount}` : log.amount} {log.currency}
                </span>
              ) : (
                <span style={{ color: '#64748b' }}>—</span>
              )}
            </td>
            <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '12px' }}>{log.reason}</td>
            {onViewDetails && (
              <td style={{ padding: '12px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => onViewDetails(log)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#94a3b8', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Inspect
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const kpiCardStyle: React.CSSProperties = {
  background: '#12131c',
  border: '1px solid #1e2030',
  borderRadius: '8px',
  padding: '16px',
}

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: '0.05em',
  marginBottom: '6px',
}
