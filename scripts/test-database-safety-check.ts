import { assertDisposableTestDatabase } from "./test-database-safety.ts";

let passed = 0;
let failed = 0;

function expectRejected(label: string, testUrl: string | undefined, appUrl: string | undefined): void {
  try {
    assertDisposableTestDatabase(testUrl, appUrl);
    failed++;
    console.error(`FAIL ${label}: unexpectedly accepted`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Refusing PostgreSQL integration test") && !message.includes("secret")) {
      passed++;
      console.log(`PASS ${label}`);
    } else {
      failed++;
      console.error(`FAIL ${label}: unsafe error shape`);
    }
  }
}

function expectAccepted(label: string, testUrl: string, appUrl: string): void {
  try {
    const result = assertDisposableTestDatabase(testUrl, appUrl);
    if (result.databaseName.endsWith("_test")) {
      passed++;
      console.log(`PASS ${label}`);
    } else {
      failed++;
      console.error(`FAIL ${label}: normalized name was not test-only`);
    }
  } catch (error) {
    failed++;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const production = "postgresql://prod_user:prod_password@db.example.com/fugluck";

expectRejected("missing TEST_DATABASE_URL", undefined, production);
expectRejected("missing DATABASE_URL", "postgresql://localhost/fugluck_atomic_test", undefined);
expectRejected("malformed test URL", "not a URL", production);
expectRejected("non-PostgreSQL protocol", "https://db.example.com/fugluck_atomic_test", production);
expectRejected("exact production URL", production, production);
expectRejected(
  "same destination with different credentials",
  "postgresql://other:credentials@db.example.com/fugluck",
  production,
);
expectRejected(
  "same destination with query parameters",
  "postgresql://other@db.example.com/fugluck?sslmode=require",
  "postgresql://prod@db.example.com/fugluck",
);
expectRejected(
  "same destination with query parameters in different order",
  "postgresql://other@db.example.com/fugluck?application_name=test&sslmode=require",
  "postgresql://prod@db.example.com/fugluck?sslmode=disable&application_name=prod",
);
expectRejected(
  "explicit default port equals implicit default port",
  "postgresql://other@db.example.com:5432/fugluck",
  "postgresql://prod@db.example.com/fugluck",
);
expectRejected(
  "host casing differences are equivalent",
  "postgresql://other@DB.EXAMPLE.COM/fugluck",
  production,
);
expectRejected(
  "encoded database name is equivalent",
  "postgresql://other@db.example.com/fug%6cuck",
  production,
);
expectRejected("normal-looking fugluck database name", "postgresql://test-host/fugluck", production);
expectRejected("postgres database name", "postgresql://test-host/postgres", production);
expectRejected("generic test database name", "postgresql://test-host/integration_test", production);

expectAccepted(
  "isolated fugluck_atomic_test database",
  "postgresql://test_user:test_password@test-db.example.com/fugluck_atomic_test?sslmode=require",
  production,
);
expectAccepted(
  "isolated legacy arcadeclash_atomic_test database",
  "postgresql://test_user:test_password@test-db.example.com/arcadeclash_atomic_test?sslmode=require",
  production,
);
expectAccepted(
  "same host with different approved database is isolated structurally",
  "postgresql://test_user@db.example.com:5432/fugluck_test",
  production,
);
expectAccepted(
  "encoded approved test database name",
  "postgresql://test_user@test-db.example.com/fugluck_atomic_%74est",
  production,
);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
