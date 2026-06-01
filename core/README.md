# `core/` — Layer 1 of the three-layer engine

**Status:** Phase 1 scaffold (empty). Code lives at `platform/api/` today; Phase 2-5 of the migration plan moves it here.

Per [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](../docs/proposals/2026-05-31-three-layer-engine-spec.md), the recursive skill engine has three layers:

1. **Reusable core engine (Layer 1)** — **this directory** (when populated)
2. **Project-type adapters (Layer 2)** — [`../adapters/`](../adapters/)
3. **Project-local instances (Layer 3)** — each consuming project's `.project-intelligence/<instance-id>/`

## What the core owns

| Responsibility | Description |
|---|---|
| Per-turn agent loop | Receive request → recall memory → call model → tool use → stream response → emit telemetry → write memory |
| Local pattern detection | Watch project-local instance request shapes; detect 3+ recurrence |
| Skill candidate generation | When pattern detection fires, build a SKILL.md draft + metadata into the instance's `promotion-candidates/` |
| Skill compilation | Take a ratified SKILL.md from the-loom bridge → runnable CompiledSkill |
| Recursive skill execution | Load CompiledSkills into runtime agent's tool/skill registry |
| Multi-agent orchestration | Compose subagents (planner + researcher + writer + reviewer; etc.) |
| Memory MCP client | Read/write to the-loom's Agent Context Service via `mcp__loom-memory__*` |
| Project Registry client | Read project metadata from the-loom's Project Registry |
| Telemetry emitter | OTLP push to the-loom's Project Observatory (structural metadata only, no PII) |
| Promotion candidate submitter | Submit Path A candidates to the-loom's Architecture Registry over the skill-making bridge |

The core is **stateless about cross-project knowledge**. It calls into the-loom for everything durable.

## Subdirectories (planned)

| Dir | Purpose |
|---|---|
| [`runtime/`](runtime/) | Per-turn agent loop, request dispatch, response streaming |
| [`skill-making/`](skill-making/) | Skill compilation pipeline (SKILL.md → CompiledSkill) |
| [`providers/`](providers/) | Multi-model provider registry (Anthropic, OpenAI, Google, Ollama, etc.) |
| [`orchestration/`](orchestration/) | Subagent composition, multi-agent patterns |
| [`auth/`](auth/) | JWT verification, tenant resolution (`tenant_ctx_var`) |
| [`db/`](db/) | Postgres connection, migrations |
| [`tools/`](tools/) | Generic agent tools (e.g., DB query tool) |
| [`observability/`](observability/) | Telemetry emission helpers ONLY. The Project Observatory itself lives in **the-loom**, NOT here. |

## What's NOT here

- **Memory storage** — the-loom Agent Context Service owns this; the core uses the MCP client to read/write
- **Project Registry** — the-loom owns this
- **Project Observatory (the surface)** — the-loom owns this; `core/observability/` only contains the emission-side helpers
- **Pattern detection across projects** — the-loom Architecture Registry owns cross-project recognition; `core/` only handles LOCAL detection within one instance
- **Promotion governance** — the-loom Policy + Architecture Registry; the core submits candidates, doesn't ratify them
- **Per-project adapters** — they live in [`../adapters/<type>/`](../adapters/) (Layer 2)
- **Project-local instance state** — lives in each consuming project's `.project-intelligence/`, NOT here

## Migration status

| Phase | Status | What lands |
|---|---|---|
| 1 — scaffold | **THIS PR** | Empty directories + READMEs |
| 2 — low-coupling extracts | pending | `model_registry.py` → `core/providers/`, `subagents.py` → `core/orchestration/`, `observability.py` → `core/observability/`, `tenant_context.py` → `core/auth/`, `secrets.py` → `core/auth/`. Compatibility shims at old paths. |
| 3 — skill-making | pending | `skill_compiler.py` → `core/skill-making/compiler.py` |
| 4 — deprecate LanceDB memory | pending | `platform/api/memory/` → `deprecated/lancedb-memory/` (no move into core/) |
| 5 — runtime + main | pending | `agent.py` + `runtime.py` → `core/runtime/`, `auth.py` → `core/auth/`, `db.py` + `migrations.py` → `core/db/`, `main.py` → `services/api/main.py` (NOT `core/`) |

See [`../docs/plans/2026-06-01-mvp-migration.md`](../docs/plans/2026-06-01-mvp-migration.md) for the full plan.
