// Not marked `server-only`: the migrate and seed CLIs import this module too.
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { DB_PATH, MIGRATIONS_DIR } from "../lib/paths";
import * as schema from "./schema";

export { DB_PATH } from "../lib/paths";

function createConnection() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const sqlite = new Database(DB_PATH);
  // WAL keeps reads non-blocking while a write is in flight; the busy timeout
  // covers the brief moments a writer does hold the lock.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  // Migrating on connect keeps single-file SQLite deploys to one step: ship the
  // binary, start the server. It is a no-op once the journal is up to date.
  if (fs.existsSync(MIGRATIONS_DIR)) {
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  }

  return db;
}

// Next.js re-evaluates modules on every hot reload in dev; without this the
// process would leak a file handle per edit.
const globalForDb = globalThis as unknown as {
  __accountlyDb?: ReturnType<typeof createConnection>;
};

export const db = globalForDb.__accountlyDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__accountlyDb = db;
}

export { schema };
