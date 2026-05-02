import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Required for Auth.js (invite lookups + adapter writes).",
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __drizzle_pool: Pool | undefined;
}

const pool =
  global.__drizzle_pool ??
  new Pool({ connectionString, max: 10 });

if (process.env.NODE_ENV !== "production") {
  global.__drizzle_pool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
