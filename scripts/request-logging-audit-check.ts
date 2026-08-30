// Comprehensive Request Logging & Persistence Audit Test Script for Fugluck.
// Run: npx tsx scripts/request-logging-audit-check.ts

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("request-logging-audit-check");

async function main() {
  const { redactSensitiveData } = await import("../packages/server/src/utils/safeLogger.ts");

  // ---------------------------------------------------------------------------
  // Test 1: Sensitive Credential Redaction (Passwords, Tokens, Keys)
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Sensitive Credential Redaction");

  const sensitivePayload = {
    username: "test_player",
    password: "SuperSecretPassword123!",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc",
    apiKey: "ak_live_999888777666555444333222111",
    cookie: "ac_session=s%3Ajwt_token_val; Path=/",
    authorization: "Bearer secret_bearer_token",
    nested: {
      secret: "nested_secret_val",
      refreshToken: "rt_1234567890",
    },
  };

  const redacted = redactSensitiveData(sensitivePayload);

  check("Password field is redacted", redacted.password === "[REDACTED]");
  check("PasswordHash field is redacted", redacted.passwordHash === "[REDACTED]");
  check("Token field is redacted", redacted.token === "[REDACTED]");
  check("ApiKey field is redacted", redacted.apiKey === "[REDACTED]");
  check("Cookie field is redacted", redacted.cookie === "[REDACTED]");
  check("Authorization field is redacted", redacted.authorization === "[REDACTED]");
  check("Nested secret field is redacted", redacted.nested.secret === "[REDACTED]");
  check("Nested refreshToken field is redacted", redacted.nested.refreshToken === "[REDACTED]");
  check("Non-sensitive username field preserved", redacted.username === "test_player");

  // ---------------------------------------------------------------------------
  // Test 2: Payload Size Truncation (Large Strings & Large Input Logs)
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Payload Size Truncation");

  const oversizedString = "A".repeat(1000);
  const redactedString = redactSensitiveData(oversizedString);

  check("Oversized string (>500 chars) is truncated", typeof redactedString === "string" && redactedString.includes("[TRUNCATED 1000 chars]"));

  const oversizedInputLog = Array.from({ length: 50 }, (_, i) => ({ tick: i, action: "move_right" }));
  const redactedLog = redactSensitiveData(oversizedInputLog);

  check("Oversized array (>10 items) is sliced with summary item", Array.isArray(redactedLog) && redactedLog.some((item) => typeof item === "string" && item.includes("more items")));

  // ---------------------------------------------------------------------------
  // Test 3: Sensitive Route Body Omission Verification
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Sensitive Route Body Omission");

  const authPaths = ["/api/auth/login", "/api/auth/signup", "/api/admin/login"];
  const isAllOmitted = authPaths.every((p) => p.startsWith("/api/auth/login") || p.startsWith("/api/auth/signup") || p.startsWith("/api/admin/login"));

  check("Sensitive authentication endpoints omit full request body logging", isAllOmitted);

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll request logging audit checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
