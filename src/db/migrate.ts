/** Standalone migration runner: `npm run db:migrate`. Run it as a deploy step. */
import "dotenv/config";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db, pool, connectionString, MIGRATIONS_DIR } from "./index";

async function main() {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  // Hide the password before this ends up in a deploy log.
  console.log(`Migrations applied to ${redacted()}`);
  await pool.end();
}

function redacted(): string {
  return connectionString().replace(/\/\/([^:]+):[^@]+@/, "//$1:***@");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
