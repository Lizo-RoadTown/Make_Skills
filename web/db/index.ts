import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __drizzle_pool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __drizzle_db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

/**
 * Lazy pool + drizzle client.
 *
 * Defer construction (and the DATABASE_URL check) until first query so
 * Next.js's build-time "collect page data" pass can import this module
 * without env vars present. The runtime error remains clear if the var
 * is missing at request time.
 */
function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (global.__drizzle_db) return global.__drizzle_db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Required for Auth.js (invite lookups + adapter writes).",
    );
  }
  const pool = global.__drizzle_pool ?? new Pool({ connectionString, max: 10 });
  if (process.env.NODE_ENV !== "production") {
    global.__drizzle_pool = pool;
  }
  const client = drizzle(pool, { schema });
  if (process.env.NODE_ENV !== "production") {
    global.__drizzle_db = client;
  }
  return client;
}

/**
 * `db` is a Proxy that lazily resolves to the real Drizzle client on
 * first property access. Lets call sites keep `db.select(...)` while
 * deferring DB connection until runtime.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const real = getDb();
    const value = (real as unknown as Record<string | symbol, unknown>)[
      prop as string | symbol
    ];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
