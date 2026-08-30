// Comprehensive CORS Audit Verification Script for Fugluck.
// Run: npx tsx scripts/cors-audit-check.ts

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

console.log("cors-audit-check");

async function main() {
  const { getAllowedOrigins, isOriginAllowed, corsOptions, socketIoCorsOptions } = await import(
    "../packages/server/src/config/cors.ts"
  );

  // ---------------------------------------------------------------------------
  // Test 1: Development Environment Approved Origins Allowlist
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Development Environment Approved Origins Allowlist");
  const devOrigins = getAllowedOrigins();

  check("Development allowlist contains http://localhost:5173", devOrigins.includes("http://localhost:5173"));
  check("Development allowlist contains http://127.0.0.1:5173", devOrigins.includes("http://127.0.0.1:5173"));
  check("Development allowlist contains http://localhost:3000", devOrigins.includes("http://localhost:3000"));

  check("Approved origin http://localhost:5173 passes isOriginAllowed", isOriginAllowed("http://localhost:5173"));
  check("Approved origin http://127.0.0.1:5173 passes isOriginAllowed", isOriginAllowed("http://127.0.0.1:5173"));
  check("Non-browser / same-origin request (undefined origin) allowed", isOriginAllowed(undefined));

  // ---------------------------------------------------------------------------
  // Test 2: Unapproved Origin Rejection
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Unapproved Origin Rejection");

  check("Unapproved origin http://evil-attacker.com rejected", !isOriginAllowed("http://evil-attacker.com"));
  check("Unapproved origin http://malicious-phishing.net rejected", !isOriginAllowed("http://malicious-phishing.net"));
  check("Unapproved origin http://localhost:8080 rejected", !isOriginAllowed("http://localhost:8080"));
  check("Wildcard * is NOT in allowed origins", !devOrigins.includes("*"));

  // ---------------------------------------------------------------------------
  // Test 3: Credentials, Methods, and Headers Configuration
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Credentials, Methods, and Headers Configuration");

  check("Express CORS credentials set to true (supports ac_session cookie)", corsOptions.credentials === true);
  check("Preflight cache maxAge set to 86400s (24 hours)", corsOptions.maxAge === 86400);

  const methods = corsOptions.methods as string[];
  check("Required HTTP methods allowed", ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].every((m) => methods.includes(m)));

  const headers = corsOptions.allowedHeaders as string[];
  check("Required request headers allowed", ["Content-Type", "Authorization", "X-Idempotency-Key", "Accept", "Origin"].every((h) => headers.includes(h)));

  // ---------------------------------------------------------------------------
  // Test 4: Socket.IO Policy Alignment
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Socket.IO Policy Alignment");

  check("Socket.IO CORS credentials set to true", socketIoCorsOptions.credentials === true);
  check("Socket.IO CORS methods include GET and POST", socketIoCorsOptions.methods.includes("GET") && socketIoCorsOptions.methods.includes("POST"));

  let socketOriginApproved = false;
  socketIoCorsOptions.origin("http://localhost:5173", (_err, allow) => {
    socketOriginApproved = allow === true;
  });
  check("Socket.IO CORS accepts approved origin", socketOriginApproved);

  let socketOriginRejected = false;
  socketIoCorsOptions.origin("http://evil-attacker.com", (err) => {
    socketOriginRejected = err !== null;
  });
  check("Socket.IO CORS rejects unapproved origin", socketOriginRejected);

  // ---------------------------------------------------------------------------
  // Test 5: Production Environment Isolation Simulation
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Production Environment Isolation Simulation");

  process.env.NODE_ENV = "production";
  process.env.ALLOWED_ORIGINS = "https://fugluck.com, https://play.fugluck.com";

  const prodOrigins = getAllowedOrigins();
  check("Production mode enforces explicit ALLOWED_ORIGINS env var", prodOrigins.includes("https://fugluck.com") && prodOrigins.includes("https://play.fugluck.com"));
  check("Production mode excludes localhost by default when env var specified", !prodOrigins.includes("http://localhost:5173"));

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll CORS audit regression checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
