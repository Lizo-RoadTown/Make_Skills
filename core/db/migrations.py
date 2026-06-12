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


async def migrate_user_agents(pool: AsyncConnectionPool) -> None:
    """Pillar 1B step 3 — user_agents + student_skills + student_integrations.

    The student's stable. Each `user_agents` row is one agent the student
    has built through the wizard (or imported from a portable identity
    bundle). Skills + integrations are 1:N children, both keyed by
    agent_id.

    All three tables are tenant-scoped via Pillar 0 RLS. A skill's
    agent_id can be NULL (a tenant-level skill not attached to a
    specific agent — used by the export bundle, and as a future "skills
    library you can attach to any agent" surface).

    The wizard's Save scene posts here in step 5 (replacing localStorage).
    The AgentRuntime (steps 4-6) reads from here to instantiate per-
    student agents at /chat time.

    See docs/proposals/portable-student-identity.md for the schema
    rationale and docs/proposals/pillar-1b-agent-runtime.md Decision 1
    for runtime use.
    """
    async with pool.connection() as conn:
        async with conn.transaction():
            # ---- user_agents ----
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS user_agents (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    name        TEXT NOT NULL,
                    starter     TEXT NOT NULL,         -- "orb" | "cube" | "spark" | "loom"
                    provider    TEXT NOT NULL,         -- LLM provider slug
                    model       TEXT,                  -- model identifier (nullable for "use provider default")
                    persona     TEXT,                  -- the "idea" — system prompt
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    deleted_at  TIMESTAMPTZ            -- soft delete; export filters
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS user_agents_tenant_idx
                    ON user_agents (tenant_id, created_at DESC)
                    WHERE deleted_at IS NULL
            """)
            await conn.execute("ALTER TABLE user_agents ENABLE ROW LEVEL SECURITY")
            await conn.execute("ALTER TABLE user_agents FORCE ROW LEVEL SECURITY")
            await conn.execute("DROP POLICY IF EXISTS user_agents_rls ON user_agents")
            await conn.execute("""
                CREATE POLICY user_agents_rls ON user_agents
                    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
            """)

            # ---- student_skills ----
            # body_md is the full SKILL.md the student authored. version
            # bumps on each edit so the runtime can cache compiled skills
            # by (id, version).
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS student_skills (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    agent_id     UUID REFERENCES user_agents(id) ON DELETE CASCADE,
                    name         TEXT NOT NULL,
                    description  TEXT NOT NULL,
                    body_md      TEXT NOT NULL,
                    version      INTEGER NOT NULL DEFAULT 1,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS student_skills_tenant_idx
                    ON student_skills (tenant_id, agent_id)
            """)
            await conn.execute("ALTER TABLE student_skills ENABLE ROW LEVEL SECURITY")
            await conn.execute("ALTER TABLE student_skills FORCE ROW LEVEL SECURITY")
            await conn.execute("DROP POLICY IF EXISTS student_skills_rls ON student_skills")
            await conn.execute("""
                CREATE POLICY student_skills_rls ON student_skills
                    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
            """)

            # ---- student_integrations ----
            # The connection map. mcp_server_slug references the platform's
            # MCP registry by slug (NOT a foreign key — registry is code-
            # owned, not table-owned). Auth tokens for OAuth-flavored MCPs
            # live in student_secrets keyed by `mcp:<slug>` provider_slug
            # (already supported by the existing student_secrets table).
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS student_integrations (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    agent_id        UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
                    mcp_server_slug TEXT NOT NULL,
                    config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS student_integrations_agent_idx
                    ON student_integrations (agent_id)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS student_integrations_tenant_idx
                    ON student_integrations (tenant_id)
            """)
            await conn.execute("ALTER TABLE student_integrations ENABLE ROW LEVEL SECURITY")
            await conn.execute("ALTER TABLE student_integrations FORCE ROW LEVEL SECURITY")
            await conn.execute(
                "DROP POLICY IF EXISTS student_integrations_rls ON student_integrations"
            )
            await conn.execute("""
                CREATE POLICY student_integrations_rls ON student_integrations
                    USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
                    WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
            """)

            log.info(
                "postgres migration: user_agents + student_skills + student_integrations ready"
            )


# The-loom's self-host tenant UUID. The bridge receiver maps the-loom-side
# tenant UUIDs (carried in promotion-candidate payloads) to engine-side
# tenant UUIDs via the tenant_id_mapping table. The mapping table is
# seeded with this one row at migration time so self-host bridge POSTs
# work out of the box without any operator step.
#
# This is the UUID the-loom uses on its side; Make_Skills' own
# DEFAULT_TENANT_ID stays "00000000-0000-0000-0000-000000000000" and is
# the engine-side row it maps to. See
# `decision_tenant_id_mapping_option_b_2026_06_12` for the full reasoning.
LOOM_SELF_HOST_TENANT_ID = "1d8ec1b3-d62a-5fab-9a52-eb6a3e09f1c8"


async def migrate_skill_making_bridge(pool: AsyncConnectionPool) -> None:
    """Phase 4 — skill-making bridge receiver tables.

    Three tables:
      1. tenant_id_mapping  — cross-system tenant UUID reconciliation
         (`source_system`, `source_tenant_id`) -> `engine_tenant_id`.
         Seeded with one self-host row mapping the-loom's
         SELF_HOST_TENANT_ID to Make_Skills' DEFAULT_TENANT_ID.
      2. bridge_idempotency — `promotion_id`-keyed dedup store. The
         receiver checks here before doing any work. Stores the engine's
         response for replay so retries get the same answer.
      3. promoted_skills    — candidate rows the receiver writes when a
         promotion candidate arrives. RLS-scoped by `engine_tenant_id`
         (which is what `app.tenant_id` is set to). `kind` carries the
         9-kind taxonomy; v1.0 receiver only compiles `kind='skill'`,
         other kinds land with `status='kind_not_yet_handled'` so the
         audit chain stays intact.

    Idempotent. Safe to call on every container start.
    """
    async with pool.connection() as conn:
        async with conn.transaction():
            # ---- 1. tenant_id_mapping ----
            # No RLS — this is operator-configured infrastructure. The
            # receiver looks up the mapping with a superuser-equivalent
            # query (no `app.tenant_id` set yet at lookup time; that's
            # exactly what we're resolving). Reads/writes here go through
            # an unscoped connection helper, not `tenant_conn`.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS tenant_id_mapping (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    source_system     TEXT NOT NULL,          -- 'loom' for now
                    source_tenant_id  UUID NOT NULL,
                    engine_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (source_system, source_tenant_id)
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS tenant_id_mapping_engine_idx
                    ON tenant_id_mapping (engine_tenant_id)
            """)
            # Self-host seed: the-loom's SELF_HOST_TENANT_ID -> our DEFAULT_TENANT_ID.
            # ON CONFLICT keeps reruns idempotent.
            await conn.execute(
                """
                INSERT INTO tenant_id_mapping
                    (source_system, source_tenant_id, engine_tenant_id)
                VALUES ('loom', %s::uuid, %s::uuid)
                ON CONFLICT (source_system, source_tenant_id) DO NOTHING
                """,
                (LOOM_SELF_HOST_TENANT_ID, DEFAULT_TENANT_ID),
            )

            # ---- 2. bridge_idempotency ----
            # promotion_id is the wire-contract idempotency key per the
            # bridge spec. Stores the response we returned so retries on
            # the same promotion_id get the same answer (per spec).
            # No RLS — this is bridge infrastructure, the receiver checks
            # it before tenant scoping is even resolved.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS bridge_idempotency (
                    promotion_id    UUID PRIMARY KEY,
                    response_json   JSONB NOT NULL,
                    status_code     INTEGER NOT NULL,
                    received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)

            # ---- 3. promoted_skills ----
            # The candidate's landing place. body_md holds the SKILL.md
            # source the-loom sent; the compiler reads it later (PR B).
            # source_signature is the `pattern_signature` from the wire
            # contract — used for semantic dedup so the same pattern
            # collapses to one skill even across different promotion_ids.
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS promoted_skills (
                    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    promotion_id        UUID NOT NULL UNIQUE,
                    engine_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    source_system       TEXT NOT NULL,
                    source_tenant_id    UUID NOT NULL,
                    is_global           BOOLEAN NOT NULL DEFAULT FALSE,
                    candidate_kind      TEXT NOT NULL,
                    pattern_signature   TEXT NOT NULL,
                    source_name         TEXT NOT NULL,
                    source_description  TEXT NOT NULL,
                    body_md             TEXT NOT NULL,
                    capability_tags     JSONB NOT NULL DEFAULT '[]'::jsonb,
                    triggers            JSONB NOT NULL DEFAULT '[]'::jsonb,
                    callbacks           JSONB NOT NULL DEFAULT '{}'::jsonb,
                    status              TEXT NOT NULL,         -- 'queued' | 'kind_not_yet_handled' | 'compiled' | 'rejected' | 'queued_human_review'
                    skill_id            UUID,                  -- set when status='compiled' (PR B)
                    rejection_reason    TEXT,
                    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS promoted_skills_tenant_idx
                    ON promoted_skills (engine_tenant_id, created_at DESC)
            """)
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS promoted_skills_pattern_idx
                    ON promoted_skills (engine_tenant_id, pattern_signature)
            """)
            await conn.execute("ALTER TABLE promoted_skills ENABLE ROW LEVEL SECURITY")
            await conn.execute("ALTER TABLE promoted_skills FORCE ROW LEVEL SECURITY")
            await conn.execute("DROP POLICY IF EXISTS promoted_skills_rls ON promoted_skills")
            await conn.execute("""
                CREATE POLICY promoted_skills_rls ON promoted_skills
                    USING (engine_tenant_id = current_setting('app.tenant_id', true)::uuid)
                    WITH CHECK (engine_tenant_id = current_setting('app.tenant_id', true)::uuid)
            """)

            log.info(
                "postgres migration: tenant_id_mapping + bridge_idempotency + promoted_skills ready"
            )


async def run_all(pool: AsyncConnectionPool) -> None:
    """Entrypoint called from main.py lifespan. Postgres only — LanceDB
    memory subsystem was deprecated in Phase 4 of the MVP migration
    (see docs/plans/2026-06-01-mvp-migration.md). The-loom MCP at
    https://loom-agent-context.onrender.com/mcp/memory/ replaces it."""
    await migrate_postgres(pool)
    await migrate_auth_tables(pool)
    await migrate_student_secrets(pool)
    await migrate_user_agents(pool)
    await migrate_skill_making_bridge(pool)
