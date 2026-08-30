CREATE UNIQUE INDEX IF NOT EXISTS "ledger_user_reason_unique" ON "ledger_entries" ("user_id", "reason");
