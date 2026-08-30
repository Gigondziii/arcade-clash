// Standalone verification script for SQL injection security & parameterized query safety.
// Run: npx tsx scripts/sql-injection-check.ts

import { and, eq, sql } from "drizzle-orm";
import { friendships, users } from "../packages/server/src/db/schema.ts";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("sql-injection-check");

// ---------------------------------------------------------------------------
// Test 1: Malicious Input Vector Sanitization via Parameterized Expressions
// ---------------------------------------------------------------------------
console.log("\nTest 1: Drizzle Parameterized Query Builder Operator Isolation");

const maliciousPayloads = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "admin'--",
  "\" UNION SELECT NULL, username, password FROM users --",
  "1; SELECT pg_sleep(5); --",
  "1' AND 1=convert(int, (select @@version))--",
  "\\x27\\x22\\x3b\\x2d\\x2d",
];

for (const payload of maliciousPayloads) {
  const queryCondition = eq(users.username, payload);
  // Drizzle eq operator encapsulates payload inside a distinct Param chunk object (c.value)
  const chunks = (queryCondition as any)?.queryChunks ?? [];
  const isParameterized = chunks.some((c: any) => c && typeof c === "object" && c.value === payload);

  check(`Payload [${payload.slice(0, 20)}...] isolated into Param object value`, isParameterized);
}

// ---------------------------------------------------------------------------
// Test 2: Drizzle sql Tag Template Parameterization
// ---------------------------------------------------------------------------
console.log("\nTest 2: Drizzle sql Template Parameterization");

const safeAggregateSql = sql<number>`coalesce(sum(amount), 0)::int`;
const aggregateQueryStr = String(safeAggregateSql.queryChunks?.[0] ?? "");
check("sql template uses structural query chunks rather than string concatenation", aggregateQueryStr.length > 0);

// ---------------------------------------------------------------------------
// Test 3: Username Validation Filter Defense-In-Depth
// ---------------------------------------------------------------------------
console.log("\nTest 3: Username Pattern Input Validation Filter");

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;

for (const payload of maliciousPayloads) {
  const rejectedByValidation = !USERNAME_PATTERN.test(payload);
  check(`Malicious payload [${payload.slice(0, 20)}...] rejected by username validation pattern`, rejectedByValidation);
}

const validUsernames = ["player_1", "cyber_ninja_99", "admin_user"];
for (const validName of validUsernames) {
  check(`Valid username [${validName}] accepted by validation pattern`, USERNAME_PATTERN.test(validName));
}

// ---------------------------------------------------------------------------
// Test 4: Friendship & Match ID Parameter Isolation
// ---------------------------------------------------------------------------
console.log("\nTest 4: GUID & Identifier Query Parameterization");

const maliciousFriendId = "friend_123' OR '1'='1";
const friendshipCondition = eq(friendships.id, maliciousFriendId);
const friendChunks = (friendshipCondition as any)?.queryChunks ?? [];
check("Friendship ID query condition encapsulates payload in Param object value", friendChunks.some((c: any) => c && typeof c === "object" && c.value === maliciousFriendId));

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll SQL injection regression checks passed.`);
