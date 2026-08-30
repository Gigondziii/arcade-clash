import React, { useState } from 'react'
import type { UserDetail, MatchDetail, UserItem, AdminRole } from './adminTypes'

// ---------------------------------------------------------------------------
// Action Confirmation Modal
// ---------------------------------------------------------------------------
export type ConfirmModalConfig = {
  title: string
  actionLabel: string
  intent: 'danger' | 'warning' | 'primary'
  targetDescription: string
  impactWarning?: string
  requireReason?: boolean
  initialReason?: string
  roleSelection?: boolean
  currentRole?: AdminRole
  onConfirm: (reason: string, selectedRole?: AdminRole) => Promise<void>
  onClose: () => void
}

export function ActionConfirmModal({ config }: { config: ConfirmModalConfig }) {
  const [reason, setReason] = useState(config.initialReason || '')
  const [selectedRole, setSelectedRole] = useState<AdminRole>(config.currentRole || 'user')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReasonRequired = config.requireReason !== false
  const canSubmit = !isReasonRequired || reason.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await config.onConfirm(reason.trim(), config.roleSelection ? selectedRole : undefined)
      config.onClose()
    } catch (err: any) {
      setError(err?.message || 'Operation failed.')
      setIsSubmitting(false)
    }
  }

  const intentBg =
    config.intent === 'danger'
      ? '#dc2626'
      : config.intent === 'warning'
      ? '#d97706'
      : '#2563eb'

  return (
    <div style={backdropStyle} onClick={config.onClose}>
      <div
        style={modalBoxStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="confirm-dialog-title"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 id="confirm-dialog-title" style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>
            {config.title}
          </h3>
          <button
            type="button"
            onClick={config.onClose}
            style={closeButtonStyle}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div style={{ background: '#181926', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #282a36' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>TARGET</div>
          <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>{config.targetDescription}</div>
        </div>

        {config.impactWarning && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', lineHeight: 1.4 }}>
            <span style={{ fontWeight: 'bold' }}>⚠️ Operational Impact: </span>
            {config.impactWarning}
          </div>
        )}

        {error && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {config.roleSelection && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>NEW ASSIGNED ROLE</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AdminRole)}
                style={inputStyle}
              >
                <option value="user">user (Standard Player)</option>
                <option value="SUPPORT">SUPPORT</option>
                <option value="MODERATOR">MODERATOR</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="OWNER">OWNER</option>
              </select>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>
              {isReasonRequired ? 'ACTION REASON (REQUIRED FOR AUDIT LOG)' : 'ACTION REASON (OPTIONAL)'}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear, auditable operational reason..."
              rows={3}
              required={isReasonRequired}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={config.onClose}
              disabled={isSubmitting}
              style={cancelButtonStyle}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              style={{
                ...primaryButtonStyle,
                background: intentBg,
                opacity: !canSubmit || isSubmitting ? 0.5 : 1,
                cursor: !canSubmit || isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Processing...' : config.actionLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Grant Currency Modal
// ---------------------------------------------------------------------------
export function GrantCurrencyModal({
  user,
  initialCurrency = 'coins',
  onClose,
  onGrant,
}: {
  user: UserItem
  initialCurrency?: 'coins' | 'diamonds'
  onClose: () => void
  onGrant: (userId: string, currency: 'coins' | 'diamonds', amount: number, reason: string) => Promise<void>
}) {
  const [currency, setCurrency] = useState<'coins' | 'diamonds'>(initialCurrency)
  const [amount, setAmount] = useState<number>(100)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValidAmount = Number.isInteger(amount) && amount > 0 && amount <= 100_000
  const canSubmit = isValidAmount && reason.trim().length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await onGrant(user.id, currency, amount, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Grant operation failed.')
      setIsSubmitting(false)
    }
  }

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>
            Grant Wallet Currency
          </h3>
          <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={{ background: '#181926', padding: '12px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #282a36' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>RECIPIENT</div>
          <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>
            {user.username} <span style={{ color: '#64748b', fontSize: '12px' }}>({user.id})</span>
          </div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
            Current Balances: <strong style={{ color: '#34d399' }}>{user.balances.coins} Coins</strong> | <strong style={{ color: '#fbbf24' }}>{user.balances.diamonds} Diamonds</strong>
          </div>
        </div>

        {error && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>CURRENCY TYPE</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'coins' | 'diamonds')}
                style={inputStyle}
              >
                <option value="coins">COINS (Free-play currency)</option>
                <option value="diamonds">DIAMONDS (Staked currency)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>AMOUNT (1 - 100,000)</label>
              <input
                type="number"
                min={1}
                max={100000}
                step={1}
                value={amount}
                onChange={(e) => setAmount(Math.max(1, Math.min(100000, Math.floor(Number(e.target.value) || 0))))}
                style={inputStyle}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>AUDIT REASON (REQUIRED)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Promotional tournament reward, customer support adjustment..."
              rows={3}
              required
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} disabled={isSubmitting} style={cancelButtonStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              style={{
                ...primaryButtonStyle,
                background: currency === 'coins' ? '#059669' : '#d97706',
                opacity: !canSubmit || isSubmitting ? 0.5 : 1,
              }}
            >
              {isSubmitting ? 'Granting...' : `+ Grant ${amount} ${currency.toUpperCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User Detail Modal
// ---------------------------------------------------------------------------
export function UserDetailModal({
  detail,
  onClose,
  onOpenAction,
}: {
  detail: UserDetail
  onClose: () => void
  onOpenAction: (action: 'suspend' | 'ban' | 'unban' | 'role' | 'grant', user: UserItem) => void
}) {
  const { user, recentMatches, recentLedger, userAuditLogs } = detail
  const [activeSubTab, setActiveSubTab] = useState<'matches' | 'ledger' | 'audit'>('matches')

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={{ ...modalBoxStyle, maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #282a36', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>{user.username}</span>
            <span style={{ marginLeft: '10px', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
              {user.role}
            </span>
            <span style={{
              marginLeft: '8px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 500,
              background: user.status === 'banned' ? '#7f1d1d' : user.status === 'suspended' ? '#78350f' : '#064e3b',
              color: user.status === 'banned' ? '#fca5a5' : user.status === 'suspended' ? '#fcd34d' : '#6ee7b7',
            }}>
              {user.status.toUpperCase()}
            </span>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        {/* Profile Card & Balances */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>USER ID</div>
            <div style={{ fontSize: '12px', color: '#f1f5f9', fontFamily: 'monospace' }}>{user.id}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>EMAIL</div>
            <div style={{ fontSize: '13px', color: '#f1f5f9' }}>{user.email || 'None'}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>COIN BALANCE</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399' }}>{user.balances.coins.toLocaleString()}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>DIAMOND BALANCE</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fbbf24' }}>{user.balances.diamonds.toLocaleString()}</div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', padding: '12px', background: '#12131c', borderRadius: '6px', border: '1px solid #1e2030' }}>
          <button type="button" onClick={() => onOpenAction('grant', user)} style={{ ...actionBtnStyle, background: '#059669' }}>
            + Grant Currency
          </button>
          <button type="button" onClick={() => onOpenAction('role', user)} style={{ ...actionBtnStyle, background: '#3b82f6' }}>
            Change Role
          </button>
          {user.status !== 'suspended' && user.status !== 'banned' && (
            <button type="button" onClick={() => onOpenAction('suspend', user)} style={{ ...actionBtnStyle, background: '#d97706' }}>
              Suspend Account
            </button>
          )}
          {user.status !== 'banned' && (
            <button type="button" onClick={() => onOpenAction('ban', user)} style={{ ...actionBtnStyle, background: '#dc2626' }}>
              Ban Account
            </button>
          )}
          {(user.status === 'suspended' || user.status === 'banned') && (
            <button type="button" onClick={() => onOpenAction('unban', user)} style={{ ...actionBtnStyle, background: '#16a34a' }}>
              Unban / Reactivate
            </button>
          )}
        </div>

        {/* Sub Navigation */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e2030', marginBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setActiveSubTab('matches')}
            style={subTabStyle(activeSubTab === 'matches')}
          >
            Matches ({recentMatches.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('ledger')}
            style={subTabStyle(activeSubTab === 'ledger')}
          >
            Ledger History ({recentLedger.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            style={subTabStyle(activeSubTab === 'audit')}
          >
            Audit Log ({userAuditLogs.length})
          </button>
        </div>

        {/* Sub Tab Content */}
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          {activeSubTab === 'matches' && (
            recentMatches.length === 0 ? (
              <div style={emptyTextStyle}>No matches recorded for this user.</div>
            ) : (
              <table style={miniTableStyle}>
                <thead>
                  <tr style={miniTableHeaderStyle}>
                    <th>Match ID / Game</th>
                    <th>Opponent</th>
                    <th>Stake</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMatches.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1e2030' }}>
                      <td style={{ padding: '8px' }}>
                        <div style={{ fontWeight: 600 }}>{m.gameId}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{m.id}</div>
                      </td>
                      <td style={{ padding: '8px' }}>{m.player1Id === user.id ? m.player2Id : m.player1Id}</td>
                      <td style={{ padding: '8px' }}>{m.stake} {m.currency}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ color: m.status === 'VOIDED' ? '#f87171' : '#34d399' }}>{m.status}</span>
                      </td>
                      <td style={{ padding: '8px', fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeSubTab === 'ledger' && (
            recentLedger.length === 0 ? (
              <div style={emptyTextStyle}>No ledger entries found.</div>
            ) : (
              <table style={miniTableStyle}>
                <thead>
                  <tr style={miniTableHeaderStyle}>
                    <th>Entry ID</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLedger.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid #1e2030' }}>
                      <td style={{ padding: '8px', fontSize: '11px', fontFamily: 'monospace' }}>{l.id}</td>
                      <td style={{ padding: '8px', fontWeight: 'bold', color: l.amount >= 0 ? '#34d399' : '#f87171' }}>
                        {l.amount >= 0 ? `+${l.amount}` : l.amount} {l.currency}
                      </td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{l.reason}</td>
                      <td style={{ padding: '8px', fontSize: '11px', color: '#94a3b8' }}>
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeSubTab === 'audit' && (
            userAuditLogs.length === 0 ? (
              <div style={emptyTextStyle}>No administrative actions recorded against this user.</div>
            ) : (
              <table style={miniTableStyle}>
                <thead>
                  <tr style={miniTableHeaderStyle}>
                    <th>Timestamp</th>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {userAuditLogs.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #1e2030' }}>
                      <td style={{ padding: '8px', fontSize: '11px', color: '#94a3b8' }}>{new Date(a.createdAt).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>{a.adminUserId}</td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ background: '#1e293b', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                          {a.action}
                        </span>
                      </td>
                      <td style={{ padding: '8px', fontSize: '12px' }}>{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Match Detail Modal
// ---------------------------------------------------------------------------
export function MatchDetailModal({
  detail,
  onClose,
  onVoidMatch,
}: {
  detail: MatchDetail
  onClose: () => void
  onVoidMatch: (matchId: string) => void
}) {
  const { match, settlement, relatedLedger, relatedAuditLogs } = detail

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={{ ...modalBoxStyle, maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #282a36', paddingBottom: '12px' }}>
          <div>
            <span style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>Match: {match.gameId}</span>
            <span style={{ marginLeft: '10px', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500, background: match.status === 'VOIDED' ? '#7f1d1d' : '#064e3b', color: match.status === 'VOIDED' ? '#fca5a5' : '#6ee7b7' }}>
              {match.status}
            </span>
          </div>
          <button type="button" onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        {/* Match Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>MATCH ID</div>
            <div style={{ fontSize: '11px', color: '#f1f5f9', fontFamily: 'monospace', wordBreak: 'break-all' }}>{match.id}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>PLAYER 1</div>
            <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{match.player1Id}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Score: {match.scoreP1 ?? 'N/A'}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>PLAYER 2</div>
            <div style={{ fontSize: '12px', color: '#f1f5f9' }}>{match.player2Id}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Score: {match.scoreP2 ?? 'N/A'}</div>
          </div>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>STAKE / POT</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fbbf24' }}>
              {match.stake} {match.currency} {match.stake > 0 && `(Pot: ${match.stake * 2})`}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Winner: {match.winnerId || 'Draw / None'}</div>
          </div>
        </div>

        {/* Settlement Info */}
        <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '6px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>SETTLEMENT RECORD</div>
          {settlement ? (
            <div style={{ fontSize: '13px', color: '#f1f5f9' }}>
              Status: <strong style={{ color: settlement.status === 'VOIDED' ? '#f87171' : '#34d399' }}>{settlement.status}</strong> |
              Stake: {settlement.stake} {settlement.currency} |
              Settled At: {new Date(settlement.settledAt).toLocaleString()}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#64748b' }}>No explicit settlement table row (standard resolution or guest match).</div>
          )}
        </div>

        {/* Related Ledger Transactions */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>RELATED LEDGER TRANSACTIONS ({relatedLedger.length})</div>
          {relatedLedger.length === 0 ? (
            <div style={emptyTextStyle}>No direct ledger entries matching match ID.</div>
          ) : (
            <table style={miniTableStyle}>
              <thead>
                <tr style={miniTableHeaderStyle}>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {relatedLedger.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #1e2030' }}>
                    <td style={{ padding: '8px' }}>{l.userId}</td>
                    <td style={{ padding: '8px', fontWeight: 'bold', color: l.amount >= 0 ? '#34d399' : '#f87171' }}>
                      {l.amount >= 0 ? `+${l.amount}` : l.amount} {l.currency}
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px' }}>{l.reason}</td>
                    <td style={{ padding: '8px', fontSize: '11px', color: '#94a3b8' }}>{new Date(l.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Related Audit Logs */}
        {relatedAuditLogs && relatedAuditLogs.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>RELATED AUDIT LOGS ({relatedAuditLogs.length})</div>
            <table style={miniTableStyle}>
              <thead>
                <tr style={miniTableHeaderStyle}>
                  <th>Timestamp</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {relatedAuditLogs.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #1e2030' }}>
                    <td style={{ padding: '8px', fontSize: '11px', color: '#94a3b8' }}>{new Date(a.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '8px' }}>{a.adminUserId}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ background: '#1e293b', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>
                        {a.action}
                      </span>
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px' }}>{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Controls */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          {match.status !== 'VOIDED' && (
            <button
              type="button"
              onClick={() => onVoidMatch(match.id)}
              style={{ ...primaryButtonStyle, background: '#dc2626' }}
            >
              Void Match & Refund Stakes
            </button>
          )}
          <button type="button" onClick={onClose} style={cancelButtonStyle}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Styles
// ---------------------------------------------------------------------------
const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.75)',
  backdropFilter: 'blur(3px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '16px',
}

const modalBoxStyle: React.CSSProperties = {
  background: '#12131c',
  border: '1px solid #282a36',
  borderRadius: '10px',
  padding: '24px',
  maxWidth: '560px',
  width: '100%',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
  maxHeight: '90vh',
  overflowY: 'auto',
}

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '4px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#94a3b8',
  letterSpacing: '0.05em',
  marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#0b0c10',
  border: '1px solid #1e2030',
  borderRadius: '6px',
  color: '#f8fafc',
  fontSize: '13px',
  boxSizing: 'border-box',
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#1e2030',
  border: '1px solid #334155',
  color: '#94a3b8',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 18px',
  border: 'none',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  border: 'none',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
}

const statCardStyle: React.CSSProperties = {
  background: '#181926',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #282a36',
}

const statLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 600,
  color: '#94a3b8',
  letterSpacing: '0.05em',
  marginBottom: '4px',
}

const subTabStyle = (active: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid #fbbf24' : '2px solid transparent',
  color: active ? '#fbbf24' : '#94a3b8',
  padding: '8px 12px',
  fontSize: '13px',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
})

const miniTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '12px',
  background: '#0f1017',
  borderRadius: '4px',
}

const miniTableHeaderStyle: React.CSSProperties = {
  background: '#181926',
  color: '#94a3b8',
  textAlign: 'left',
  padding: '6px',
}

const emptyTextStyle: React.CSSProperties = {
  padding: '16px',
  textAlign: 'center',
  color: '#64748b',
  fontSize: '12px',
}
