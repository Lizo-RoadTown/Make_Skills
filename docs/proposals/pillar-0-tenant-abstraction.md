# Proposal: Pillar 0 — Tenant abstraction

**Status:** Open — synthesized from four parallel research agents (2026-04-29). Ready to execute in phases.
**Authors:** Liz, agent-assisted
**Date:** 2026-04-29

## Problem

Every tenant-owned table in Make_Skills today (LangGraph checkpoints, LanceDB memory records, future skill candidates, future per-tenant Ollama endpoints) is implicitly single-tenant. The codebase carries `tenant_id="default"` in a few places as a placeholder. Until this is real:

- Hosted-multitenant cannot launch — one missed `WHERE` clause leaks data between users.
- BYO Personal Ollama Stage 2 (per-tenant endpoint registration) has nowhere to live.
- The Pillar 1B subagent-creation UI cannot store per-user configs.
- The Pillar 3c knowledge commons has no `visibility` flag to mark publishable rows.

The two-mode commitment (ADR-002) requires self-host AND hosted to ship from the same codebase. Pillar 0 is the foundation that makes the second mode safe.

## Decision: shared schema, app-level + RLS defense-in-depth

Synthesized from research; full citations in the four agent reports linked at the bottom.

### Architecture choice

**Shared schema with a `tenant_id` column on every tenant-owned table.** Not schema-per-tenant (chokes Postgres past ~500 schemas). Not DB-per-tenant (economically dead at the free-tier scale). This is what Notion, Linear, GitHub Issues, Slack, and the majority of Supabase-hosted SaaS do.

### Enforcement: both layers

- **Primary**: app-level `WHERE tenant_id = $1` injected through a single repository helper. One forgotten `WHERE` clause is the most common SaaS data-leak vector — having a single funnel for all DB calls is the simplest way to make that hard to forget.
- **Seat belt**: Postgres Row-Level Security via `set_config('app.tenant_id', tid, true)` (transaction-local, PgBouncer-transaction-pooling-safe). RLS catches the one query that escapes the helper and is the **only** mechanism that uniformly covers raw `psycopg` analytics queries AND the LangGraph `AsyncPostgresSaver`'s internal SQL.

Both. Not either. The 2025 leakage incidents documented by Nile and InstaTunnel were teams that picked one and got bit.

### Tenant resolution: pluggable, JWT-claim primary

A `TenantResolver` Protocol with two implementations selected by `PLATFORM_MODE`:

- `DefaultTenantResolver` (self-host) — returns `TenantContext(tenant_id="default", user_id="local")`, no auth runs.
- `JWTTenantResolver` (hosted) — verifies the bearer token, pulls `tenant_id` and `sub` claims, raises 401 on missing.

Subdomain or path-based routing can layer on top later as UX sugar but is **always cross-checked against the JWT claim** — header-only or path-only are spoofable.

### LangGraph PostgresSaver: don't touch the internal schema

The LangChain forum maintainer-blessed pattern (April 2025): keep `AsyncPostgresSaver`'s three internal tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`) as **dumb storage**. Instead:

1. Add a Make_Skills-owned `conversations` table mapping `thread_id → tenant_id, user_id`.
2. RLS policy on `conversations` — `USING (tenant_id = current_setting('app.tenant_id')::uuid)`.
3. Subclass `AsyncPostgresSaver` to override `_cursor()` and inject `SELECT set_config('app.tenant_id', %s, true)` on every connection acquire.
4. Verify `conversations.thread_id` belongs to the tenant **before** invoking the agent — kills the leaked-thread-id replay attack.

Optional defense-in-depth: also add `tenant_id` columns to the checkpoint tables themselves with RLS. Skip for MVP; revisit if a security review demands it.

### LanceDB: single table, two new columns

Confirmed against current LanceDB docs:

- Add `tenant_id` and `visibility` columns to the existing `records` table via `Table.add_columns({...})` — metadata-only, no data rewrite.
- Build BTREE scalar indexes on both (high-cardinality strings → BTREE, not BITMAP).
- **Prefilter is the default** in LanceDB and is pushed down through Substrait. With a BTREE on `tenant_id`, the filter is effectively free relative to vector search.
- Lance Namespace exists but is organizational, not a security boundary. Skip.

### Public commons: one query, not table-per-namespace

`WHERE visibility='public' OR tenant_id=$me` — single query, single index pass, globally ranked top-K. Works because LanceDB pushes both filters down. Avoids the table-per-tenant cache overhead documented in `lancedb#1336` and the cross-tenant fan-out cost.

### GDPR / tenant deletion: three-state lifecycle

EDPB's Feb 2026 ruling explicitly says soft-delete-only is non-compliant. Adopt the three-state pattern from day one:

- `active` — normal.
- `soft-deleted` (`deleted_at` set on `tenants` row, RLS policies include `AND tenants.deleted_at IS NULL`) — 30-day grace.
- `hard-deleted` — nightly cron promotes expired soft-deleted tenants. `DELETE FROM tenants WHERE id = $1` cascades to every child table (`ON DELETE CASCADE`); LanceDB rows purged by tenant_id; LangGraph threads purged.

## Schema changes

```sql
-- 1. Tenants table
CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | suspended | soft-deleted
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- The default-tenant row that self-host runs as. Existing rows backfill against this.
INSERT INTO tenants (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'default');

-- 2. Conversations table (LangGraph thread_id → tenant_id mapping)
CREATE TABLE conversations (
  thread_id   TEXT PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON conversations (tenant_id, created_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_rls ON conversations
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 3. (Optional, defense-in-depth) tenant_id on checkpoint tables
-- ALTER TABLE checkpoints ADD COLUMN tenant_id UUID;
-- ALTER TABLE checkpoint_blobs ADD COLUMN tenant_id UUID;
-- ALTER TABLE checkpoint_writes ADD COLUMN tenant_id UUID;
-- (populated via trigger from current_setting('app.tenant_id'))
```

LanceDB:

```python
tbl = db.open_table("records")
tbl.add_columns({
    "tenant_id":  "'00000000-0000-0000-0000-000000000000'",  # default tenant UUID
    "visibility": "'private'",
})
tbl.create_scalar_index("tenant_id",  index_type="BTREE")
tbl.create_scalar_index("visibility", index_type="BTREE")
```

## Code changes (sketches)

`platform/api/auth.py` (new):

```python
from dataclasses import dataclass
from typing import Protocol
from fastapi import Depends, Header, HTTPException
import os

@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str | None = None

class TenantResolver(Protocol):
    async def __call__(self, *args, **kwargs) -> TenantContext: ...

class DefaultTenantResolver:
    """Self-host: no auth, single tenant."""
    DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000"
    async def __call__(self) -> TenantContext:
        return TenantContext(tenant_id=self.DEFAULT_TENANT_ID, user_id="local")

class JWTTenantResolver:
    """Hosted: verify JWT, pull tenant_id claim."""
    async def __call__(self, authorization: str = Header(...)) -> TenantContext:
        # JWT verification implementation lands when an auth provider is chosen.
        # For now, this stub raises so misconfigured prod fails loudly.
        raise NotImplementedError("JWT auth not wired yet")

def _select_resolver() -> TenantResolver:
    mode = os.environ.get("PLATFORM_MODE", "self_host")
    return JWTTenantResolver() if mode == "hosted" else DefaultTenantResolver()

resolver = _select_resolver()

async def get_current_tenant() -> TenantContext:
    return await resolver()
```

`platform/api/db.py` (new — single tenant-scoped connection helper):

```python
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool
from api.auth import TenantContext

_pool: AsyncConnectionPool | None = None

def init_pool(conninfo: str) -> AsyncConnectionPool:
    global _pool
    _pool = AsyncConnectionPool(conninfo=conninfo, kwargs={"autocommit": False})
    return _pool

@asynccontextmanager
async def tenant_conn(ctx: TenantContext):
    """Per-request tenant-scoped connection. RLS + transaction-local GUC."""
    assert _pool is not None
    async with _pool.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                "SELECT set_config('app.tenant_id', %s, true)",
                (ctx.tenant_id,),
            )
            yield conn
```

`platform/api/agent.py` — wrap the saver:

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.checkpoint.postgres import _ainternal
from contextlib import asynccontextmanager
from contextvars import ContextVar

_current_tenant: ContextVar[str] = ContextVar("current_tenant")

class TenantScopedSaver(AsyncPostgresSaver):
    @asynccontextmanager
    async def _cursor(self, *, pipeline: bool = False):
        tenant_id = _current_tenant.get()
        async with self.lock, _ainternal.get_connection(self.conn) as conn:
            await conn.execute(
                "SELECT set_config('app.tenant_id', %s, true)",
                (str(tenant_id),),
            )
            from psycopg.rows import dict_row
            async with conn.cursor(binary=True, row_factory=dict_row) as cur:
                yield cur
```

The chat endpoint sets the ContextVar before calling the agent, and verifies the thread belongs to the tenant via the `conversations` table:

```python
@app.post("/chat")
async def chat(
    req: ChatRequest,
    background: BackgroundTasks,
    ctx: TenantContext = Depends(get_current_tenant),
):
    thread_id = req.thread_id or str(uuid4())
    _current_tenant.set(ctx.tenant_id)

    # Enforce tenant ownership of thread (creates row on first use)
    async with tenant_conn(ctx) as conn:
        await conn.execute(
            """
            INSERT INTO conversations (thread_id, tenant_id, user_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (thread_id) DO NOTHING
            """,
            (thread_id, ctx.tenant_id, ctx.user_id),
        )
        # The RLS policy means this SELECT returns 0 rows if the thread
        # belongs to a different tenant — even if the attacker knows the UUID.
        row = await (await conn.execute(
            "SELECT 1 FROM conversations WHERE thread_id = %s", (thread_id,)
        )).fetchone()
        if not row:
            raise HTTPException(403, "thread does not belong to this tenant")

    config = {"configurable": {"thread_id": thread_id, "tenant_id": ctx.tenant_id}}
    result = await app.state.agent.ainvoke({...}, config=config)

    # Background tasks pass tenant_id explicitly, never via ContextVar.
    background.add_task(record_turn, ctx.tenant_id, thread_id, req.message, response_text)
```

`platform/api/memory/lance.py` — scope writes/reads:

```python
def insert_records(records: list[dict[str, Any]], tenant_id: str) -> int:
    # ... add tenant_id and visibility="private" to every row before insert

def search(query: str, tenant_id: str, limit: int = 5, ..., include_public: bool = True):
    where = f"(visibility = 'public' OR tenant_id = '{_sql_escape(tenant_id)}')" if include_public \
            else f"tenant_id = '{_sql_escape(tenant_id)}'"
    # ... AND with the existing filters
```

`platform/api/memory/recorder.py` — accept `tenant_id` as the first arg (background-task discipline):

```python
async def record_turn(tenant_id: str, thread_id: str, user_message: str, agent_response: str) -> int:
    # ... pass tenant_id all the way through to insert_records
```

## Implementation phases

| Phase | Scope | Output | Blocks |
|-------|-------|--------|--------|
| **P1: Schema migration** | `tenants` + `conversations` tables, default-tenant row, LanceDB `add_columns`, BTREE indexes | One migration script, idempotent | All other phases |
| **P2: Auth interface** | `auth.py` with `TenantContext` + `DefaultTenantResolver` + `JWTTenantResolver` stub, `PLATFORM_MODE` env | Code merged, default mode is `self_host` | P3, P4 |
| **P3: DB helper** | `db.py` with `tenant_conn` context manager + connection pool | Code merged | P4, P5 |
| **P4: Endpoint scoping** | `Depends(get_current_tenant)` on every endpoint that touches tenant data | Code merged, all reads/writes filter by tenant_id | P6 |
| **P5: LangGraph wrapper** | `TenantScopedSaver`, conversations-table verification before agent invoke | Code merged | P6 |
| **P6: Background-task discipline** | `record_turn(tenant_id, ...)` signature update, callers pass tenant_id explicitly | Code merged | P7 |
| **P7: Isolation tests** | Two-fixture-client pattern (tenant A creates, tenant B 404s) on every tenant-scoped endpoint | CI passes | Pillar 1B, hosted launch |

P1 is the only step that touches existing data. Everything after is additive — self-host keeps working with `tenant_id="default"` from start to finish, hosted lights up when `PLATFORM_MODE=hosted` plus the JWT auth provider is wired (a separate decision, captured in [`byo-auth-provider.md`](./byo-auth-provider.md) when written).

## Two-mode notes

| Mode | What changes |
|------|--------------|
| **Self-host** | A migration runs once on the existing volume; every existing record is backfilled to `tenant_id = "00000000-0000-0000-0000-000000000000"`. `PLATFORM_MODE=self_host` (default) wires `DefaultTenantResolver`. No auth runs. Behavior is identical to today. |
| **Hosted-multitenant** | `PLATFORM_MODE=hosted` wires `JWTTenantResolver`. Each tenant signs in via the (TBD) auth provider, gets a JWT with `tenant_id` claim, and the same code paths scope all reads/writes. Public commons rows live in the same tables, marked `visibility='public'`. |

## Open questions (block hosted launch, not Pillar 0 itself)

These are recorded but **don't block any of the seven phases above**:

1. **Auth provider** — GitHub OAuth, Clerk, Auth.js. Decision can lag P1-P7; the JWT verifier is a one-line swap.
2. **Tenant routing** — subdomain (`<tenant>.humancensys.com`) vs path (`humancensys.com/<tenant>`). Cosmetic; both work over JWT.
3. **Tenant signup flow** — self-serve vs invite. Product decision.
4. **Stripe / billing** — when do tenants start paying? Out of scope for Pillar 0.

## Top pitfalls (from research)

Designing around these from day one:

1. **Pool context leakage** — using `SET` instead of `SET LOCAL` (or `set_config(..., true)`) leaks tenant context to the next pgbouncer-pooled request. The `tenant_conn` helper is the only place that touches the GUC, transaction-scoped. Test: 50 concurrent requests across two tenants, assert zero crossover.
2. **Background jobs without tenant context** — the recorder is the canonical example. Pass `tenant_id` as a required argument; never read from ambient ContextVar in a background task.
3. **Shared cache / vector keys without tenant prefix** — every cache key, every LanceDB filter, every Redis namespace prefixed with `tenant_id:`. One helper.

## Sources

- Research agent — multi-tenant architecture patterns (Apr 2026): shared-schema + RLS defense-in-depth recommendation, GDPR three-state lifecycle, top pitfalls
- Research agent — FastAPI tenant scoping patterns (Apr 2026): `Depends(get_current_tenant)` shape, `set_config(..., true)` transaction-locality, isolation test pattern
- Research agent — LanceDB multi-tenancy (Apr 2026): single-table + BTREE scalar index, prefilter pushdown, public commons via `visibility` flag
- Research agent — LangGraph PostgresSaver tenant scoping (Apr 2026): conversations sidecar table + `_cursor` subclass, leaked-thread-id replay attack mitigation

(Full citations and links to upstream sources — Crunchy Data, AWS Prescriptive Guidance, PlanetScale, Notion, LangChain forum, LanceDB docs, Bytebase footguns post — are in the agent reports retained in conversation context.)
