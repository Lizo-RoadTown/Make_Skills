/**
 * Drizzle schema mirroring the canonical SQL in
 * `platform/api/migrations.py`. The Python migration is the source of
 * truth — Drizzle is a query layer, not a migration tool, in this project.
 *
 * If you change a column here, change it there too (and run the api so
 * the migration applies). Drizzle's column names use the SQL column
 * names verbatim — Auth.js's adapter expects camelCase columns like
 * `"userId"`, `"providerAccountId"`, `"emailVerified"`, `"sessionToken"`,
 * which Postgres treats as case-sensitive when quoted.
 */
import { sql } from "drizzle-orm";
import {
  customType,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// pgcrypto-encrypted column for student_secrets.encrypted_value. The
// web side never reads/writes this column directly — encrypt + decrypt
// happens via pgp_sym_encrypt/pgp_sym_decrypt on the FastAPI side.
// Declared here so the schema mirror stays complete.
const bytea = customType<{ data: Buffer; notNull: false }>({
  dataType() {
    return "bytea";
  },
});

// ---- Pillar 0 base tables ----

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// ---- Auth.js core tables (column casing matches the Drizzle adapter spec) ----

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { withTimezone: true }),
  image: text("image"),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => ({
    pk: primaryKey({ columns: [a.provider, a.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// ---- Our domain: invite-only signup ----

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Default in SQL is encode(gen_random_bytes(24), 'hex') — see migrations.py.
    // Telling Drizzle the column has a SQL-side default so TS doesn't require it on insert.
    token: text("token")
      .notNull()
      .unique()
      .default(sql`encode(gen_random_bytes(24), 'hex')`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByEmail: text("consumed_by_email"),
  },
  (i) => ({
    emailUnconsumedIdx: uniqueIndex("invitations_email_unconsumed").on(i.email),
    // Note: the partial WHERE consumed_at IS NULL is in the SQL migration;
    // Drizzle's pgTable doesn't have a direct way to express partial
    // unique indexes without raw SQL. The DB enforces correctness.
  }),
);

export const tenantUsers = pgTable("tenant_users", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Pillar 1B: BYO API keys ----

export const studentSecrets = pgTable(
  "student_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    providerSlug: text("provider_slug").notNull(),
    encryptedValue: bytea("encrypted_value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantProviderIdx: uniqueIndex("student_secrets_tenant_provider").on(
      t.tenantId,
      t.providerSlug,
    ),
  }),
);
