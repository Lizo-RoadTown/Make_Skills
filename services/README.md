# `services/` — API + admin surfaces

**Status:** Phase 1 scaffold (empty). Code lives at `platform/api/` today; the FastAPI entrypoint moves here in Phase 5 of the migration plan.

`services/` is where Make_Skills exposes its capabilities OUTWARD — HTTP endpoints consuming projects call, bridge receivers for cross-platform integrations, admin/inspection surfaces.

This is **NOT** the same as the-loom's services. The-loom is a separate repo + separate Render deploys; its services live in [`the-loom/services/`](https://github.com/Lizo-RoadTown/the-loom/tree/main/services). Make_Skills' services run inside the Make_Skills Docker container.

## Subdirectories (planned)

| Dir | Purpose | Status |
|---|---|---|
| [`api/`](api/) | FastAPI entry — `services.api.main:app` becomes the uvicorn target after Phase 5. Houses HTTP endpoints consuming projects call (chat, agent management, skill catalog reads). | Phase 5 |
| [`skill-making/`](skill-making/) | Receives promotion candidates from the-loom's Architecture Registry over the skill-making bridge (per [`../docs/proposals/2026-05-25-skill-making-bridge.md`](../docs/proposals/2026-05-25-skill-making-bridge.md)). Dispatches to `core/skill-making/` for compilation. Sends registration acks back to the-loom. | Phase 3 (stub) → post-Phase-5 (real) |
| [`admin/`](admin/) | Inspectors + dev tooling (e.g., `mcp_inspector.py`, `provider_inspector.py`, `fileviewer.py` from current `platform/api/`). Internal endpoints, not consumer-facing. | Phase 5 |

## How this differs from `core/`

| `core/` | `services/` |
|---|---|
| Universal engine logic (model-agnostic, project-type-agnostic, transport-agnostic) | The transport + integration surface |
| Imported by `services/` | Imports from `core/` |
| No HTTP routes; no FastAPI app | Owns HTTP routes + the FastAPI `app` |
| No bridge protocol awareness | Owns the skill-making bridge receiver |

## Migration status

| Phase | What moves into `services/` |
|---|---|
| 3 | `services/skill-making/bridge_receiver.py` stub for the the-loom integration |
| 5 | `platform/api/main.py` → `services/api/main.py` (the uvicorn target) |
| 5 | `platform/api/mcp_inspector.py`, `provider_inspector.py`, `fileviewer.py` → `services/admin/` |

See [`../docs/plans/2026-06-01-mvp-migration.md`](../docs/plans/2026-06-01-mvp-migration.md).
