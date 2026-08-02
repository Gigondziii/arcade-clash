import { integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  // Null for now — the client derives a placeholder avatar from the
  // username. Reserved for real uploads later.
  avatarUrl: text("avatar_url"),
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesWon: integer("games_won").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only wallet ledger. Balances are SUM(amount) per (userId, currency).
// Never update/delete rows — grant/spend by inserting a new entry.
export const ledgerEntries = pgTable("ledger_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  // "COINS" (free Fmoney) or "DIAMONDS" (premium). Stored as text so a new
  // currency is a new value, not a schema migration — see PROGRESS.md.
  currency: varchar("currency", { length: 16 }).notNull(),
  // Signed integer minor units. Positive = credit, negative = debit.
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
