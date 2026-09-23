/** Standalone migration runner: `npm run db:migrate`. */
import "dotenv/config";

import { db, DB_PATH } from "./index";

// Importing `db` runs the migrations. Touch it so the import is not elided.
void db;

console.log(`Migrations applied to ${DB_PATH}`);
