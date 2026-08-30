export type PostgreSqlDestination = {
  hostname: string;
  port: string;
  databaseName: string;
};

const DEFAULT_POSTGRESQL_PORT = "5432";
const TEST_DATABASE_NAME_PATTERN = /^(?:arcadeclash|fugluck)(?:_[a-z0-9]+)*_test$/;

function refusal(reason: string): Error {
  return new Error(
    `Refusing PostgreSQL integration test: ${reason} ` +
      "A dedicated, disposable PostgreSQL database with a clearly test-only Fugluck name is required. " +
      "The normal Fugluck database must not be used.",
  );
}

export function normalizePostgreSqlDestination(value: string | undefined, variableName: string): PostgreSqlDestination {
  if (!value) throw refusal(`${variableName} is missing.`);

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw refusal(`${variableName} is not a valid PostgreSQL URL.`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw refusal(`${variableName} must use the postgres or postgresql protocol.`);
  }
  if (!parsed.hostname) throw refusal(`${variableName} has no hostname.`);

  let databaseName: string;
  try {
    const encodedName = parsed.pathname.replace(/^\/+/, "");
    if (!encodedName || encodedName.includes("/")) {
      throw refusal(`${variableName} must identify exactly one database name.`);
    }
    databaseName = decodeURIComponent(encodedName).toLowerCase();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing PostgreSQL integration test:")) throw error;
    throw refusal(`${variableName} contains an invalid encoded database name.`);
  }

  return {
    hostname: parsed.hostname.toLowerCase().replace(/\.$/, ""),
    port: parsed.port || DEFAULT_POSTGRESQL_PORT,
    databaseName,
  };
}

export function assertDisposableTestDatabase(
  testDatabaseUrl: string | undefined,
  applicationDatabaseUrl: string | undefined,
): PostgreSqlDestination {
  const test = normalizePostgreSqlDestination(testDatabaseUrl, "TEST_DATABASE_URL");
  const application = normalizePostgreSqlDestination(applicationDatabaseUrl, "DATABASE_URL");

  if (
    test.hostname === application.hostname &&
    test.port === application.port &&
    test.databaseName === application.databaseName
  ) {
    throw refusal(
      `TEST_DATABASE_URL resolves to the same destination as DATABASE_URL ` +
        `(host=${test.hostname}, port=${test.port}, database=${test.databaseName}).`,
    );
  }

  // Conservative repository policy: the decoded, case-normalized database
  // name must start with "arcadeclash" and end with a distinct "_test"
  // segment. Examples: arcadeclash_test, arcadeclash_atomic_test.
  if (!TEST_DATABASE_NAME_PATTERN.test(test.databaseName)) {
    throw refusal(
      `database name "${test.databaseName}" is not clearly test-only; expected ` +
        `"fugluck_test", "fugluck_<purpose>_test", or legacy "arcadeclash_<purpose>_test".`,
    );
  }

  return test;
}
