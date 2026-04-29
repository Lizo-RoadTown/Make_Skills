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
    await migrate_lancedb()
