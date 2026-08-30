import "dotenv/config";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: "packages/server/.env" });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy packages/server/.env.example to .env and fill it in.");
}

import { sql } from "drizzle-orm";

// Determine SSL requirements. Remote cloud PostgreSQL providers (Supabase Supavisor
// pooler, Neon, AWS) use intermediate cloud connection proxies. In Node.js 'pg',
// connecting with TLS encryption to Supabase poolers requires rejectUnauthorized: false
// unless Supabase's private root CA certificate is injected into the trust store.
// This setting is strictly scoped to the PostgreSQL client connection pool and does
// NOT affect global Node.js TLS verification.
const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
const isSslRequired =
  !isLocalhost &&
  (connectionString.includes("sslmode=require") ||
    connectionString.includes("supabase.com") ||
    connectionString.includes("neon.tech") ||
    process.env.NODE_ENV === "production");

const cleanConnectionString = isSslRequired
  ? connectionString.replace(/[?&]sslmode=[^&]+/g, "").replace(/\?$/, "")
  : connectionString;

export const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

let schemaEnsured = false;
export async function ensureUserSchema() {
  if (schemaEnsured) return;
  try {
    const tableCheck = await db.execute(sql`SELECT to_regclass('public.users') as exists;`);
    const tableExists = tableCheck.rows?.[0]?.exists;
    if (!tableExists) {
      // Base migrations haven't run yet; skip runtime alteration
      return;
    }
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified boolean NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;
      ALTER TABLE ledger_entries ALTER COLUMN reason TYPE varchar(128);
      CREATE UNIQUE INDEX IF NOT EXISTS ledger_user_reason_unique ON ledger_entries (user_id, reason);
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id),
        token_hash text NOT NULL UNIQUE,
        expires_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS policy_acceptances (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        policy_type varchar(32) NOT NULL,
        policy_version varchar(32) NOT NULL,
        source varchar(32) NOT NULL DEFAULT 'registration',
        ip_address varchar(64),
        user_agent text,
        accepted_at timestamp with time zone NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user_type ON policy_acceptances (user_id, policy_type);
      CREATE INDEX IF NOT EXISTS idx_policy_acceptances_type_version ON policy_acceptances (policy_type, policy_version);
    `);
    schemaEnsured = true;
  } catch (err) {
    console.warn("[db] ensureUserSchema notice:", err);
  }
}
