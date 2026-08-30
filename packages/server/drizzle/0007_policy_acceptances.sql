-- Migration 0007: Policy acceptances table for durable legal and compliance consent tracking
CREATE TABLE IF NOT EXISTS "policy_acceptances" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"policy_type" varchar(32) NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"source" varchar(32) DEFAULT 'registration' NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_acceptances" ADD CONSTRAINT "policy_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_acceptances_user_type" ON "policy_acceptances" ("user_id", "policy_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_policy_acceptances_type_version" ON "policy_acceptances" ("policy_type", "policy_version");
