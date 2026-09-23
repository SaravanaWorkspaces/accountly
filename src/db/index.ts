// Not marked `server-only`: the migrate and seed CLIs import this module too.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export { MIGRATIONS_DIR } from "../lib/paths";

/**
 * Vercel's Postgres integrations export `POSTGRES_URL`; everything else tends to
 * call it `DATABASE_URL`. Accept either so the app runs unchanged on Vercel, on
 * Neon, on Supabase and against a local cluster.
 */
export function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL (or POSTGRES_URL) is not set — Accountly needs a Postgres connection string.",
    );
  }
  // Accountly used to keep a SQLite file here. Say so plainly rather than let
  // `pg` fail with something unrecognisable about an invalid port.
  if (!/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      `DATABASE_URL looks like a file path ("${url}"), not a Postgres connection ` +
        "string. Accountly moved from SQLite to Postgres; set it to postgres://…",
    );
  }
  return url;
}

/** Managed Postgres nearly always terminates TLS with its own certificate. */
function sslFor(url: string) {
  if (/[?&]sslmode=disable\b/.test(url)) return false;
  return url.includes("localhost") || url.includes("127.0.0.1")
    ? false
    : { rejectUnauthorized: false };
}

function createPool(): Pool {
  const url = connectionString();

  const created = new Pool({
    connectionString: url,
    ssl: sslFor(url),
    // A serverless instance handles one request at a time, so it has no use for
    // a wide local pool — and hundreds of instances each holding several
    // connections is how a Postgres runs out of them. Point this at a pooled
    // endpoint (Neon's `-pooler` host) in production.
    max: Number(process.env.PGPOOL_MAX ?? (process.env.VERCEL ? 1 : 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  // An idle client dropped by the provider must not take the process down.
  created.on("error", (error) => {
    console.error("Postgres pool error:", error.message);
  });

  return created;
}

// Next.js re-evaluates modules on every hot reload in dev; without this the
// process would leak a pool per edit.
const globalForDb = globalThis as unknown as {
  __accountlyPool?: Pool;
  __accountlyDb?: NodePgDatabase<typeof schema>;
};

/**
 * Everything below is built on first use, never on import.
 *
 * `next build` collects page data by importing each route module, and a cold
 * start imports them again before any request arrives. A module that reads
 * configuration — or opens a socket — while it is being evaluated turns a
 * missing or wrong environment variable into a failed build rather than a
 * failed request. Importing this module does nothing; the first query is what
 * needs a database.
 */
let poolRef: Pool | undefined;
let dbRef: NodePgDatabase<typeof schema> | undefined;

export function getPool(): Pool {
  // Module scope holds it in every environment — a pool per call would open a
  // new set of connections on every query. The global is only a dev extra, so
  // a hot reload reuses the pool instead of leaking one per edit.
  poolRef ??= globalForDb.__accountlyPool ?? createPool();
  if (process.env.NODE_ENV !== "production") globalForDb.__accountlyPool = poolRef;
  return poolRef;
}

function getDb(): NodePgDatabase<typeof schema> {
  dbRef ??= globalForDb.__accountlyDb ?? drizzle(getPool(), { schema });
  if (process.env.NODE_ENV !== "production") globalForDb.__accountlyDb = dbRef;
  return dbRef;
}

/**
 * Migrations are NOT run from here either. On a serverless host this module is
 * evaluated on every cold start, so migrating on import would race several
 * instances against each other in the middle of serving requests. Run
 * `npm run db:migrate` as a deploy step.
 */
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, property) {
    const real = getDb();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** For the CLIs, which should exit rather than hold the process open. */
export async function closeDb(): Promise<void> {
  if (poolRef) await poolRef.end();
  poolRef = undefined;
  dbRef = undefined;
  globalForDb.__accountlyPool = undefined;
  globalForDb.__accountlyDb = undefined;
}

export { schema };
