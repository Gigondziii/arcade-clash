import dotenv from "dotenv";
import { assertDisposableTestDatabase } from "./test-database-safety.ts";

dotenv.config({ path: "packages/server/.env" });

const destination = assertDisposableTestDatabase(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
);

// Database modules read DATABASE_URL during import evaluation. Replace it
// only after the centralized guard has proved the destination is isolated.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
console.log(
  `[test-db-safety] Approved disposable destination: host=${destination.hostname} ` +
    `port=${destination.port} database=${destination.databaseName}`,
);
