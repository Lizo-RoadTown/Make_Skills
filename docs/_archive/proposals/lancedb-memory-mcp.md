# Proposal: LanceDB memory MCP — cross-machine session memory

**Status:** Open — written 2026-05-22. Phase 1 shipped (PR #32). Phase 2 in flight.
**Authors:** Liz, agent-assisted
**Date:** 2026-05-22

## Scope — what this proposal is and is NOT

This proposal is about **developer tooling for building agent apps** — specifically, making Claude Code's session memory (the typed-file `user_*` / `feedback_*` / `project_*` / `reference_*` protocol) work across machines by routing it through LanceDB.

It is NOT about the running app's runtime memory. The running app's agents already use LanceDB directly via `platform/api/memory/lance.py` and tools like `recall()` and `query_db()` — that path predates this proposal and continues to work as-is.

Two distinct consumers of the same LanceDB store:

| Consumer | What they use | Status |
|---|---|---|
| **Running app's runtime agents** (in production, serving end-users) | `platform/api/memory/lance.py` directly — `recall()`, `query_db()`, `insert_records()` | Already shipped; this proposal does not change it |
| **Developer's Claude Code sessions** (Liz building the app, contributors building forks) | MCP server (Phase 1) + sync shim (Phase 2) + hosted endpoint (Phase 3) | This proposal |

The infrastructure (LanceDB store, persistent disk, tenant scoping) is shared. The access paths are different because the consumers are different — runtime agents are Python code in the same process; Claude Code is an external MCP client.

For project-starter scaffolding: when a new repo is created with the memory layer baked in (per the 2026-05-22 architectural directive), BOTH access paths come along — the runtime LanceDB code for the app's agents AND the MCP server + shim for the developer's Claude Code sessions. They share the data directory.

## Problem

Claude Code's session memory protocol (the typed-file `user_*` / `feedback_*` / `project_*` / `reference_*` system at `~/.claude/projects/<key>/memory/`) is what makes cross-session continuity work. Future Claude sessions auto-load these files and pick up where the prior session left off — preferences, project facts, validated approaches, references all carry forward.

But the protocol is **local-machine only**. Liz's exact words from the 2026-05-22 session: *"I want the shared memory between files and machines. This is what I get frustrated with."* When she switches laptops, none of the accumulated memory comes with her. The new machine starts cold.

Existing solutions all have problems:

| Path | Problem |
|---|---|
| Private git repo sync (clone into memory dir, push/pull) | Workaround; manual sync; merge conflicts on simultaneous edits; not what Liz wants |
| Paid cloud memory service (MemContext etc.) | Vendor lock-in, recurring cost, owned by someone else |
| Status quo (local files only) | Doesn't solve the cross-machine goal |

Meanwhile, **Make_Skills already has the infrastructure** for the right solution sitting unused for this purpose:

- LanceDB at `platform/api/memory/` — already wired, schema includes `tenant_id` + `visibility` fields designed for exactly this use case
- A 1GB persistent disk on Render (`render.yaml` provisions it as `memory-data` mounted at `/data/memory`)
- Tenant-scoped via Pillar 0 (every read/write is `tenant_id`-gated by RLS in Postgres and by code-path in LanceDB)
- Two-mode discipline (self-host = local; hosted = humancensys.com)

The missing piece is an **MCP server wrapper** so Claude Code (and any other MCP client) can read/write the same LanceDB-backed memory from any machine where Liz is signed in.

## Decision: extend LanceDB with an MCP server, treat session memory as a first-class consumer

Build an MCP server at `platform/api/memory/mcp_server.py` that exposes the existing LanceDB store via the MCP protocol. Claude Code on any of Liz's machines connects to the same MCP endpoint. Memory writes (`feedback_*`, `project_*`, etc.) go to LanceDB instead of (or in addition to) the local file directory.

### Architecture

```
Claude Code (any machine)
    ↓ MCP protocol
make-skills-api at humancensys.com (or local)
    ↓ tenant-scoped access
platform/api/memory/ ─ LanceDB ─ /data/memory (persistent disk)
                                       │
                                       └── existing runtime agent memory
                                       └── NEW: session memory (this proposal)
```

Two MCP server modes match the platform's two-mode commitment:

- **Self-host**: MCP server runs on `localhost:<port>`, talks to local LanceDB. Single-user. No auth.
- **Hosted**: MCP server runs at humancensys.com/mcp, talks to the Render LanceDB. Multi-user. JWT-gated.

### Schema mapping — file protocol → LanceDB rows

Each memory file (e.g. `feedback_documentation_tone.md`) becomes a row in the existing `memory` table:

| File field | LanceDB row field |
|---|---|
| File name (without extension) | `id` |
| Frontmatter `description` | `content` field's leading summary |
| Body markdown | `content` field's body |
| Frontmatter `metadata.type` (`user` / `feedback` / `project` / `reference`) | `type` |
| `[[name]]` links in body | parsed into a `links` array (new field, additive migration) |
| Embedding of full content | `vector` |
| Implicit (from auth) | `tenant_id` |
| `private` by default | `visibility` |
| File mtime | `ts` |
| `MEMORY.md` index line | derived from `description` at read time |

`MEMORY.md` is a virtual artifact assembled on-read by querying the memory table and formatting the one-line-per-entry index. No separate storage.

### MCP server endpoints

Match the operations the file-based protocol already does. Six endpoints:

| Endpoint | What it does | Maps to |
|---|---|---|
| `memory.read(name)` | Return the body + frontmatter of one memory by name | `Read tool` on a `.md` file |
| `memory.list(type?)` | Return MEMORY.md-style index entries, optionally filtered by type | `Glob` on `*.md` |
| `memory.write(name, content, type)` | Upsert a memory row (creates or updates) | `Write tool` on a `.md` file |
| `memory.delete(name)` | Soft-delete (set `visibility=deleted`, never hard-delete) | `rm` on a `.md` file |
| `memory.search(query, type?)` | Semantic search over `content` using vector similarity | (no file-protocol equivalent — new capability the file protocol can't do) |
| `memory.recall(context_string)` | Auto-load relevant memories for a conversation start (RAG-style top-N by relevance) | (replaces "load all files into context" with smarter selection) |

The `search` and `recall` endpoints are the upside of moving off pure file-based — once memories are in a vector store, semantic retrieval becomes free.

### Client-side: how Claude Code talks to it

Two design options for the client side:

**Option 1 — Custom MCP client in Claude Code (clean, requires integration work)**
- Claude Code's auto-memory loader is taught to query the MCP server at session start instead of reading the local filesystem
- All `Read` / `Write` against `~/.claude/projects/<key>/memory/` go through the MCP transparently
- Requires Claude Code support for "memory backed by MCP" — may need an Anthropic-side feature request or a custom local shim

**Option 2 — Local sync shim (workaround, ships faster)**
- A tiny daemon runs locally that mirrors the MCP-backed memory to the local file directory
- Pulls on session start, pushes on file change (via filesystem watcher)
- Claude Code still reads/writes local files; the shim is invisible
- Conflict handling: last-write-wins; in practice rare because Liz works on one machine at a time

**Decision pending:** start with Option 2 (shim) for speed-to-value. Option 1 is the durable end-state if Anthropic adds first-class MCP-backed-memory support. The shim is throwaway; the server is permanent.

### Auth

Hosted mode uses the same HS256 JWT bridge already in place between Vercel + FastAPI. The MCP server validates the bearer token, extracts `tenant_id`, and all subsequent LanceDB operations are scoped to that tenant. Self-host mode runs locally, no auth, single-user.

### Privacy + portability

- **Default visibility = private.** Memories are tenant-scoped. Liz's memories aren't visible to other users.
- **Future: publish-to-commons.** The `visibility` field already supports `public` for the Pillar 3c knowledge commons. A future UI lets Liz mark specific memories (validated approaches, useful references) as public — they become discoverable by other Make_Skills users.
- **Export path.** A `memory.export()` endpoint returns all of a tenant's memories as a tarball of `.md` files matching the original file-based protocol. If Liz ever leaves the platform or wants to switch backends, her memory is portable.

## Phasing

### Phase 1 — local-only MCP server (~1 session)

Build the MCP server. Hook it up to the existing LanceDB. Verify the six endpoints work locally. No auth, no hosted mode, no Claude Code integration. Smoke test with `mcp-cli` or equivalent.

Deliverable: `platform/api/memory/mcp_server.py` + tests + `docs/runbooks/memory-mcp-local.md`.

### Phase 2 — local sync shim (~1 session)

Build the local daemon that mirrors MCP-backed memory to the file directory. Claude Code continues to read/write files; the shim syncs invisibly.

Deliverable: `scripts/memory-shim/` (Python daemon) + install instructions.

### Phase 3 — hosted-mode auth + Render deployment (shipped via PRs #45, #46, #47)

Mounted the existing low-level `mcp.server.Server` as a streamable HTTP endpoint at `/mcp/memory` via `StreamableHTTPSessionManager`. Auth via the SDK's `TokenVerifier` protocol — `MakeSkillsTokenVerifier` (in `platform/api/memory/auth_bridge.py`) reuses the existing HS256 JWT decode from `platform/api/auth.py` and sets `mcp_server.tenant_ctx_var` so the 6 tool handlers see the per-request tenant.

Two-mode discipline: self-host mode never mounts the HTTP route or constructs the session manager. Stdio entry point unchanged.

**Why not the FastAPI `Depends()` chain for auth?** Starlette mounts bypass FastAPI's dependency injection — `Depends()` doesn't fire inside a sub-app. The SDK's `TokenVerifier` is the equivalent surface for MCP-mounted apps. Documented in agent A's research (May 2026 dispatch) at finding #4.

**Why contextvars and not closures or per-request Server instances?** Streamable HTTP keeps a long-lived session keyed by `mcp-session-id`; rebinding handlers per HTTP request collides with that lifecycle. `contextvars.ContextVar` is the only pattern that respects the session model. Documented in agent B's research at recommendation #4.

**Why not unify on the existing `current_tenant` ContextVar?** Two reasons documented in `platform/api/memory/mcp_server.py:42-72`: (1) `current_tenant`'s default `DEFAULT_TENANT_ID` is the all-zeros UUID, which differs from the string `"default"` that Phase 1 MCP has been storing — swap-without-migration would orphan data; (2) the all-zeros UUID triggers a reproducible LanceDB filter bug on fresh writes. The unification is deferred to a future migration PR (change `DEFAULT_TENANT_ID` to a non-zero UUID + backfill the tenants FK chain + LanceDB rows). For now, MCP keeps `tenant_ctx_var` (default `"default"`) and the TokenVerifier sets it to the JWT-derived UUID in hosted mode (where the UUID is real, not all-zeros).

**Middleware sandwich (FastMCP's canonical pattern):** `AuthenticationMiddleware` (outermost — extracts user from `Authorization: Bearer` via `BearerAuthBackend(verifier)`) → `AuthContextMiddleware` (copies to SDK contextvar) → `RequireAuthMiddleware` (innermost — 401 if unauthenticated).

**Test surface deferred.** Integration tests at `platform/tests/test_memory_mcp_hosted.py` cover the three core cases (missing/invalid token → 401; tenant isolation) but are currently `pytest.mark.skip`-marked because the fixture hangs on multi-test lifespan re-entry. The structural fix is to construct a fresh FastAPI app per-test rather than importing the module-level `app`. Production code verified by direct probe.

Deliverable: hosted MCP endpoint at humancensys.com/mcp/memory + `platform/api/memory/{auth_bridge,mcp_http}.py` + integration test skeleton at `platform/tests/test_memory_mcp_hosted.py`. Runbook section in `docs/runbooks/memory-mcp-local.md`.

### Phase 4 (later) — Anthropic feature request + Option 1 client (TBD)

Once the shim is proven, file a feature request with Anthropic for first-class MCP-backed memory in Claude Code. If/when that lands, retire the shim.

## Two-mode discipline

Per [Pillar 0 — Tenant abstraction](pillar-0-tenant-abstraction.md):

- **Self-host (`PLATFORM_MODE=self_host`)**: MCP server runs locally. `tenant_id="default"`. No auth. Single user. LanceDB at local `/data/memory` (or wherever `MEMORY_DATA_DIR` points).
- **Hosted (`PLATFORM_MODE=hosted`)**: MCP server runs at humancensys.com. JWT-gated. Each request resolves `tenant_id` from the bearer token. LanceDB on the Render persistent disk.

Both modes use the same `platform/api/memory/mcp_server.py` code. Mode-switching happens at the auth + bind-address layer.

## What this unlocks

- **Cross-machine memory** (the primary goal — Liz works from any machine, picks up where she left off)
- **Cross-agent memory** (the project-starter agent + Make_Skills agent + any other MCP-compatible agent can read/write the same memory — this is how they "communicate")
- **Semantic retrieval** (memories surface by relevance, not just by name)
- **Public commons (Pillar 3c)** (the `visibility` field starts being load-bearing; users can opt-in publish validated approaches)
- **Seeded projects** (project-starter's scaffold script gains a `--memory-mcp <url>` flag — new projects connect to the user's existing memory backend instead of starting cold)

## Anti-patterns to refuse

- **Don't replace the file-based protocol** — keep it. The shim mirrors MCP↔files. Files remain the human-readable / git-storable / portable form.
- **Don't ship Option 1 (custom MCP client) before Option 2 (shim)** — the shim is faster to value and proves the architecture before any Anthropic-side integration work.
- **Don't bypass tenant scoping** — every endpoint resolves tenant_id via the JWT (hosted) or hardcodes `"default"` (self-host). Never accept a `tenant_id` param from the client.
- **Don't hard-delete memories** — soft-delete only (`visibility=deleted`). Recovery should always be possible.

## Open questions

1. **Embedding model.** LanceDB needs vectors; what model produces them? Current Make_Skills LanceDB uses `fastembed`'s `TextEmbedding` (per `platform/api/memory/lance.py`). Confirm that's sufficient or upgrade to OpenAI's `text-embedding-3-small` for higher-quality semantic retrieval.
2. **Frontmatter parsing.** Memory files use YAML frontmatter today. The MCP write path needs to parse YAML and split body from metadata. Standard library or `python-frontmatter`?
3. **`MEMORY.md` as a virtual file.** Should it remain a real file (synced by the shim) or become a derived API response only? Real-file is simpler for tooling; virtual is more consistent.
4. **Shim conflict resolution.** Last-write-wins is the simple default. Should the shim do something smarter when two machines edit the same file in the same second? Probably not — it's rare and merge-conflicts would surface via the existing memory protocol.
5. **Anthropic feature request.** Is "MCP-backed memory" a sensible Claude Code feature to ask for, or is the shim the long-term answer? File the request anyway; even a no answers the question.

## References

- [Pillar 0 — Tenant abstraction](pillar-0-tenant-abstraction.md) — the schema scoping discipline this proposal inherits
- [`platform/api/memory/lance.py`](../../platform/api/memory/lance.py) — the LanceDB layer this proposal wraps
- [`render.yaml`](../../render.yaml) — the persistent disk provisioning
- [MCP specification](https://spec.modelcontextprotocol.io/) — the protocol the server speaks
- [Project memory: cross-machine gap](../../C:/Users/Liz/.claude/projects/c--Users-Liz-Make-Skills/memory/project_memory_cross_machine_gap.md) — the user-facing context this proposal solves
- [docs/assets/2026-05-21-project-starter-recommendations.md](https://github.com/Lizo-RoadTown/project-starter) — the project-starter handoff doc mentioning this proposal as forthcoming
