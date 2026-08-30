-- Migration 0005: Reconcile schema parity with Drizzle schema.ts
-- Creates missing tables: email_verification_tokens, admin_lockout_attempts, admin_audit_logs, trivia_questions
-- Validates all NOT VALID constraints from migration 0004

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_lockout_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" varchar(64) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_lockout_attempts_ip_address_unique" UNIQUE("ip_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" text NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32) DEFAULT 'system' NOT NULL,
	"target_id" text,
	"amount" integer,
	"currency" varchar(16),
	"reason" text DEFAULT 'No reason provided' NOT NULL,
	"idempotency_key" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_logs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trivia_questions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category" varchar(80) NOT NULL,
	"difficulty" varchar(20),
	"question" text NOT NULL,
	"correct_answer" text NOT NULL,
	"incorrect_answers" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trivia_cat_id" ON "trivia_questions" ("category", "id");
--> statement-breakpoint
ALTER TABLE "matches_history" VALIDATE CONSTRAINT "matches_history_currency_check";
--> statement-breakpoint
ALTER TABLE "matches_history" VALIDATE CONSTRAINT "matches_history_stake_check";
--> statement-breakpoint
ALTER TABLE "match_settlements" VALIDATE CONSTRAINT "match_settlements_match_id_matches_history_id_fk";
--> statement-breakpoint
ALTER TABLE "match_settlements" VALIDATE CONSTRAINT "match_settlements_status_check";
--> statement-breakpoint
ALTER TABLE "match_settlements" VALIDATE CONSTRAINT "match_settlements_currency_check";
--> statement-breakpoint
ALTER TABLE "match_settlements" VALIDATE CONSTRAINT "match_settlements_amount_check";
--> statement-breakpoint
ALTER TABLE "match_settlements" VALIDATE CONSTRAINT "match_settlements_payout_shape_check";
