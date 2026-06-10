"""
Pillar 0 — tenant isolation tests.

These tests exercise the data-layer scoping directly (LanceDB filters and
Postgres RLS), bypassing FastAPI. The HTTP-level tests (two-fixture-client
pattern) light up once the JWT auth backend is wired — until then there
is one tenant per process from FastAPI's perspective.

Run inside the api container:

    docker compose -f platform/deploy/docker-compose.yml exec api \\
        python -m pytest platform/tests/test_pillar_0_isolation.py -v

Each test uses synthetic UUIDs so it can run alongside real data without
touching the default tenant. Cleanup deletes the synthetic rows on exit.
"""
from __future__ import annotations

import asyncio
import os
import uuid

import pytest

from api.memory.lance import (
    get_table,
    insert_records,
    list_records,
    search,
)


TENANT_A = "11111111-1111-1111-1111-111111111111"
TENANT_B = "22222222-2222-2222-2222-222222222222"


def _make_record(content: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "type": "fact",
        "content": content,
        "project_tags": ["pillar0-isolation-test"],
        "source_thread_id": "test",
        "ts": 0.0,
        "why": "isolation test",
    }


@pytest.fixture
def cleanup_test_rows():
    """Delete all rows tagged with the isolation-test marker after each test."""
    yield
    table, _ = get_table()
    try:
        table.delete("array_contains(project_tags, 'pillar0-isolation-test')")
    except Exception:
        pass


def test_lancedb_search_does_not_cross_tenants(cleanup_test_rows):
    """Records inserted under tenant A are invisible to tenant B searches
    (with include_public=False, the strict path)."""
    rec_a = _make_record("Alpha tenant A secret")
    rec_b = _make_record("Bravo tenant B secret")

    insert_records([rec_a], tenant_id=TENANT_A)
    insert_records([rec_b], tenant_id=TENANT_B)

    rows_a = search(
        query="secret",
        tenant_id=TENANT_A,
        limit=20,
        include_public=False,
    )
    rows_b = search(
        query="secret",
        tenant_id=TENANT_B,
        limit=20,
        include_public=False,
    )

    a_contents = {r["content"] for r in rows_a}
    b_contents = {r["content"] for r in rows_b}

    assert "Alpha tenant A secret" in a_contents, "tenant A should see its own record"
    assert "Bravo tenant B secret" not in a_contents, (
        "tenant A must not see tenant B's record"
    )
    assert "Bravo tenant B secret" in b_contents, "tenant B should see its own record"
    assert "Alpha tenant A secret" not in b_contents, (
        "tenant B must not see tenant A's record"
    )


def test_lancedb_list_records_does_not_cross_tenants(cleanup_test_rows):
    """Same isolation property on the non-semantic listing path."""
    insert_records([_make_record("Alpha list-only")], tenant_id=TENANT_A)
    insert_records([_make_record("Bravo list-only")], tenant_id=TENANT_B)

    rows_a = list_records(
        tenant_id=TENANT_A,
        project_tag="pillar0-isolation-test",
        include_public=False,
        limit=50,
    )
    rows_b = list_records(
        tenant_id=TENANT_B,
        project_tag="pillar0-isolation-test",
        include_public=False,
        limit=50,
    )

    assert all(r.get("tenant_id") == TENANT_A for r in rows_a), (
        "tenant A list should contain only tenant A rows"
    )
    assert all(r.get("tenant_id") == TENANT_B for r in rows_b), (
        "tenant B list should contain only tenant B rows"
    )


def test_lancedb_public_visibility_crosses_tenants(cleanup_test_rows):
    """Records marked visibility='public' appear in any tenant's search
    when include_public=True (the future Pillar 3c knowledge commons)."""
    public_rec = _make_record("Charlie public commons knowledge")
    private_rec = _make_record("Delta tenant A only")

    insert_records([public_rec], tenant_id=TENANT_A, visibility="public")
    insert_records([private_rec], tenant_id=TENANT_A, visibility="private")

    # Tenant B should see the public record but not the private one.
    rows_b = search(
        query="commons",
        tenant_id=TENANT_B,
        limit=20,
        include_public=True,
    )
    contents = {r["content"] for r in rows_b}
    assert "Charlie public commons knowledge" in contents, (
        "public records should be visible to other tenants"
    )

    rows_b_strict = search(
        query="Delta",
        tenant_id=TENANT_B,
        limit=20,
        include_public=True,
    )
    strict_contents = {r["content"] for r in rows_b_strict}
    assert "Delta tenant A only" not in strict_contents, (
        "private records must NEVER appear under another tenant"
    )


@pytest.mark.asyncio
async def test_postgres_rls_blocks_cross_tenant_conversations():
    """The conv_rls policy must reject SELECTs that don't match the GUC.

    Postgres RLS bypasses superusers by design, and the local docker stack
    connects as the postgres superuser. To exercise the policy, this test
    creates a temporary non-superuser role, switches into it for the
    actual reads/writes, and switches back to drop the role. Production
    on Render runs as a non-superuser app role permanently.
    """
    from psycopg_pool import AsyncConnectionPool

    db_url = os.environ["DATABASE_URL"]
    pool = AsyncConnectionPool(conninfo=db_url, kwargs={"autocommit": True}, open=False)
    await pool.open()
    test_role = f"pillar0_test_{uuid.uuid4().hex[:8]}"
    try:
        # Create a non-superuser test role with the privileges the app
        # would have in production. autocommit=True so CREATE ROLE commits
        # immediately (it cannot run in a transaction block).
        async with pool.connection() as conn:
            await conn.execute(f"CREATE ROLE {test_role} LOGIN")
            await conn.execute(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO {test_role}"
            )
            await conn.execute(f"GRANT SELECT, INSERT ON tenants TO {test_role}")

            # Tenants rows for the FK.
            await conn.execute(
                "INSERT INTO tenants (id, name) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
                (TENANT_A, "test-tenant-a"),
            )
            await conn.execute(
                "INSERT INTO tenants (id, name) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING",
                (TENANT_B, "test-tenant-b"),
            )

        thread_a = f"isolation-thread-{uuid.uuid4()}"

        # Insert as tenant A under the non-superuser role.
        async with pool.connection() as conn:
            async with conn.transaction():
                await conn.execute(f"SET LOCAL ROLE {test_role}")
                await conn.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (TENANT_A,)
                )
                await conn.execute(
                    "INSERT INTO conversations (thread_id, tenant_id) VALUES (%s, %s)",
                    (thread_a, TENANT_A),
                )

        # Read as tenant B — RLS should hide it.
        async with pool.connection() as conn:
            async with conn.transaction():
                await conn.execute(f"SET LOCAL ROLE {test_role}")
                await conn.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (TENANT_B,)
                )
                cur = await conn.execute(
                    "SELECT thread_id FROM conversations WHERE thread_id = %s",
                    (thread_a,),
                )
                row = await cur.fetchone()
                assert row is None, (
                    "RLS failed: tenant B can read tenant A's conversation row"
                )

        # Tenant A still sees it.
        async with pool.connection() as conn:
            async with conn.transaction():
                await conn.execute(f"SET LOCAL ROLE {test_role}")
                await conn.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (TENANT_A,)
                )
                cur = await conn.execute(
                    "SELECT thread_id FROM conversations WHERE thread_id = %s",
                    (thread_a,),
                )
                row = await cur.fetchone()
                assert row is not None, "tenant A lost its own conversation row"

        # Cleanup. Use the superuser connection (default role) so we can
        # drop the test role without permission games.
        async with pool.connection() as conn:
            await conn.execute(
                "DELETE FROM conversations WHERE thread_id = %s", (thread_a,)
            )
            await conn.execute(
                "DELETE FROM tenants WHERE id IN (%s, %s)",
                (TENANT_A, TENANT_B),
            )
            await conn.execute(
                f"REVOKE ALL ON conversations FROM {test_role}"
            )
            await conn.execute(f"REVOKE ALL ON tenants FROM {test_role}")
            await conn.execute(f"DROP ROLE IF EXISTS {test_role}")
    finally:
        await pool.close()
