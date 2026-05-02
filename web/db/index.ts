import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __drizzle_pool: Pool | undefined;
}

/**
 * Build-time vs runtime DATABASE_URL handling.
 *
 * Vercel's "Collect page data" pass imports every route module to
 * inspect metadata. AUTH.js's DrizzleAdapter does an `instanceof
 * PgDatabase` check at construction (in auth.ts), so `db` must be a
 * real Drizzle client at module-import time, NOT a Proxy.
 *
 * We construct the Pool eagerly. If DATABASE_URL is missing (build
 * phase), we fall back to a placeholder so the Pool object exists and
 * passes the adapter's type check. The Pool only opens a real
 * connection at first query — and at runtime, DATABASE_URL will be
 * present (Vercel env vars are injected at request time).
 *
 * Runtime callers will see a clear connection-refused error if
 * DATABASE_URL is genuinely missing in production. Better than a
 * cryptic "object is not a PgDatabase" build failure.
 */
const connectionString =
  process.env.DATABASE_URL || "postgres://placeholder@localhost:5432/placeholder";

// Loud, useful runtime warning when the placeholder is in use.
// Build phase tolerates the placeholder; runtime should never see it.
if (!process.env.DATABASE_URL && process.env.NEXT_RUNTIME) {
  console.error(
    "[db] DATABASE_URL is not set in this runtime. Auth.js adapter writes" +
      " will fail with ECONNREFUSED. Set DATABASE_URL in Vercel project" +
      " Environment Variables (Preview AND Production scopes) to the" +
      " EXTERNAL Render Postgres connection string.",
  );
}

const pool =
  global.__drizzle_pool ?? new Pool({ connectionString, max: 10 });

if (process.env.NODE_ENV !== "production") {
  global.__drizzle_pool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
