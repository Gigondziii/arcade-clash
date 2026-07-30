import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
