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
 */
const connectionString =
  process.env.DATABASE_URL || "postgres://placeholder@localhost:5432/placeholder";

if (!process.env.DATABASE_URL && process.env.NEXT_RUNTIME) {
  console.error(
    "[db] DATABASE_URL is not set in this runtime. Auth.js adapter writes" +
      " will fail. Set DATABASE_URL in Vercel project Environment" +
      " Variables (Preview AND Production scopes) to the EXTERNAL" +
      " Render Postgres connection string.",
  );
}

/**
 * SSL handling for Render Postgres.
 *
 * Render Postgres requires TLS for external connections. node-postgres
 * does NOT auto-enable SSL based on hostname — you have to configure
 * it. `rejectUnauthorized: false` accepts Render's certificate chain
 * without strict CA validation; the connection is still encrypted, just
 * not pinned to a specific public CA. This is the standard pattern for
 * Render / Heroku / managed Postgres providers.
 *
 * For local Docker (no SSL), the URL doesn't include the render.com
 * hostname, so we skip SSL entirely.
 */
const isRenderHost = /\.render\.com/.test(connectionString);

const pool =
  global.__drizzle_pool ??
  new Pool({
    connectionString,
    max: 10,
    ssl: isRenderHost ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  global.__drizzle_pool = pool;
}

// Verbose error reporting so the AdapterError in logs has detail.
// The Pool's "error" event fires for connection-level failures
// (auth, SSL handshake, network) that don't surface via query throws.
pool.on("error", (err: Error & { code?: string; detail?: string }) => {
  console.error("[db] pool error", {
    message: err.message,
    code: err.code,
    detail: err.detail,
    stack: err.stack,
  });
});

export const db = drizzle(pool, { schema });
export { schema };
