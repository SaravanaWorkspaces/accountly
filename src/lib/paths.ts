import path from "node:path";

/**
 * Filesystem locations, kept out of `storage.ts` so the CLI scripts can import
 * them without pulling in that module's `server-only` guard. The database is
 * not here any more — it is a Postgres connection string, not a path.
 *
 * The ignore comments stop the bundler tracing the whole project into the
 * server output just because these paths are computed at runtime.
 */

export const UPLOAD_DIR = path.resolve(
  /* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "./data/uploads",
);

export const MIGRATIONS_DIR = path.resolve(/* turbopackIgnore: true */ "./drizzle");
