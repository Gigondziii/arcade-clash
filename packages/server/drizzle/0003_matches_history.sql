CREATE TABLE IF NOT EXISTS "matches_history" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"player1_id" text NOT NULL,
	"player2_id" text NOT NULL,
	"winner_id" text,
	"currency" varchar(16) DEFAULT 'COINS' NOT NULL,
	"stake" integer DEFAULT 0 NOT NULL,
	"seed" bigint NOT NULL,
	"input_log_p1" jsonb,
	"input_log_p2" jsonb,
	"score_p1" integer DEFAULT 0 NOT NULL,
	"score_p2" integer DEFAULT 0 NOT NULL,
	"status" varchar(16) DEFAULT 'ACTIVE' NOT NULL,
	"status_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "match_settlements" (
	"match_id" text PRIMARY KEY NOT NULL,
	"status" varchar(16) NOT NULL,
	"winner_id" text,
	"loser_id" text,
	"currency" varchar(16) NOT NULL,
	"stake" integer DEFAULT 0 NOT NULL,
	"winner_payout" integer DEFAULT 0 NOT NULL,
	"rake_fee" integer DEFAULT 0 NOT NULL,
	"settled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_p1" ON "matches_history" ("player1_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_p2" ON "matches_history" ("player2_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_game" ON "matches_history" ("game_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_status" ON "matches_history" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_matches_created" ON "matches_history" ("created_at");
