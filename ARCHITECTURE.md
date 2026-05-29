# Architecture — Make_Skills (the engine)

This document draws the **clean lines** between layers and modes inside the engine. Every change from 2026-04-28 onward MUST consider both modes (self-host and hosted-multitenant), with documentation and tests for both.

If you're a contributor: this is the map. If you're an agent: read this before structural changes.

The engine has no frontend. Frontends live in separate consumer repos (the first one is [`Lizo-RoadTown/humancensys-app`](https://github.com/Lizo-RoadTown/humancensys-app)). See [`docs/proposals/make-skills-engine-vs-consumer-scope.md`](docs/proposals/make-skills-engine-vs-consumer-scope.md) for the engine/consumer boundary.

---

## Two deployment modes (always supported, parallel)

### Self-host (single-tenant, default)

A user clones the engine repo, runs `docker compose up`, has a fully functional personal agent platform. No auth. No tenant boundaries. All data on their machine. Consumer UI is optional — they can hit the engine directly with curl/HTTP clients or run a consumer locally.

```text
[consumer app, optional]  -->  localhost:8000  -->  platform/api/ (FastAPI)
                                                       |
                                                       v
                                                    postgres + LanceDB (Docker)
```

### Hosted multi-tenant

The same engine code runs as a hosted service. A consumer (e.g., humancensys-app deployed on Vercel) sits in front with its own auth and identity. Each consumer-issued JWT carries a `tenant_id`; the engine verifies the JWT (`AUTH_SECRET` shared with the consumer) and scopes all queries by tenant.

```text
[consumer's users]  -->  consumer (e.g., humancensys.com on Vercel)
                            |
                            | HTTPS + JWT (HS256 via AUTH_SECRET)
                            v
                          api.humancensys.com  -->  platform/api/
                                                       | tenant_id from JWT
                                                       v
                                                    postgres (tenant_id column, RLS)
                                                    LanceDB (tenant_id field)
```

**The same engine code runs both modes.** Mode is determined by env vars (`PLATFORM_MODE`) and auth presence, not by separate codepaths.

---

## Layered architecture (the clean lines)

Five layers, each with explicit ownership and contribution rules.

### Layer 1: Engine code (always shared)

**What:** the agent runtime, the API, generic tools, the skill compilation pipeline.

**Lives in:** `platform/api/`, `subagents/<name>/AGENTS.md` *templates*, `skills/_upstream/`, the agent build code.

**License:** Apache 2.0.

**Contribution rule:** PRs welcome. Must work in both modes. Must include tests for both. Tenant-scoping is mandatory — never write a query without a `tenant_id` filter (in hosted mode it's the auth context; in self-host it's a constant `"default"`).

### Layer 2: Tenant identity & isolation (mode-dependent)

**What:** who's making this request, what data are they allowed to see.

**Self-host:** trivial. `tenant_id = "default"`, `user_id = "local"`. No auth code path executes.

**Hosted:** real auth. `tenant_id` comes from a verified JWT signed by the consumer. Storage queries inherit it via the `tenant_ctx_var` ContextVar.

**Contribution rule:** the auth interface is pluggable. Two implementations ship: `NoAuthBackend` (self-host) and a JWT-bridge backend (hosted, in `platform/api/auth.py` + `platform/api/memory/auth_bridge.py`). New auth backends are welcome but must satisfy the same interface contract.

### Layer 3: Tenant configuration (per-tenant, user-editable)

**What:** the tenant's persona, their subagents, their model choices, their skill allowlist.

**Self-host:** filesystem. `AGENTS.md`, `deepagents.toml`, `subagents/<name>/`, `skills/<name>/` at the repo root. Edit in VS Code. Git-tracked if the user chooses.

**Hosted:** stored as files in a per-tenant directory OR rows in Postgres OR both. The consumer's UI is responsible for editing forms; the engine just exposes config CRUD endpoints. NOT git-tracked (a contributor's PR must never alter a tenant's config).

**Contribution rule:** engine code must read config through an abstraction (`config_loader.load_tenant_config(tenant_id)`), never via direct filesystem reads.

### Layer 4: Tenant data (per-tenant, isolated, never shared without explicit publish)

**What:** conversations, semantic memory, knowledge graph canon, roadmap, project tags.

**Storage scoping:**

| Data | Storage | Self-host scoping | Hosted scoping |
|------|---------|-------------------|----------------|
| Conversation checkpoints | Postgres (`langgraph` tables) | `thread_id` only | `thread_id` + `tenant_id` |
| Semantic memory | LanceDB | one table | one table with `tenant_id` field + RLS-style filters |
| Knowledge graph | TBD (Pillar 3c discussion pending) | per-tenant by default | per-tenant by default |

**Contribution rule:** any new data type added MUST declare its tenant scope at design time. PRs without a tenant-scoping decision will be rejected.

### Layer 5: Publishable content (opt-in shared)

**What:** skills, agents, knowledge graph nodes the user explicitly chooses to share.

**Self-host:** no publish surface (it's just you). Users contribute by upstreaming to the project repo or to the public skills marketplace.

**Hosted:** a "publish" action moves an item from tenant-private to platform-shared. Includes versioning and attribution. The publish endpoint lives on the engine; the consumer's UI surfaces it.

**Contribution rule:** the publish path is opt-in only. Default is private.

---

## Repo strategy

**The engine is its own repo** as of 2026-05-26 (PR #52). Consumer code lives in separate repos.

```text
Make_Skills/                       (this repo — the engine)
├── platform/
│   ├── api/                        Layer 1: engine code (Python)
│   │   ├── memory/                 LanceDB tenant-scoped MCP server
│   │   ├── auth.py                 JWT verification + tenant resolution
│   │   └── model_registry.py       Multi-provider model registry
│   ├── deploy/                     Docker + Render config
│   └── README.md
├── skills/                         Curated skills (Layer 1 — distributed with engine)
│   ├── _upstream/                  Anthropic + community skills (gitignored, synced)
│   └── <name>/
├── subagents/                      Layer 1 templates (also extractable)
├── chatgpt/, copilot/, vs_code/    Engine integrations for other AI clients
├── scripts/                        Engine tooling
├── docs/
│   ├── proposals/                  Architecture decisions
│   ├── plans/                      Time-bounded execution plans
│   ├── runbooks/                   Operational guides
│   └── test-runs/                  Friction-surface logs
├── AGENTS.md                       Layer 3 — DEFAULT tenant config (overridable per-tenant)
├── deepagents.toml                 Layer 3 — DEFAULT tenant config
├── ROADMAP.md                      Engine roadmap
├── ARCHITECTURE.md                 (this file)
├── CONTRIBUTING.md                 Contribution rules per layer
├── render.yaml                     Render Blueprint for engine deploy
└── LICENSE                         Apache 2.0
```

Consumers live in separate repos:

- [`Lizo-RoadTown/humancensys-app`](https://github.com/Lizo-RoadTown/humancensys-app) — student-facing consumer (Next.js + Auth.js + lesson content)
- Future health-app, game-app, etc.

**Hard rule:** the engine doesn't import from any consumer. Consumers call the engine over HTTPS + MCP, never as a Python module. This is what made the 2026-05-26 split painless.

---

## Two-mode discipline (every PR going forward)

### What "considers both modes" means

A PR is incomplete unless it answers:

1. **What changes for self-host?** Does the user need to update env vars, rebuild, run a migration?
2. **What changes for hosted-multitenant?** Same questions, plus: does it touch tenant scoping?
3. **Tests:** does it have unit tests AND integration tests covering both modes? At minimum: a test that exercises the change with `tenant_id = "default"` (self-host) and one with a synthetic non-default `tenant_id` (hosted).
4. **Docs:** does the doc explain how it appears in both modes?

### What this looks like in practice

- A new endpoint in `platform/api/main.py` includes `tenant_id` from a `Depends(current_tenant)` dependency. In self-host, the dependency returns `"default"`. In hosted, it returns the auth-derived value.
- A new tool that queries data filters by `tenant_id` always. Tests verify a tenant can't see another tenant's data.
- A new engine API surface is documented in the consumer-integration runbook so consumer authors know how to wire it.

### Anti-patterns to reject in PRs

- Hardcoded paths or queries without tenant scoping
- "We'll add multi-tenancy later" — too late once data is being written
- Code that reads tenant config from a hardcoded filesystem path (must go through `config_loader`)
- Tests that only cover self-host mode

---

## Mode detection

The engine decides its mode from a single env var:

```bash
PLATFORM_MODE=self_host    # or "hosted"
```

`platform/api/auth.py` reads this and selects the auth backend at startup. All other tenant-aware code calls `_resolve_tenant()` / reads `tenant_ctx_var` and gets the right thing back regardless of mode.

---

## Open questions

1. **Subdomain or path routing for tenants in hosted mode** — `<tenant>.humancensys.com` (cleaner URLs, more DNS work) or `humancensys.com/<tenant>` (simpler routing)? Decided per-consumer; engine doesn't care.
2. **Tenant config storage in hosted mode** — files in S3/blob storage, rows in postgres, or both?
3. **Knowledge graph cross-tenant posture** — strict silo (default), opt-in publish, federated? (Pillar 3c discussion.)
4. **Skill-making bridge contract with the-loom** — how does the engine accept promotion candidates from the-loom's architecture-registry? Detailed spec pending.

---

## What's already aligned with this architecture

- ✓ `platform/api/` is one module, no cross-imports from consumers
- ✓ JWT contract documented and shipped (HS256 via `AUTH_SECRET`)
- ✓ Skills loaded from filesystem path (abstraction-friendly — easy to swap to per-tenant loader)
- ✓ LanceDB lives in a directory mountable per-tenant; tenant_id field on every row
- ✓ `render.yaml` deploys the engine independently
- ✓ Memory MCP exists with stdio (self-host) + hosted-HTTP transports
- ✓ Engine/consumer split done (PR #52)

## What needs to change next

- **Tenant abstraction refinement** — auth.py + auth_bridge.py share too much logic; refactor for one clean tenant-resolution path
- **Config loader abstraction** — `FilesystemConfigLoader` for self-host, stub `MultiTenantConfigLoader` for hosted
- **Per-module READMEs** in `platform/`, `skills/` describing contribution surface
- **Consumer-integration runbook** — explicit doc for consumer authors (humancensys-app and future) wiring against the engine
- **Skill-making bridge** — the contract with the-loom for promotion candidates

These are the next architectural milestones.
