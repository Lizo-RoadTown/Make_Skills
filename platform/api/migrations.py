"""
Schema migrations for Pillar 0 — tenant abstraction.

Runs idempotently on startup. Self-host: every existing row is backfilled
to the default-tenant UUID. Hosted: same migration runs once at deploy.

Two stores to migrate:
  1. Postgres — tenants table, conversations sidecar (LangGraph thread_id ->
     tenant_id mapping with RLS), default-tenant row.
  2. LanceDB — add tenant_id + visibility columns to the records table,
     build BTREE scalar indexes (filter pushdown).

The Postgres migration also enables the pgcrypto extension (needed for
gen_random_uuid()), which is available on Render Postgres by default.

Designed to be safe to call on every container start. Each step checks
state before mutating.
"""
from __future__ import annotations

import logging
from typing import Any

from psycopg_pool import AsyncConnectionPool

log = logging.getLogger("migrations")

# Hardcoded UUID for the self-host single tenant. This value is the
# tenant_id every existing row is backfilled to and the default for
# DefaultTenantResolver. Do not change — would orphan all existing data.
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000"
DEFAULT_TENANT_NAME = "default"


async def migrate_postgres(pool: AsyncConnectionPool) -> None:
    """Run all Postgres migrations. Idempotent."""
    async with pool.connection() as conn:
        async with conn.transaction():
            # gen_random_uuid() requires pgcrypto. Enabling is a no-op if
            # the extension is already present.
            await conn.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

            # ---- 1. tenants ----
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS tenants (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name        TEXT NOT NULL,
                    status      TEXT NOT NULL DEFAULT 'active',
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    deleted_at  TIMESTAMPTZ
                )
            """)

            # Default-tenant row that self-host runs as. Existing data
            # gets backfilled against this.
            await conn.execute(
                """
                INSERT INTO tenants (id, name) VALUES (%s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (DEFAULT_TENANT_ID, DEFAULT_TENANT_NAME),
            )

            # ---- 2. conversations sidecar ----
            # Maps LangGraph thread_id -> tenant_id (and user_id when hosted).
            # The RLS policy on this table is the gate that kills the
            # leaked-thread-id replay attack. The wrapped PostgresSaver
            # uses the same RLS GUC, so all checkpoint reads are also
            # gated through this sidecar's enforcement.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    thread_id   TEXT PRIMARY KEY,
                    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    user_id     UUID,
                    title       TEXT,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS conversations_tenant_idx
                    ON conversations (tenant_id, created_at DESC)
            """)

            # Enable RLS. Idempotent — it's safe to enable on an already-enabled table.
            await conn.execute("ALTER TABLE conversations ENABLE ROW LEVEL SECURITY")
            # FORCE so the table owner ALSO respects the policy (the Render-side
            # api role typically owns its own schema). Superusers still bypass —
            # which is correct: migrations and incident response need that escape.
            await conn.execute("ALTER TABLE conversations FORCE ROW LEVEL SECURITY")
            # Drop and recreate the policy to keep the definition canonical
            # in this migration (Postgres has no CREATE OR REPLACE POLICY).
            await conn.execute("DROP POLICY IF EXISTS conv_rls ON conversations")
            await conn.execute("""
                CREATE POLICY conv_rls ON conversations
                    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
            """)

            log.info("postgres migration: tenants + conversations ready")


async def migrate_auth_tables(pool: AsyncConnectionPool) -> None:
    """Pillar 0 — Auth.js v5 + invite-only signup tables.

    Six tables:
      - users / accounts / sessions / verification_tokens (Auth.js Drizzle
        adapter expects these — column casing matches the adapter's spec)
      - invitations (our invite-only gate; signIn callback consumes atomically)
      - tenant_users (maps users.id -> tenant_id; populated on first sign-in)

    Single source of truth: this migration creates the tables, Drizzle on
    the Next.js side just describes them in TypeScript for query
    type-safety. No Drizzle migrations run.
    """
    async with pool.connection() as conn:
        async with conn.transaction():
            # Auth.js core: users
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name          TEXT,
                    email         TEXT NOT NULL UNIQUE,
                    "emailVerified" TIMESTAMPTZ,
                    image         TEXT
                )
            """)

            # Auth.js core: accounts (OAuth provider linkage)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS accounts (
                    "userId"            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    type                TEXT NOT NULL,
                    provider            TEXT NOT NULL,
                    "providerAccountId" TEXT NOT NULL,
                    refresh_token       TEXT,
                    access_token        TEXT,
                    expires_at          INTEGER,
                    token_type          TEXT,
                    scope               TEXT,
                    id_token            TEXT,
                    session_state       TEXT,
                    PRIMARY KEY (provider, "providerAccountId")
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts (\"userId\")"
            )

            # Auth.js core: sessions (unused with JWT strategy but adapter expects)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    "sessionToken" TEXT PRIMARY KEY,
                    "userId"       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    expires        TIMESTAMPTZ NOT NULL
                )
            """)

            # Auth.js core: verification_tokens (magic links, unused)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS verification_tokens (
                    identifier TEXT NOT NULL,
                    token      TEXT NOT NULL,
                    expires    TIMESTAMPTZ NOT NULL,
                    PRIMARY KEY (identifier, token)
                )
            """)

            # Our domain: invitations
            # Token defaults to a 48-char hex string (24 random bytes).
            # No RLS: signIn looks up by email without a tenant context;
            # listing for management goes through the FastAPI side which
            # scopes to the calling tenant via the API layer.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS invitations (
                    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    email              TEXT NOT NULL,
                    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    token              TEXT NOT NULL UNIQUE
                                       DEFAULT encode(gen_random_bytes(24), 'hex'),
                    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
                    consumed_at        TIMESTAMPTZ,
                    consumed_by_email  TEXT
                )
            """)
            # Partial unique index: one outstanding invite per email at a time.
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS invitations_email_unconsumed
                    ON invitations (email) WHERE consumed_at IS NULL
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS invitations_tenant_idx ON invitations (tenant_id)"
            )

            # Our domain: tenant_users (one row per user → tenant mapping)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS tenant_users (
                    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    role       TEXT NOT NULL DEFAULT 'member',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            await conn.execute(
                "CREATE INDEX IF NOT EXISTS tenant_users_tenant_idx ON tenant_users (tenant_id)"
            )

            log.info("postgres migration: auth tables ready (users, accounts, sessions, verification_tokens, invitations, tenant_users)")


async def migrate_student_secrets(pool: AsyncConnectionPool) -> None:
    """Pillar 1B step 1 — student_secrets table.

    Encrypted-at-rest BYO API keys for the student's chosen LLM providers
    (and eventually OAuth tokens for MCP integrations). The runtime reads
    these at /chat time to call the provider with the student's own key,
    on the student's own bill.

    Encryption uses pgcrypto's pgp_sym_encrypt with a deployment-level
    key set via the MAKE_SKILLS_SECRETS_KEY env var. The key is loaded
    into the per-connection GUC `app.secrets_key` (transaction-scoped)
    so SQL helpers can decrypt without the plaintext key ever crossing
    the application boundary at read time.

    See docs/proposals/pillar-1b-agent-runtime.md Decision 4 for the full
    rationale + KMS upgrade path.

    RLS scope: tenant_id, same pattern as conversations. Each tenant can
    only ever see their own secrets, even on a single shared connection.
    """
    async with pool.connection() as conn:
        async with conn.transaction():
            # pgcrypto already enabled in migrate_postgres.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS student_secrets (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    provider_slug   TEXT NOT NULL,
                    encrypted_value BYTEA NOT NULL,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            # One row per (tenant, provider) — re-saving overwrites.
            await conn.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS student_secrets_tenant_provider
                    ON student_secrets (tenant_id, provider_slug)
            """)

            # RLS — same enforcement pattern as conversations.
            await conn.execute("ALTER TABLE student_secrets ENABLE ROW LEVEL SECURITY")
            await conn.execute("ALTER TABLE student_secrets FORCE ROW LEVEL SECURITY")
            await conn.execute("DROP POLICY IF EXISTS student_secrets_rls ON student_secrets")
            await conn.execute("""
                CREATE POLICY student_secrets_rls ON student_secrets
                    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
            """)

            log.info("postgres migration: student_secrets ready (BYO provider keys)")


async def migrate_lancedb() -> None:
    """Add tenant_id + visibility columns to the LanceDB records table.

    Uses Table.add_columns with SQL default expressions — metadata-only,
    no data rewrite. Existing rows backfill to the default-tenant UUID.
    """
    # Imported here so the module is importable without lancedb installed
    # (e.g. in CI environments that only run Postgres migrations).
    from api.memory.lance import get_table

    table, _ = get_table()
    schema_names = {f.name for f in table.schema}
    additions: dict[str, str] = {}
    if "tenant_id" not in schema_names:
        additions["tenant_id"] = f"'{DEFAULT_TENANT_ID}'"
    if "visibility" not in schema_names:
        additions["visibility"] = "'private'"

    if additions:
        log.info("lancedb migration: adding columns %s", list(additions.keys()))
        table.add_columns(additions)
    else:
        log.info("lancedb migration: tenant_id + visibility already present")

    # Build BTREE scalar indexes for prefilter pushdown. LanceDB's
    # create_scalar_index is idempotent in the current stable release —
    # it returns the existing index if one is already built on the column.
    for col, idx_type in (("tenant_id", "BTREE"), ("visibility", "BTREE")):
        try:
            table.create_scalar_index(col, index_type=idx_type)
            log.info("lancedb migration: scalar index on %s ready", col)
        except Exception as e:
            # Already exists is the common case after the first run;
            # log at debug rather than warn to avoid alarm.
            log.debug("lancedb scalar index on %s skipped: %s", col, e)


async def run_all(pool: AsyncConnectionPool) -> None:
    """Entrypoint called from main.py lifespan. Postgres first (auth-critical),
    LanceDB second (recorder-related)."""
    await migrate_postgres(pool)
    await migrate_auth_tables(pool)
    await migrate_student_secrets(pool)
    await migrate_lancedb()
