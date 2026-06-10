# `lancedb-memory/` — DEPRECATED in Phase 4 (2026-06-10)

**Replaced by:** [the-loom's pgvector MCP](https://loom-agent-context.onrender.com/mcp/memory/)

## What this was

Make_Skills' original in-engine memory subsystem. A LanceDB-backed semantic memory store with:

- **`lance.py`** — LanceDB table operations (insert, search, list, count) on a per-deployment data directory (`/data/memory` on Render, configurable via `MEMORY_DATA_DIR`)
- **`mcp_server.py`** — MCP Server exposing 6 tools (`memory_read`/`list`/`write`/`delete`/`search`/`recall`) over stdio for local Claude Code sessions
- **`mcp_http.py`** — HTTP/Streamable transport wrapping the same Server, mounted at `/mcp/memory` on the FastAPI app when `PLATFORM_MODE=hosted`
- **`auth_bridge.py`** — JWT-to-tenant bridge for the HTTP transport so per-request tenant flowed into the same handlers
- **`recall.py`** — langchain `@tool`-decorated function the agent runtime registered as a built-in tool. The agent could invoke `recall(query, ...)` to pull relevant memories into context
- **`recorder.py`** — fire-and-forget background task that, after each chat turn, called Anthropic Haiku to extract structured records from the turn and write them to LanceDB

## Why it's deprecated

Per [`project_make_skills_was_skeleton_never_shipped`](C:\Users\Liz\.claude\projects\c--Users-Liz-Make-Skills\memory\) and [`docs/plans/2026-06-01-mvp-migration.md`](../../docs/plans/2026-06-01-mvp-migration.md), Make_Skills was a never-shipped skeleton. The roles this memory subsystem was being built for (cross-project memory, multi-tenant isolation, durable agent context) got rebuilt cleanly in **the-loom**, which is the canonical memory layer going forward:

- **Cross-session memory** → the-loom MCP at `https://loom-agent-context.onrender.com/mcp/memory/`
- **Per-project scoping** → the-loom's `project_tags` argument on `memory_write`/`memory_recall`
- **Multi-tenant isolation** → the-loom's per-project boundaries (no `tenant_id` model — projects are the boundary)
- **Cross-machine durability** → already solved by the-loom being a Render-deployed service, no LanceDB file path required

The boundary rule the migration plan preserves: *Make_Skills improves local agency and produces candidates. The-loom observes across projects, governs promotion, and stores durable structure.* Memory storage belongs to the-loom. Make_Skills agents calling memory should call the-loom MCP.

## What was removed in Phase 4

- `platform/api/memory/` → `deprecated/lancedb-memory/` (this directory; 7 modules + `__init__.py`)
- `platform/api/observability.py` (dead code after the memory endpoints went; nothing else imported it)
- `platform/api/main.py`: 4 import lines, the `record_turn` calls at 5 sites, the `MemorySearchRequest` + `IngestRequest` Pydantic models, `/memory/search`, `/memory/records`, `/memory/stats`, `/memory/ingest`, all 6 `/observability/*` endpoints, the `/mcp/memory` HTTP mount (`mcp_http.mount_into`), and the `session_lifespan` import inside the lifespan. Lines: 1122 → 919.
- `platform/api/agent.py`: `from api.memory.recall import recall` import + `recall` from `builtin_tools` list
- `platform/api/migrations.py`: `migrate_lancedb()` function + its call from `run_all()`
- `platform/requirements.txt`: `lancedb`, `fastembed`, `pyarrow`, `mcp`, `watchdog`, `PyYAML` (all orphaned after the deprecation)
- `render.yaml`: `MEMORY_DATA_DIR` env var + the `disk:` block (`/data/memory`, 1GB) — both LanceDB-specific
- `platform/tests/`: `test_memory_mcp.py`, `test_memory_mcp_hosted.py`, `test_memory_shim.py`, `test_pillar_0_isolation.py` moved to `deprecated/lancedb-memory/tests/`

## Audit checklist (before promotion to `git rm`)

Per [`deprecated/README.md`](../README.md), deletion requires:

- [x] Zero live calls — confirmed in Phase 4 audit; the only consumers were Make_Skills' own internal callers (REST endpoints + agent.recall + record_turn + migrations + observability), all stripped above
- [x] Zero external consumers — confirmed in Phase 4 audit; humancensys-app, Hub, and SDE_Extraction don't call `/mcp/memory` on Make_Skills (they all use the-loom MCP directly per their `CLAUDE.md` files)
- [ ] 30 days elapsed in `deprecated/` without surfacing — count from this PR's merge date
- [ ] No external repo or doc references — search for `from api.memory` and `/mcp/memory` in consuming repos before deletion

After all four boxes are checked, a follow-up PR can `git rm` this directory.

## Tests retained

`tests/` contains the original 4 test files. They reference `from api.memory.X` which now resolves to `deprecated.lancedb-memory.X` — they will not run without import-path rewriting. Kept as historical record of how the subsystem was tested, not as live test coverage.
