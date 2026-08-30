import { boolean, bigserial, check, foreignKey, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  statusReason: text("status_reason"),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminLockoutAttempts = pgTable("admin_lockout_attempts", {
  id: text("id").primaryKey(),
  ipAddress: varchar("ip_address", { length: 64 }).notNull().unique(),
  attemptCount: integer("attempt_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: varchar("action", { length: 64 }).notNull(),
  targetType: varchar("target_type", { length: 32 }).notNull().default("system"),
  targetId: text("target_id"),
  amount: integer("amount"),
  currency: varchar("currency", { length: 16 }),
  reason: text("reason").notNull().default("No reason provided"),
  idempotencyKey: text("idempotency_key").unique(),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only wallet ledger. Balances are SUM(amount) per (userId, currency).
// Never update/delete rows — grant/spend by inserting a new entry.
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // "COINS" (free Fmoney) or "DIAMONDS" (premium). Stored as text so a new
    // currency is a new value, not a schema migration — see PROGRESS.md.
    currency: varchar("currency", { length: 16 }).notNull(),
    // Signed integer minor units. Positive = credit, negative = debit.
    amount: integer("amount").notNull(),
    reason: varchar("reason", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userReasonUnique: uniqueIndex("ledger_user_reason_unique").on(t.userId, t.reason),
    userCurrencyIdx: index("ledger_user_currency_idx").on(t.userId, t.currency),
  }),
);

export const friendships = pgTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id),
    addresseeId: text("addressee_id")
      .notNull()
      .references(() => users.id),
    // pending | accepted | rejected
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairUnique: uniqueIndex("friendships_pair_unique").on(t.requesterId, t.addresseeId),
  }),
);

export const matchesHistory = pgTable(
  "matches_history",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id").notNull(),
    player1Id: text("player1_id").notNull(),
    player2Id: text("player2_id").notNull(),
    winnerId: text("winner_id"),
    currency: varchar("currency", { length: 16 }).notNull().default("COINS"),
    stake: integer("stake").notNull().default(0),
    seed: bigserial("seed", { mode: "number" }).notNull(),
    inputLogP1: jsonb("input_log_p1"),
    inputLogP2: jsonb("input_log_p2"),
    scoreP1: integer("score_p1").notNull().default(0),
    scoreP2: integer("score_p2").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("ACTIVE"),
    statusReason: text("status_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => ({
    p1Idx: index("idx_matches_p1").on(t.player1Id),
    p2Idx: index("idx_matches_p2").on(t.player2Id),
    gameIdx: index("idx_matches_game").on(t.gameId),
    statusIdx: index("idx_matches_status").on(t.status),
    createdAtIdx: index("idx_matches_created").on(t.createdAt),
    currencyCheck: check("matches_history_currency_check", sql`${t.currency} in ('COINS', 'DIAMONDS')`),
    stakeCheck: check("matches_history_stake_check", sql`${t.stake} >= 0`),
  }),
);

// Database-enforced atomic match settlement record. Primary key is match_id.
// Enforces that a match can produce EXACTLY ONE settlement outcome (PAYOUT | REFUND | VOIDED).
export const matchSettlements = pgTable(
  "match_settlements",
  {
    matchId: text("match_id").primaryKey(),
    status: varchar("status", { length: 16 }).notNull(),
    winnerId: text("winner_id"),
    loserId: text("loser_id"),
    currency: varchar("currency", { length: 16 }).notNull(),
    stake: integer("stake").notNull().default(0),
    winnerPayout: integer("winner_payout").notNull().default(0),
    rakeFee: integer("rake_fee").notNull().default(0),
    settledAt: timestamp("settled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matchFk: foreignKey({ columns: [t.matchId], foreignColumns: [matchesHistory.id] }),
    statusCheck: check("match_settlements_status_check", sql`${t.status} in ('PAYOUT', 'REFUND', 'DRAW', 'VOIDED')`),
    currencyCheck: check("match_settlements_currency_check", sql`${t.currency} in ('COINS', 'DIAMONDS')`),
    amountCheck: check(
      "match_settlements_amount_check",
      sql`${t.stake} > 0 and ${t.winnerPayout} >= 0 and ${t.rakeFee} >= 0`,
    ),
    payoutShapeCheck: check(
      "match_settlements_payout_shape_check",
      sql`(${t.status} = 'PAYOUT' and ${t.winnerId} is not null and ${t.loserId} is not null) or (${t.status} <> 'PAYOUT' and ${t.winnerId} is null and ${t.loserId} is null and ${t.winnerPayout} = 0 and ${t.rakeFee} = 0)`,
    ),
  }),
);

export const triviaQuestions = pgTable(
  "trivia_questions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    category: varchar("category", { length: 80 }).notNull(),
    difficulty: varchar("difficulty", { length: 20 }),
    question: text("question").notNull(),
    correctAnswer: text("correct_answer").notNull(),
    incorrectAnswers: jsonb("incorrect_answers").notNull(),
  },
  (t) => ({
    catIdIdx: index("idx_trivia_cat_id").on(t.category, t.id),
  }),
);

export const policyAcceptances = pgTable(
  "policy_acceptances",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    policyType: varchar("policy_type", { length: 32 }).notNull(),
    policyVersion: varchar("policy_version", { length: 32 }).notNull(),
    source: varchar("source", { length: 32 }).notNull().default("registration"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPolicyIdx: index("idx_policy_acceptances_user_type").on(t.userId, t.policyType),
    typeVersionIdx: index("idx_policy_acceptances_type_version").on(t.policyType, t.policyVersion),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type MatchHistoryRecord = typeof matchesHistory.$inferSelect;
export type MatchSettlement = typeof matchSettlements.$inferSelect;
export type TriviaQuestion = typeof triviaQuestions.$inferSelect;
export type NewTriviaQuestion = typeof triviaQuestions.$inferInsert;
export type PolicyAcceptance = typeof policyAcceptances.$inferSelect;
export type NewPolicyAcceptance = typeof policyAcceptances.$inferInsert;

