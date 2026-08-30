export type { AdminRole, AdminPermission } from '@fugluck/shared'
import type { AdminRole } from '@fugluck/shared'

export type Tab = 'dashboard' | 'users' | 'matches' | 'ledger' | 'audit'

export type AdminUser = {
  id: string
  username: string
  email: string | null
  role: AdminRole
  status: string
}

export type Metrics = {
  registeredUsers: number
  activeUsers: number
  suspendedUsers: number
  bannedUsers: number
  activeMatchesCount: number
  completedMatchesTotal: number
  matchesCompletedToday: number
  matchesVoidedToday: number
  totalMatchesVoided: number
  coinsCirculation: number
  diamondsCirculation: number
  platformRakeDiamonds: number
}

export type UserItem = {
  id: string
  username: string
  email: string | null
  role: AdminRole
  status: 'active' | 'suspended' | 'banned'
  statusReason: string | null
  gamesPlayed?: number
  gamesWon?: number
  balances: { coins: number; diamonds: number }
  createdAt: string
}

export type MatchItem = {
  id: string
  gameId: string
  player1Id: string
  player2Id: string
  winnerId: string | null
  currency: string
  stake: number
  status: string
  scoreP1?: number | null
  scoreP2?: number | null
  statusReason?: string | null
  startedAt?: string | null
  endedAt?: string | null
  createdAt: string
}

export type LedgerItem = {
  id: string
  userId: string
  currency: string
  amount: number
  reason: string
  createdAt: string
}

export type AuditItem = {
  id: string
  adminUserId: string
  action: string
  targetType: string
  targetId: string | null
  amount: number | null
  currency: string | null
  reason: string
  idempotencyKey?: string | null
  details?: any
  createdAt: string
}

export type MatchDetail = {
  match: MatchItem
  settlement: {
    matchId: string
    status: string
    currency: string
    stake: number
    settledAt: string
  } | null
  relatedLedger: LedgerItem[]
  relatedAuditLogs: AuditItem[]
}

export type UserDetail = {
  user: UserItem
  recentMatches: MatchItem[]
  recentLedger: LedgerItem[]
  userAuditLogs: AuditItem[]
}
