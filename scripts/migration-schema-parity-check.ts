// Guard with centralized disposable database check before anything else
import "./require-disposable-test-database.ts";

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { Pool } from "pg";

let failures = 0;
let passes = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passes++;
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function applyMigrations(pool: Pool): Promise<void> {
  const drizzleDir = path.resolve(process.cwd(), "packages/server/drizzle");
  const migrationFiles = [
    "0000_early_marrow.sql",
    "0001_wallet_friends.sql",
    "0002_ledger_idempotency_unique.sql",
    "0003_matches_history.sql",
    "0004_atomic_wager_lifecycle.sql",
    "0005_reconcile_schema_parity.sql",
    "0006_password_reset_tokens.sql",
    "0007_policy_acceptances.sql",
  ];

  console.log("\nPhase 1: Applying migration chain (0000 -> 0007) to disposable database...\n");

  const client = await pool.connect();
  try {
    for (const filename of migrationFiles) {
      const filePath = path.join(drizzleDir, filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
      }

      const sqlContent = fs.readFileSync(filePath, "utf-8");
      const statements = sqlContent
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      console.log(`Applying ${filename} (${statements.length} statements)...`);
      for (const stmt of statements) {
        try {
          await client.query(stmt);
        } catch (err: any) {
          // If a table or index already exists from an earlier test run, handle gracefully
          if (err.code === "42P07" || err.code === "42710") {
            // duplicate_table or duplicate_object
            continue;
          }
          throw new Error(`Failed executing statement in ${filename}:\n${stmt}\nError: ${err.message}`);
        }
      }
      console.log(`  ✓ ${filename} applied successfully.`);
    }
  } finally {
    client.release();
  }
}

async function verifySchema(pool: Pool): Promise<void> {
  console.log("\nPhase 2: Introspecting PostgreSQL Catalogs & Asserting Schema Parity...\n");

  // 1. Verify all 9 expected tables exist
  const expectedTables = [
    "users",
    "email_verification_tokens",
    "password_reset_tokens",
    "policy_acceptances",
    "admin_lockout_attempts",
    "admin_audit_logs",
    "ledger_entries",
    "friendships",
    "matches_history",
    "match_settlements",
    "trivia_questions",
  ];

  const tableRes = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const existingTables = new Set(tableRes.rows.map((r: any) => r.table_name));

  for (const tableName of expectedTables) {
    check(`Table '${tableName}' exists in public schema`, existingTables.has(tableName));
  }

  // 2. Verify all columns for newly migrated tables
  const emailTokenCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'email_verification_tokens'`,
  );
  const emailCols = new Set(emailTokenCols.rows.map((r: any) => r.column_name));
  check("email_verification_tokens has id column", emailCols.has("id"));
  check("email_verification_tokens has user_id column", emailCols.has("user_id"));
  check("email_verification_tokens has token_hash column", emailCols.has("token_hash"));
  check("email_verification_tokens has expires_at column", emailCols.has("expires_at"));
  check("email_verification_tokens has created_at column", emailCols.has("created_at"));

  const resetTokenCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'password_reset_tokens'`,
  );
  const resetCols = new Set(resetTokenCols.rows.map((r: any) => r.column_name));
  check("password_reset_tokens has id column", resetCols.has("id"));
  check("password_reset_tokens has user_id column", resetCols.has("user_id"));
  check("password_reset_tokens has token_hash column", resetCols.has("token_hash"));
  check("password_reset_tokens has expires_at column", resetCols.has("expires_at"));
  check("password_reset_tokens has created_at column", resetCols.has("created_at"));

  const policyAcceptanceCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'policy_acceptances'`,
  );
  const policyCols = new Set(policyAcceptanceCols.rows.map((r: any) => r.column_name));
  check("policy_acceptances has id column", policyCols.has("id"));
  check("policy_acceptances has user_id column", policyCols.has("user_id"));
  check("policy_acceptances has policy_type column", policyCols.has("policy_type"));
  check("policy_acceptances has policy_version column", policyCols.has("policy_version"));
  check("policy_acceptances has source column", policyCols.has("source"));
  check("policy_acceptances has ip_address column", policyCols.has("ip_address"));
  check("policy_acceptances has user_agent column", policyCols.has("user_agent"));
  check("policy_acceptances has accepted_at column", policyCols.has("accepted_at"));

  const lockoutCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'admin_lockout_attempts'`,
  );
  const lockoutColSet = new Set(lockoutCols.rows.map((r: any) => r.column_name));
  check("admin_lockout_attempts has id column", lockoutColSet.has("id"));
  check("admin_lockout_attempts has ip_address column", lockoutColSet.has("ip_address"));
  check("admin_lockout_attempts has attempt_count column", lockoutColSet.has("attempt_count"));
  check("admin_lockout_attempts has locked_until column", lockoutColSet.has("locked_until"));
  check("admin_lockout_attempts has last_attempt_at column", lockoutColSet.has("last_attempt_at"));

  const auditLogCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'admin_audit_logs'`,
  );
  const auditColSet = new Set(auditLogCols.rows.map((r: any) => r.column_name));
  check("admin_audit_logs has id column", auditColSet.has("id"));
  check("admin_audit_logs has admin_user_id column", auditColSet.has("admin_user_id"));
  check("admin_audit_logs has action column", auditColSet.has("action"));
  check("admin_audit_logs has target_type column", auditColSet.has("target_type"));
  check("admin_audit_logs has amount column", auditColSet.has("amount"));
  check("admin_audit_logs has currency column", auditColSet.has("currency"));
  check("admin_audit_logs has reason column", auditColSet.has("reason"));
  check("admin_audit_logs has idempotency_key column", auditColSet.has("idempotency_key"));
  check("admin_audit_logs has details column (jsonb)", auditColSet.has("details"));

  const triviaCols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'trivia_questions'`,
  );
  const triviaColSet = new Set(triviaCols.rows.map((r: any) => r.column_name));
  check("trivia_questions has id column (bigserial)", triviaColSet.has("id"));
  check("trivia_questions has category column", triviaColSet.has("category"));
  check("trivia_questions has question column", triviaColSet.has("question"));
  check("trivia_questions has correct_answer column", triviaColSet.has("correct_answer"));
  check("trivia_questions has incorrect_answers column (jsonb)", triviaColSet.has("incorrect_answers"));

  // 3. Verify Foreign Keys
  const fkRes = await pool.query(`
    SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS foreign_table_name
    FROM pg_constraint
    WHERE contype = 'f'
  `);
  const fks = new Set(fkRes.rows.map((r: any) => `${r.table_name}->${r.foreign_table_name}`));
  check("email_verification_tokens FK to users", fks.has("email_verification_tokens->users"));
  check("password_reset_tokens FK to users", fks.has("password_reset_tokens->users"));
  check("policy_acceptances FK to users", fks.has("policy_acceptances->users"));
  check("admin_audit_logs FK to users", fks.has("admin_audit_logs->users"));
  check("ledger_entries FK to users", fks.has("ledger_entries->users"));
  check("friendships FK to users", fks.has("friendships->users"));
  check("match_settlements FK to matches_history", fks.has("match_settlements->matches_history"));

  // 4. Verify Constraint Validation Status (All CHECK and FK constraints MUST be convalidated = true)
  const validationRes = await pool.query(`
    SELECT conname, conrelid::regclass AS table_name, contype, convalidated
    FROM pg_constraint
    WHERE conrelid::regclass::text IN ('matches_history', 'match_settlements', 'ledger_entries')
      AND contype IN ('c', 'f')
  `);
  for (const row of validationRes.rows) {
    check(
      `Constraint '${row.conname}' on '${row.table_name}' is fully validated (convalidated=true)`,
      row.convalidated === true,
      `Expected convalidated=true, found ${row.convalidated}`,
    );
  }

  // 5. Verify Indexes
  const idxRes = await pool.query(`
    SELECT indexname, tablename
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  const indexes = new Set(idxRes.rows.map((r: any) => `${r.tablename}.${r.indexname}`));
  check("Index 'idx_trivia_cat_id' exists on trivia_questions", indexes.has("trivia_questions.idx_trivia_cat_id"));
  check("Index 'idx_policy_acceptances_user_type' exists on policy_acceptances", indexes.has("policy_acceptances.idx_policy_acceptances_user_type"));
  check("Index 'idx_policy_acceptances_type_version' exists on policy_acceptances", indexes.has("policy_acceptances.idx_policy_acceptances_type_version"));
  check("Unique index 'ledger_user_reason_unique' exists on ledger_entries", indexes.has("ledger_entries.ledger_user_reason_unique"));
  check("Index 'ledger_user_currency_idx' exists on ledger_entries", indexes.has("ledger_entries.ledger_user_currency_idx"));
  check("Unique index 'friendships_pair_unique' exists on friendships", indexes.has("friendships.friendships_pair_unique"));
  check("Index 'idx_matches_p1' exists on matches_history", indexes.has("matches_history.idx_matches_p1"));
  check("Index 'idx_matches_status' exists on matches_history", indexes.has("matches_history.idx_matches_status"));

  // 6. Verify Trigger & Function
  const triggerRes = await pool.query(`
    SELECT tgname, relname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE tgname = 'ledger_non_negative_guard'
  `);
  check("Trigger 'ledger_non_negative_guard' is attached to ledger_entries", triggerRes.rows.length > 0);

  const procRes = await pool.query(`
    SELECT proname FROM pg_proc WHERE proname = 'enforce_non_negative_ledger_balance'
  `);
  check("Trigger function 'enforce_non_negative_ledger_balance' exists", procRes.rows.length > 0);

  // 7. Verify Platform Rake Account
  const rakeRes = await pool.query(`
    SELECT id, username FROM users WHERE id = 'platform_rake_account'
  `);
  check("Platform rake account exists in users table", rakeRes.rows.length > 0);

  // 8. Runtime DML Smoke Test against all newly migrated tables
  const testUserId = "test_migrated_user_" + Date.now();
  await pool.query(
    `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [testUserId, "test_migrated_" + Date.now(), "hash"],
  );

  const tokenInsert = await pool.query(
    `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + interval '1 day') RETURNING id`,
    ["evt_test_" + Date.now(), testUserId, "token_hash_" + Date.now()],
  );
  check("DML smoke: INSERT into email_verification_tokens succeeds", tokenInsert.rows.length === 1);

  const resetInsert = await pool.query(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + interval '1 hour') RETURNING id`,
    ["prt_test_" + Date.now(), testUserId, "reset_hash_" + Date.now()],
  );
  check("DML smoke: INSERT into password_reset_tokens succeeds", resetInsert.rows.length === 1);

  const policyInsert = await pool.query(
    `INSERT INTO policy_acceptances (id, user_id, policy_type, policy_version, source, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    ["pa_test_" + Date.now(), testUserId, "TERMS", "2026-08-18", "registration", "127.0.0.1", "Mozilla/5.0"],
  );
  check("DML smoke: INSERT into policy_acceptances succeeds", policyInsert.rows.length === 1);

  const lockoutInsert = await pool.query(
    `INSERT INTO admin_lockout_attempts (id, ip_address, attempt_count)
     VALUES ($1, $2, $3) RETURNING id`,
    ["lock_test_" + Date.now(), "127.0.0.1" + Math.random(), 1],
  );
  check("DML smoke: INSERT into admin_lockout_attempts succeeds", lockoutInsert.rows.length === 1);

  const auditInsert = await pool.query(
    `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, amount, currency, reason, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      "audit_test_" + Date.now(),
      testUserId,
      "wallet_grant",
      "user",
      testUserId,
      100,
      "COINS",
      "test grant",
      "idem_test_" + Date.now(),
    ],
  );
  check("DML smoke: INSERT into admin_audit_logs succeeds", auditInsert.rows.length === 1);

  const triviaInsert = await pool.query(
    `INSERT INTO trivia_questions (category, difficulty, question, correct_answer, incorrect_answers)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    ["General", "easy", "What is 2+2?", "4", JSON.stringify(["1", "2", "3"])],
  );
  check("DML smoke: INSERT into trivia_questions succeeds", triviaInsert.rows.length === 1);

  // Clean up smoke rows
  await pool.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM policy_acceptances WHERE user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM admin_audit_logs WHERE admin_user_id = $1`, [testUserId]);
  await pool.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL!;
  // Scoped SSL config for cloud PostgreSQL connections (Supabase/Neon)
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

  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await applyMigrations(pool);
    await verifySchema(pool);

    console.log(`\n==================================================`);
    console.log(`Migration Parity Check: ${passes} PASS, ${failures} FAIL`);
    console.log(`==================================================\n`);

    if (failures > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal error during migration parity check:", err);
  process.exit(1);
});
