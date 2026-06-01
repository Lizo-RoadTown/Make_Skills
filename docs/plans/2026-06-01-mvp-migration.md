# MVP migration plan — `platform/api/` → root-level `core/` + `adapters/` + `services/`

**Date:** 2026-06-01
**Status:** Ratified by Liz on 2026-06-01. Phase 0 (PROBE) complete; Phases 1-5 are planned, not executed.
**Companion to:** [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](../proposals/2026-05-31-three-layer-engine-spec.md) (defines the target shape).

## Decision (ratified)

> **Staged migration toward root-level `core/`, `adapters/`, and `services/`.**
> **Do not perform a big-bang move.**
> **`platform/api/main.py` stays the runtime entrypoint until consumers + tests + deploy are mapped.**
> **Old LanceDB memory MCP is deprecated, not deleted, until proof it's unused.**
> **Compatibility-first: move toward clean architecture without breaking active consumers.**

Final ownership division (re-stated for clarity, with the boundary-language guard Liz added on 2026-06-01):

- **Make_Skills owns:** reusable agency-to-structure core, project-type adapters, local skill/workflow candidate generation, runtime loop, skill compilation
- **Make_Skills owns local agency-pattern detection** inside a project instance. **The-loom owns cross-project structure recognition, promotion governance, and canonical durable structure.**
- **the-loom owns:** cross-project memory, project registry, project observatory, policy/promotion governance, canonical durable structure

The anchor sentence Liz wants preserved across every agent reading this plan:

> **Make_Skills improves local agency and produces candidates. The-loom observes across projects, governs promotion, and stores durable structure.**

## Phase 0 — PROBE (complete, 2026-06-01)

Findings from probing the current state:

### 0.1 Import graph (`platform/api/`)

`platform/api/main.py:67-76` is the central hub — imports from `api.agent`, `api.auth`, `api.db`, `api.runtime`, `api.tenant_context`, `api.memory.lance` (3 funcs), `api.memory.recorder`, `api.roadmap.file`.

Other entanglements:

- `platform/api/observability.py:22` — imports `api.memory.lance.get_table` (observability tangled with memory)
- `platform/api/auth.py:34` — imports `DEFAULT_TENANT_ID` from `api.migrations`
- `platform/api/tenant_context.py:22` — same
- `platform/api/runtime.py:29-30` — imports from `api.auth`, `api.db`
- `platform/api/secrets.py:22-23` — imports from `api.auth`, `api.db`
- `platform/api/memory/recall.py:20-21` — imports from `api.memory.lance`, `api.migrations`
- `platform/api/memory/recorder.py:22` — imports from `api.memory.lance`
- `platform/api/provider_inspector.py:12` — imports from `api.model_registry`
- `platform/api/roadmap/tools.py:14` — imports from `api.roadmap.file`

**Key observation:** all imports use the `api.*` prefix (not `platform.api.*`). The `platform/api/` directory must be on the Python path with `api` as its package name. This means we can keep the `api` package name even if its location changes — old imports continue to work.

### 0.2 Tests importing `platform.api.*`

`platform/tests/` has 4 test files; all use `from api.<module>`:

- `test_memory_mcp.py:25` — `from api.memory import lance, mcp_server`
- `test_memory_mcp_hosted.py:58-59,92` — imports `api.main:app`, `api.memory.mcp_server`, `api.memory.mcp_http`
- `test_memory_shim.py:31` — `from api.memory import lance, mcp_server`
- `test_pillar_0_isolation.py:25` — `from api.memory.lance` (3 functions)

**Implication:** memory-related modules are heavily tested. Moving them needs careful update of these 4 test files. The non-memory modules have no test coverage yet.

### 0.3 `render.yaml` + Dockerfile entrypoint

- `render.yaml`: `dockerfilePath: ./platform/deploy/Dockerfile`, service name `make-skills-api`
- `platform/deploy/Dockerfile` CMD: `exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8001}`

**Implication:** the deploy entrypoint is the string `api.main:app`. As long as the `api` package resolves to a `main.py` exporting `app`, the deploy keeps working — regardless of WHERE `api/` lives on disk.

### 0.4 `humancensys-app` API calls into Make_Skills

PROBE of `humancensys-app/` source (excluding `.next/` build artifacts) found:

- `humancensys-app/lib/threads.ts:7` — `const KEY = "make-skills-threads"` (a localStorage key, NOT an API call)

**Zero actual HTTP calls into Make_Skills from humancensys-app source.** The embedded Hub agent design hasn't shipped yet (per `project_split_state_2026_05_30` memory: "first chat-round-trip with the engine hasn't been smoke-tested since the split").

**Implication:** the API surface is unconstrained today. No live consumer = free hand to reshape endpoint paths. But: this changes the moment humancensys-app actually starts calling the engine, so DON'T defer endpoint decisions indefinitely.

### 0.5 `/mcp/memory` live references

- `platform/api/main.py:1118-1122` — mounts `mcp_http.mount_into(app, path="/mcp/memory")` when `PLATFORM_MODE=hosted`
- `platform/api/memory/mcp_http.py:77` — implements the mount

**Implication:** the old LanceDB-backed `/mcp/memory` is wired into `main.py` but only active in hosted mode. The-loom now provides the equivalent at `https://loom-agent-context.onrender.com/mcp/memory/` with pgvector backing. Per `project_split_state_2026_05_30`: "Make_Skills' memory MCP is BUILT BUT UNUSED — no real writes to migrate."

**Decision (deferred to Phase 4 per ratification):** deprecate, not delete, until confirmed unused.

### 0.6 Roadmap tool ownership

`platform/api/roadmap/` has `file.py` + `tools.py`. The tools use `@tool` from `langchain_core` (skill→tool promotion example from the spec) and edit Make_Skills' own `ROADMAP.md`.

**Implication:** these are Make_Skills-specific dev tooling, not engine capability. They probably DON'T belong in `core/` — they belong in `services/admin/` or stay in place under a `dev-tooling/` directory. **Open decision** for Phase 3.

## Migration phases (Phase 1-5)

Each phase = one PR. Tests pass after each phase. Render deploy stays green.

### Phase 1 — Compatibility-first directory creation

**Goal:** create the target directory structure as EMPTY siblings. No moves yet. Update Python path to recognize both old + new locations.

**What lands:**

```text
Make_Skills/
├── core/                          NEW (empty + README explaining the structure)
│   ├── runtime/                   NEW (empty)
│   ├── skill-making/              NEW (empty)
│   ├── providers/                 NEW (empty)
│   ├── orchestration/             NEW (empty)
│   ├── auth/                      NEW (empty)
│   ├── db/                        NEW (empty)
│   ├── tools/                     NEW (empty)
│   └── observability/             NEW (empty)
├── services/                      NEW (empty + README)
│   ├── api/                       NEW (empty)
│   ├── skill-making/              NEW (empty)
│   └── admin/                     NEW (empty)
├── deprecated/                    NEW (empty + README explaining the policy)
└── platform/                      UNCHANGED
```

**Risk:** zero. Empty directories don't break anything.

**Tests:** existing tests pass unchanged.

**Deploy:** Render entrypoint still `api.main:app` from `platform/api/`. No change.

**PR title:** `chore(scaffold): create target directory structure for MVP migration`

### Phase 2 — Extract low-risk modules

**Status:** ✅ Shipped 2026-06-01 in PR #60 — `feat(core): mvp migration phase 2 — extract low-coupling modules`.

**Goal:** move the modules with the cleanest interfaces first. Use compatibility shims to keep old import paths working.

**Move order (lowest coupling first):**

| Old location | New location | Compatibility shim |
|---|---|---|
| `platform/api/model_registry.py` | `core/providers/model_registry.py` | `platform/api/model_registry.py` → re-exports from `core.providers.model_registry` |
| `platform/api/subagents.py` | `core/orchestration/subagents.py` | same pattern |
| `platform/api/observability.py` | `core/observability/observability.py` (**telemetry emission helpers only — NOT the Project Observatory; that lives in the-loom**) | same pattern |
| `platform/api/tenant_context.py` | `core/auth/tenant_context.py` | same pattern |
| `platform/api/secrets.py` | `core/auth/secrets.py` | same pattern |

**Pattern for each shim file** (kept at old location, prefer named imports over `*`):

```python
"""DEPRECATED shim. Real module at core.<area>.<module>."""
from core.providers.model_registry import (  # noqa: F401
    RECOMMENDED_STARTERS,
    resolve_model,
    supported_providers,
)
```

**Dockerfile update** (`platform/deploy/Dockerfile`): added `COPY core /app/core`, `COPY services /app/services`, `COPY adapters /app/adapters` so the new paths resolve inside the container. The entrypoint `api.main:app` stays as-is until Phase 5. This was a constraint discovered during Phase 2 execution — the original plan assumed Dockerfile changes only happened at Phase 5.

**Tests:** existing tests pass via the shims. Add one new test that imports from the NEW location too.

**Deploy:** unchanged. `api.main:app` still works because `platform/api/main.py` is unchanged.

**Open decision (resolved):** `observability.py` keeps its `from api.memory.lance import get_table` dependency for now. Phase 4 will sever it when memory moves to `deprecated/`. No deeper extract attempted in Phase 2.

**Caveat — git rename history:** because each shim overwrites the old file with a short re-export, git's rename heuristic falls below the 50% similarity threshold. The CHANGELOG entry + PR body carry the audit trail instead.

**PR title:** `feat(core): mvp migration phase 2 — extract low-coupling modules`

### Phase 3 — Isolate skill-making + decide on roadmap

**Goal:** establish the skill-making boundary per the spec doc.

**Moves:**

| Old location | New location |
|---|---|
| `platform/api/skill_compiler.py` | `core/skill-making/compiler.py` |

**New file:**

- `services/skill-making/bridge_receiver.py` — stub for receiving Path A candidates from the-loom over the skill-making bridge (per `2026-05-25-skill-making-bridge.md`)

**Decision needed on `platform/api/roadmap/`:**

| Option | Rationale |
|---|---|
| A. Move to `services/admin/roadmap/` | If roadmap tools are admin-side dev tooling (only used by the engine to maintain its own ROADMAP.md) |
| B. Stay in place; move only when needed | Lowest risk; tools currently work |
| C. Move to `core/tools/roadmap/` | If roadmap is a generic skill→tool promotion example we want to keep highlighted |

**Recommendation:** Option B (stay in place). Roadmap tools are Make_Skills-specific dev tooling that may eventually move to `services/admin/` but don't need to in this migration.

**PR title:** `refactor: isolate skill-making + create services/skill-making bridge stub`

### Phase 4 — Deprecate LanceDB memory MCP

**Goal:** mark the old `/mcp/memory` route + the LanceDB memory module as deprecated. Don't delete.

**Dependency audit FIRST** (before any move):

1. Confirm humancensys-app doesn't call `/mcp/memory` on Make_Skills — Phase 0 PROBE shows zero calls today. Re-confirm at Phase 4 time.
2. Confirm no other consuming projects call it (SDE_Extraction, Hub — neither does).
3. Confirm the-loom's pgvector MCP fully replaces the functionality.
4. Confirm all four memory-related tests can be updated or skipped.

**If audit passes:**

```text
platform/api/memory/    → moved verbatim to deprecated/lancedb-memory/
                          with a README explaining: "Superseded by the-loom MCP at
                          https://loom-agent-context.onrender.com/mcp/memory/. Kept
                          for reference until <date>. Do not import from here."
```

`platform/api/main.py` updates to remove the mount + the imports (already conditional on `PLATFORM_MODE=hosted` so this only affects hosted deploys).

`platform/tests/test_memory_mcp*.py` and `test_pillar_0_isolation.py` and `test_memory_shim.py` either:

- Move to `deprecated/lancedb-memory/tests/` (kept as historical record)
- Or get archived to a `tests/_legacy/` folder
- Or get deleted with a note in CHANGELOG

**Recommendation:** archive in `deprecated/lancedb-memory/tests/`. Don't delete.

**Render deploy impact:** the `memory-data` persistent disk in `render.yaml` can be marked for removal in a follow-up Render dashboard change after this PR ships. The disk persists for now (cheap, harmless).

**PR title:** `chore(deprecate): retire LanceDB memory MCP — superseded by the-loom MCP`

### Phase 5 — Move runtime + main, update deploy

**Goal:** the last + highest-risk phase. Moves `main.py`, `agent.py`, `runtime.py`, `auth.py`, `db.py` to their target locations. Updates Dockerfile + render.yaml.

**Pre-Phase-5 gate (added per Liz's ratification 2026-06-01):**

Before Phase 5 begins, a real consumer of Make_Skills' API must exist — either:

- **(a) `humancensys-app` is making actual HTTP calls into Make_Skills** (the original consumer; if it's ready, use it)
- **(b) A minimal smoke-test consumer exists** — a small script or test harness that hits the engine's actual endpoints (e.g., `POST /chat/{agent_id}`) and verifies they respond correctly. Lives in `scripts/smoke-test-consumer.py` or similar.

**Why:** Phase 5 reshapes the runtime entrypoint. Without a real consumer exercising the endpoints, we can't validate that the migration didn't break the API surface. **But don't block indefinitely on humancensys-app's production readiness** — if it's not ready when Phase 4 lands, create the smoke-test consumer (option b) so Phase 5 can proceed.

**Moves:**

| Old location | New location |
|---|---|
| `platform/api/main.py` | `services/api/main.py` |
| `platform/api/agent.py` | `core/runtime/agent.py` |
| `platform/api/runtime.py` | `core/runtime/runtime.py` |
| `platform/api/auth.py` | `core/auth/auth.py` |
| `platform/api/db.py` | `core/db/db.py` |
| `platform/api/migrations.py` | `core/db/migrations.py` |

**Dockerfile change** (`platform/deploy/Dockerfile`):

```diff
- CMD ["sh", "-c", "exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
+ CMD ["sh", "-c", "exec uvicorn services.api.main:app --host 0.0.0.0 --port ${PORT:-8001}"]
```

**`render.yaml` change:** none required if the Dockerfile change is correct (Render uses the Dockerfile).

**Test imports:** all 4 test files (in `platform/tests/`) need updating from `from api.<module>` to `from services.api.main` or `from core.<area>.<module>`. Can be automated with a single search-and-replace.

**Compatibility shims at `platform/api/`:** all become thin re-exports pointing at the new locations. Mark with `# DEPRECATED — remove after <date>`.

**Test plan for this PR:**

- [ ] `docker compose up -d --build` boots the api service locally
- [ ] `curl http://localhost:8001/healthz` returns 200
- [ ] All non-memory tests pass
- [ ] Memory-related tests pass against the deprecated/ location (or are skipped with `pytest.mark.skip`)
- [ ] Render preview deploy from PR branch succeeds
- [ ] After merge: production Render deploy succeeds
- [ ] After merge: existing skills + subagents still load (they reference engine internals via the `@tool` decorator path)

**Risk:** highest of any phase. Defer until Phases 1-4 are merged + stable. Phase 5 is the "commitment" phase.

**PR title:** `refactor!: complete MVP migration — runtime + entrypoint to services/api/, core/`

## Per-phase risk + rollback

| Phase | Risk | Rollback |
|---|---|---|
| 1 — scaffold | Zero | Delete the empty directories |
| 2 — extract low-coupling | Low | Revert PR; shims preserve old imports |
| 3 — skill-making + roadmap decision | Low-medium | Revert PR; skill_compiler.py back to old location |
| 4 — deprecate memory | Medium | Restore from `deprecated/` if a consumer surfaces |
| 5 — runtime + main + deploy | High | Revert PR + Render rollback to prior deploy |

## Constraints throughout (ratified)

- **No big-bang move.** Each phase is its own PR. Tests pass between PRs.
- **Compatibility shims at every old location** until consumers are confirmed migrated.
- **Deprecate before delete.** `deprecated/` keeps the artifact + a README until proof-of-unused stabilizes.
- **No endpoint URL changes** until humancensys-app's actual API consumption is known. Endpoint paths today are not load-bearing because humancensys-app makes zero calls (per Phase 0.4 finding).
- **PROBE before each phase.** Re-run the relevant Phase 0 audit at the start of each phase to confirm assumptions still hold.

## Resolved decisions (per Liz, 2026-06-01)

All four open decisions are resolved. Captured here for execution.

| Decision | Resolution | Reason |
|---|---|---|
| **Roadmap tools home** (Phase 3) | **Option B — stay in place** | Not worth moving during core migration; they're Make_Skills-specific dev tooling, low priority |
| **Test archival strategy** (Phase 4) | **`deprecated/lancedb-memory/tests/`** | Keeps old memory tests beside the deprecated module they cover |
| **`platform/` final state** (post-Phase 5) | **Keep `platform/deploy/`, retire the rest** | Deployment artifacts (Dockerfile) can stay under `platform/deploy/` until a later cleanup |
| **Phase 5 timing** | **After a real consumer exists** (humancensys-app actual calls OR a smoke-test consumer at minimum). **Don't block indefinitely on humancensys-app readiness** — create the smoke-test consumer if needed. | Real validation required, but the migration can't stall waiting for production app readiness |

## Estimated effort

- Phase 1 (scaffold): ~30 min
- Phase 2 (low-coupling extract): ~2-3 hours including tests
- Phase 3 (skill-making + roadmap): ~1-2 hours
- Phase 4 (deprecate memory): ~2-3 hours including audit
- Phase 5 (runtime + main + deploy): ~3-4 hours including deploy verification

Total: ~9-13 hours of focused work, spread across multiple sessions. Each phase is a clean stopping point.

## Cross-references

- [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](../proposals/2026-05-31-three-layer-engine-spec.md) — the target shape this plan migrates toward
- [`docs/proposals/2026-05-25-skill-making-bridge.md`](../proposals/2026-05-25-skill-making-bridge.md) — what Phase 3's `services/skill-making/` needs to receive
- [`adapters/README.md`](../../adapters/README.md) — Layer 2 (already stubbed in PR #56)
- [`project_split_state_2026_05_30`](loom-memory MCP) — the source of the "humancensys-app makes no calls yet" claim
