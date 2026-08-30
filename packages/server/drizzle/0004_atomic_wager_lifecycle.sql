-- Serialize every ledger mutation per user and reject any debit that would
-- make that user's balance negative. This protects all application paths,
-- not only matchmaking, from concurrent double-spend races.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role varchar(20) NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(16) NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_reason text;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE ledger_entries ALTER COLUMN reason TYPE varchar(128);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ledger_user_currency_idx ON ledger_entries (user_id, currency);
--> statement-breakpoint
INSERT INTO users (id, username, password_hash)
VALUES ('platform_rake_account', 'platform_rake_account', '!system-account-no-login!')
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_non_negative_ledger_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(1094927180, hashtext(NEW.user_id));

  IF NEW.amount < 0 THEN
    SELECT COALESCE(SUM(amount), 0)
      INTO current_balance
      FROM ledger_entries
     WHERE user_id = NEW.user_id
       AND currency = NEW.currency;

    IF current_balance + NEW.amount < 0 THEN
      RAISE EXCEPTION 'insufficient % balance for user %', NEW.currency, NEW.user_id
        USING ERRCODE = '23514', CONSTRAINT = 'ledger_non_negative_balance';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ledger_non_negative_guard ON ledger_entries;
--> statement-breakpoint
CREATE TRIGGER ledger_non_negative_guard
BEFORE INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION enforce_non_negative_ledger_balance();
--> statement-breakpoint
ALTER TABLE matches_history
  ADD CONSTRAINT matches_history_currency_check CHECK (currency IN ('COINS', 'DIAMONDS')) NOT VALID;
--> statement-breakpoint
ALTER TABLE matches_history
  ADD CONSTRAINT matches_history_stake_check CHECK (stake >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE match_settlements
  ADD CONSTRAINT match_settlements_match_id_matches_history_id_fk
  FOREIGN KEY (match_id) REFERENCES matches_history(id) NOT VALID;
--> statement-breakpoint
ALTER TABLE match_settlements
  ADD CONSTRAINT match_settlements_status_check CHECK (status IN ('PAYOUT', 'REFUND', 'DRAW', 'VOIDED')) NOT VALID;
--> statement-breakpoint
ALTER TABLE match_settlements
  ADD CONSTRAINT match_settlements_currency_check CHECK (currency IN ('COINS', 'DIAMONDS')) NOT VALID;
--> statement-breakpoint
ALTER TABLE match_settlements
  ADD CONSTRAINT match_settlements_amount_check CHECK (stake > 0 AND winner_payout >= 0 AND rake_fee >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE match_settlements
  ADD CONSTRAINT match_settlements_payout_shape_check CHECK (
    (status = 'PAYOUT' AND winner_id IS NOT NULL AND loser_id IS NOT NULL)
    OR
    (status <> 'PAYOUT' AND winner_id IS NULL AND loser_id IS NULL AND winner_payout = 0 AND rake_fee = 0)
  ) NOT VALID;
