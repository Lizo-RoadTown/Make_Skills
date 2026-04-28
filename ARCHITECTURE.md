# Architecture — Make_Skills

This document draws the **clean lines** between layers and modes. Every change to this codebase from 2026-04-28 onward MUST consider both modes (self-host and hosted-multitenant), with documentation and tests for both.

If you're a contributor: this is the map. If you're an agent: read this before structural changes.

---

## Two deployment modes (always supported, parallel)

### Self-host (single-tenant, default)

A user clones the repo, runs `docker compose up`, has a fully functional personal agent platform. No auth. No tenant boundaries. All data on their machine. Contribution-friendly: they can fork, modify, run.

```
[user] → localhost:3000 → web/ (Next.js)
                            ↓ HTTP
                          localhost:8001 → platform/api/ (FastAPI)
                                              ↓
                                            postgres + LanceDB (Docker)
```

### Hosted multi-tenant (humancensys.com — Liz operates)

The same code runs at humancensys.com, but with auth in front, per-tenant data isolation, and shared infrastructure. Users sign up, each gets an isolated workspace. Bring-your-own API key.

```
[users] → humancensys.com → web/ (Next.js on Vercel)
                              ↓ HTTPS + auth
                            api.humancensys.com → platform/api/
                                                    ↓ tenant_id from auth
                                                  postgres (tenant_id column)
                                                  LanceDB (tenant_id field)
```

**The same code runs both modes.** Mode is determined by env vars and auth presence, not by separate codepaths.

---

## Layered architecture (the clean lines)

Five layers, each with explicit ownership and contribution rules.

### Layer 1: Platform code (always shared)

**What:** the agent runtime, the API, the UI shell, generic tools.

**Lives in:** `platform/api/`, `web/`, `subagents/<name>/AGENTS.md` *templates*, `skills/_upstream/`, the agent build code.

**Open-source license:** TBD (decision needed — see "Open questions").

**Contribution rule:** PRs welcome. Must work in both modes. Must include tests for both. Tenant-scoping is mandatory — never write a query without a `tenant_id` filter (in hosted mode it's the auth context; in self-host it's a constant `"default"`).

### Layer 2: Tenant identity & isolation (mode-dependent)

**What:** who's making this request, what data are they allowed to see.

**Self-host:** trivial. `tenant_id = "default"`, `user_id = "local"`. No auth code path executes.

**Hosted:** real auth. `tenant_id` comes from a verified token. Storage queries inherit it.

**Contribution rule:** the auth interface is pluggable. Two implementations ship: `NoAuthBackend` (self-host) and `OAuthBackend` (hosted). New auth backends are welcome but must satisfy the same interface contract.

### Layer 3: Tenant configuration (per-tenant, user-editable)

**What:** the tenant's persona, their subagents, their model choices, their skill allowlist.

**Self-host:** filesystem. `AGENTS.md`, `deepagents.toml`, `subagents/<name>/`, `skills/<name>/` at the repo root. Edit in VS Code. Git-tracked if user chooses.

**Hosted:** stored as files in a per-tenant directory, OR rows in postgres, OR both. Edit through the UI (forms or AGENTS.md textarea). NOT git-tracked (separation of platform code from tenant config is critical for contribution — a contributor's PR must never alter a tenant's config).

**Contribution rule:** platform code must read config through an abstraction (`config_loader.load_tenant_config(tenant_id)`), never via direct filesystem reads. The abstraction's two implementations: `FilesystemConfigLoader` (self-host) and `MultiTenantConfigLoader` (hosted).

### Layer 4: Tenant data (per-tenant, isolated, never shared without explicit publish)

**What:** conversations, semantic memory, knowledge graph canon, roadmap, project tags.

**Storage scoping:**

| Data | Storage | Self-host scoping | Hosted scoping |
|------|---------|-------------------|----------------|
| Conversation checkpoints | Postgres (`langgraph` tables) | `thread_id` only | `thread_id` + `tenant_id` |
| Semantic memory | LanceDB | one table | one table per tenant OR `tenant_id` field |
| Roadmap | `ROADMAP.md` | repo root | per-tenant directory |
| Knowledge graph | TBD (3c discussion pending) | per-tenant by default | per-tenant by default |

**Contribution rule:** any new data type added MUST declare its tenant scope at design time. PRs without a tenant-scoping decision will be rejected.

### Layer 5: Publishable content (opt-in shared)

**What:** skills, agents, knowledge graph nodes the user explicitly chooses to share.

**Self-host:** no publish surface (it's just you). Users contribute by upstreaming to the project repo.

**Hosted:** a "publish" button on a skill / agent / KG node moves it from tenant-private to platform-shared. Includes versioning and attribution.

**Contribution rule:** the publish path is opt-in only. Default is private. UI surfaces sharing prominently AFTER an item exists, never as part of creation.

---

## Repo strategy

**Monorepo for now**, with explicit module boundaries that allow splitting later.

```
Make_Skills/                       (root)
├── platform/                       ← will likely become its own repo: make-skills-platform
│   ├── api/                        Layer 1: platform code (Python)
│   ├── deploy/                     Docker + Render config
│   └── README.md                   Per-module contribution guide
├── web/                            ← will likely become its own repo: make-skills-web
│   ├── app/                        Layer 1: platform code (Next.js)
│   ├── components/
│   └── README.md                   Per-module contribution guide
├── skills/                         ← will likely become its own repo: make-skills-skills
│   ├── _upstream/                  Anthropic + community skills (gitignored, synced)
│   ├── <name>/                     Curated skills (Layer 1 — distributed with platform)
│   └── README.md                   Per-module contribution guide
├── subagents/                      Layer 1 templates (also extractable)
├── AGENTS.md                       Layer 3 — DEFAULT tenant config (overridable per-tenant)
├── deepagents.toml                 Layer 3 — DEFAULT tenant config (overridable per-tenant)
├── ROADMAP.md                      Layer 4 — Liz's tenant data (in self-host this IS hers)
├── ARCHITECTURE.md                 (this file) — platform-wide
├── CONTRIBUTING.md                 Contribution rules per layer
└── LICENSE                         TBD
```

**Why monorepo first:**

- Single PR can update code + docs across modules
- Faster iteration while the foundation hardens
- Splitting prematurely is harder to undo than splitting later

**Triggers for splitting:**

- A module grows independent contributors who don't care about other modules
- Release cadence diverges (e.g., `web/` ships independently)
- Licensing differs (e.g., platform AGPL, skills MIT)

**Hard rule:** modules don't import across boundaries. `web/` calls `platform/api/` over HTTP, never imports from it. `skills/` are read by `platform/api/` through the SkillsMiddleware abstraction, never imported as Python modules. This is what allows clean splitting later.

---

## Two-mode discipline (every PR going forward)

### What "considers both modes" means

A PR is incomplete unless it answers:

1. **What changes for self-host?** Does the user need to update env vars, rebuild, run a migration?
2. **What changes for hosted-multitenant?** Same questions, plus: does it touch tenant scoping?
3. **Tests:** does it have unit tests AND integration tests covering both modes? At minimum: a test that exercises the change with `tenant_id = "default"` (self-host) and one with a synthetic non-default `tenant_id` (hosted).
4. **Docs:** does the user-facing doc explain how it appears in both modes?

### What this looks like in practice

- A new endpoint in `platform/api/main.py` includes `tenant_id` from a `Depends(current_tenant)` dependency. In self-host, the dependency returns `"default"`. In hosted, it returns the auth-derived value.
- A new tool that queries data filters by `tenant_id` always. Tests verify a tenant can't see another tenant's data.
- A new UI page reads from an endpoint that already does tenant scoping. UI itself is mode-agnostic.

### Anti-patterns to reject in PRs

- Hardcoded paths or queries without tenant scoping
- "We'll add multi-tenancy later" — too late once data is being written
- Code that reads tenant config from a hardcoded filesystem path (must go through `config_loader`)
- Tests that only cover self-host mode

---

## Mode detection

The platform decides its mode from a single env var:

```bash
PLATFORM_MODE=self_host    # or "multitenant"
```

`platform/api/auth.py` (TBD) reads this and selects the auth backend at startup. All other tenant-aware code calls `get_current_tenant()` and gets the right thing back regardless of mode.

---

## Open questions (need Liz's input before code)

1. **License** — MIT, Apache 2.0, or AGPL? AGPL forces SaaS hosters (including future you) to open-source their hosting modifications. Trade-off: more contributor-friendly = MIT/Apache; more "the platform stays open even when SaaS'd" = AGPL.
2. **Auth provider for hosted mode** — GitHub OAuth (developer-friendly, free), Clerk (full-featured, ~$25/mo), Auth.js (self-managed)?
3. **Subdomain or path routing for tenants in hosted mode** — `<tenant>.humancensys.com` (cleaner URLs, more DNS work) or `humancensys.com/<tenant>` (simpler routing)?
4. **Tenant config storage in hosted mode** — files in S3/blob storage, rows in postgres, or both?
5. **Knowledge graph cross-tenant posture** — strict silo (default), opt-in publish, federated? (Carries over from earlier discussion.)

---

## What's already aligned with this architecture

- ✓ `platform/api/` is one module, decoupled from web
- ✓ `web/` calls api over HTTP — no Python imports across the line
- ✓ Skills loaded from filesystem path (abstraction-friendly — easy to swap to per-tenant loader)
- ✓ LanceDB lives in a directory mountable per-tenant
- ✓ ROADMAP.md is file-based, easy to make per-tenant later
- ✓ render.yaml deploys the platform module independently

## What needs to change next

- **Tenant abstraction** — `tenant_id` column on relevant postgres tables, field in LanceDB schema, `current_tenant()` dependency in FastAPI
- **Auth interface** — `NoAuthBackend` and a stub `OAuthBackend`
- **Config loader abstraction** — `FilesystemConfigLoader` for self-host, stub `MultiTenantConfigLoader` for hosted
- **CONTRIBUTING.md** — explicit two-mode discipline doc
- **License** — pick one and add `LICENSE`
- **Per-module READMEs** in `platform/`, `web/`, `skills/` describing contribution surface

These don't have to ship today, but they're the next architectural milestones before any new feature.
