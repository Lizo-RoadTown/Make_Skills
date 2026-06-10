# Changelog

All notable changes to Make_Skills are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version-bumps and releases are managed by `release-please`.

## [Unreleased]

### Changed

- **MVP migration Phase 4 — LanceDB memory subsystem deprecated** — Per [`docs/plans/2026-06-01-mvp-migration.md`](docs/plans/2026-06-01-mvp-migration.md) and the skeleton-never-shipped framing saved in memory, the entire LanceDB-backed memory subsystem is removed from the runtime and moved to `deprecated/lancedb-memory/`. Make_Skills no longer self-hosts a memory layer; the-loom MCP at `https://loom-agent-context.onrender.com/mcp/memory/` is canonical for both modes. Specifically:
  - 7 modules moved via `git mv`: `platform/api/memory/{__init__,auth_bridge,lance,mcp_http,mcp_server,recall,recorder}.py` → `deprecated/lancedb-memory/`
  - `platform/api/observability.py` deleted (zero importers after memory endpoints removed)
  - `platform/api/main.py`: 4 import lines, the `MemorySearchRequest` + `IngestRequest` Pydantic models, `/memory/search`, `/memory/records`, `/memory/stats`, `/memory/ingest`, all 6 `/observability/*` endpoints, the `/mcp/memory` HTTP mount, `record_turn` background tasks at 5 sites, and the `session_lifespan` import inside the lifespan all removed. 1122 → 919 lines.
  - `platform/api/agent.py`: `recall` tool removed from `builtin_tools`; comment notes the-loom MCP is the replacement
  - `platform/api/migrations.py`: `migrate_lancedb()` function + its call from `run_all()` removed
  - `platform/requirements.txt`: 6 deps dropped — `lancedb`, `fastembed`, `pyarrow`, `mcp`, `watchdog`, `PyYAML` — all orphaned after the deprecation
  - `render.yaml`: `MEMORY_DATA_DIR` env var + the `disk:` block (`/data/memory`, 1GB) both removed — vestigial Render storage with no consumer
  - `platform/tests/`: 4 test files moved to `deprecated/lancedb-memory/tests/` — `test_memory_mcp.py`, `test_memory_mcp_hosted.py`, `test_memory_shim.py`, `test_pillar_0_isolation.py`
  - `deprecated/lancedb-memory/README.md` added with the audit checklist for eventual `git rm`
  - `.mcp.json`: `loom-memory` MCP server entry added (HTTP transport, points at the-loom)
  - `CLAUDE.md`: 5 edits per the loom agent's diff — CORE DIRECTIVE 1 banner on loom-memory access, engine-stack table updated, "How consumers integrate" section pointed at loom-memory, memory hierarchy promotes loom-memory and strikes out LanceDB, discipline note updated. The doc no longer describes the pre-split architecture.
  - `.gitignore`: `**/__pycache__/` rule confirmed so deprecated module's pycache stays untracked

  External-consumer audit confirmed zero callers of `/mcp/memory` on Make_Skills (humancensys-app, Hub, SDE_Extraction all use the-loom directly). Internal callers in Make_Skills' own code (recall, recorder, REST endpoints, observability, migrations bootstrap) were obsolete scaffolding for a never-shipped product — stripped without ceremony per the skeleton framing.

### Added

- **Three-layer engine spec proposal** (`docs/proposals/2026-05-31-three-layer-engine-spec.md`) — module-spec doc that mirrors `the-loom/docs/proposals/2026-05-25-platform-data-model.md` on the engine side. Codifies the three-layer model Liz + Loom-agent + a third agent ratified on 2026-05-31: reusable core engine + project-type adapters + project-local instances. Defines the core's responsibilities, the adapter contract (manifest.json, watches.json, pattern-triggers.json, system-prompt-fragments, default-skills.json, observatory-events.json), the project-local instance contract, the runtime agent loop, the agency-vs-structure boundary, the two promotion paths (Path A local / Path B platform observatory), the skill-making pipeline, the recursive-skill loop, integration points with the-loom, and the migration path from current `platform/api/` to the target `core/` + `adapters/` shape. Companion to the skill-making bridge spec (PR #54).
- **Adapter stub directories** — `adapters/classroom/`, `adapters/development/`, `adapters/research-project/` each ship a README defining the adapter contract per the three-layer engine spec. No code yet (the adapter artifacts — `manifest.json`, `watches.json`, `pattern-triggers.json`, `system-prompt-fragments/`, `default-skills.json`, `observatory-events.json` — populate when the MVP migration lands and the core engine moves into `core/`). The stubs make concrete what the Hub's `attached-adapters.json` and SDE_Extraction's `attached-adapters.json` reference as `status="intended; not yet implemented"`. Plus a top-level `adapters/README.md` orienting the layer.
- **MVP migration Phase 1 — scaffold** — empty target directories created at the repo root per [`docs/plans/2026-06-01-mvp-migration.md`](docs/plans/2026-06-01-mvp-migration.md). Three new top-level dirs with READMEs explaining the contracts: `core/` (Layer 1 — 8 sub-dirs: runtime, skill-making, providers, orchestration, auth, db, tools, observability), `services/` (3 sub-dirs: api, skill-making, admin), `deprecated/` (deprecate-before-delete policy). All sub-dirs `.gitkeep`-empty. Zero code moved — that's Phases 2-5. Phase 1 is risk-zero: existing `platform/api/` paths remain authoritative; Dockerfile entrypoint `api.main:app` unchanged; tests + Render deploy unaffected.
- **README + ARCHITECTURE docs refresh** — rewrote both top-level docs to reflect the three-layer model (PR #55), the adapter stubs (PR #56), and the MVP migration plan (PR #57). README now opens with the boundary rule, shows the three layers + the five-module platform position via mermaid diagrams, includes both promotion paths visually, and lists all sibling repos (humancensys-app, summer-2026-hub, sde-extraction, ux-starter, web-starter, docs-agent, project-starter, claude-skills-marketplace). ARCHITECTURE.md adds a "Three-layer engine model" top section + a "Make_Skills' position in the wider platform" section with mermaid diagrams, renames the old "Layered architecture" → "Ownership tiers (orthogonal axis)" to avoid the layer-vs-layer naming collision, and updates the "What's aligned" + "What's pending" lists to reflect the post-PR-57 state.
- **MVP migration plan** (`docs/plans/2026-06-01-mvp-migration.md`) — Liz-ratified staged migration plan for moving `platform/api/` to the target `core/` + `adapters/` + `services/` shape per the three-layer engine spec. Phase 0 PROBE complete (import graph, tests, Dockerfile entrypoint, humancensys-app consumption, /mcp/memory references, roadmap ownership all audited). Phases 1-5 outlined: scaffold → low-coupling extracts → skill-making boundary → deprecate LanceDB memory → runtime/main move. Each phase is its own PR. Compatibility shims at every old import path. Deprecate before delete. Boundary-language guard preserved verbatim: "Make_Skills improves local agency and produces candidates. The-loom observes across projects, governs promotion, and stores durable structure." Four open decisions resolved (roadmap=stay-in-place, tests=deprecated/, platform/=keep deploy only, Phase 5=after real-or-smoke-test consumer).
- **CHANGELOG.md** seeded with the work that landed across 2026-05-15 → 2026-05-23. Future entries go under `## [Unreleased]` and `release-please` rolls them into versioned releases.
- **Three GitHub Actions workflows** under `.github/workflows/`: `release-please.yml` (versioning + CHANGELOG automation, with `extra-files` syncing version drift), `pr-title-lint.yml` (Conventional Commits enforcement via `amannn/action-semantic-pull-request`), `changelog-required.yml` (warns when infra files change without a CHANGELOG entry).
- **Infrastructure-mapping system** — `skills/infrastructure-mapping/SKILL.md` (Simon-grounded mapping discipline) + `scripts/architecture_snapshot.py` + `scripts/architecture_diff.py` + first baseline at `docs/architecture-snapshots/2026-05-22-2353-*`. Ships in #34.
- **`docs/test-runs/2026-05-23-mapping-and-observability.md`** — friction-surface log for the 2026-05-22 → 23 arc.
- **LangSmith tracing** flipped on in `render.yaml` (`LANGSMITH_TRACING="true"`) — only takes effect when `PLATFORM_MODE=hosted`. Self-host stays untraced.
- **Sentry SDKs** wired in `platform/requirements.txt` (`sentry-sdk[fastapi]`) and `web/package.json` (`@sentry/nextjs`). DSNs unset by default; self-host gets no telemetry until the user explicitly opts in.
- **Dev-experience observability layer** (#38) — `platform/deploy/docker-compose.yml` adds Loki + Promtail services. Promtail tails the host's `~/.claude/logs/hooks.jsonl` (from the make-skills-discipline plugin v0.1.2+) and ships parsed entries to Loki. New Grafana dashboard `dev-experience.json` shows hook activity over time, action breakdown, and recent events. Runbook: `docs/runbooks/dev-experience-observability.md`. Local-machine only by design — does not ship to Render.
- **LangSmith + Sentry init code** (#40) — `platform/api/main.py` pops LangSmith env vars when `PLATFORM_MODE != hosted`, and calls `sentry_sdk.init()` only when `SENTRY_DSN` is set AND `PLATFORM_MODE=hosted`. `web/sentry.{client,server,edge}.config.ts` + `web/instrumentation.ts` wire Next.js telemetry for all three runtimes; `web/next.config.ts` is wrapped with `withSentryConfig` for build-time source-map upload.

### Changed

- **Engine/consumer split (PR #52)** — `web/` extracted to a new repo, [`Lizo-RoadTown/humancensys-app`](https://github.com/Lizo-RoadTown/humancensys-app) (private). Make_Skills is now the engine: agent runtime, skill compiler, model registry, memory MCP, Pillar 0 tenant scoping. The consumer (Next.js student app, Auth.js, lesson content, IDENTITY-TO-HABIT framework, branding) lives in humancensys-app and consumes this repo over HTTPS + MCP. Implements the framing in [`docs/proposals/make-skills-engine-vs-consumer-scope.md`](docs/proposals/make-skills-engine-vs-consumer-scope.md) (PR #51). README rewritten for engine-only scope. Provenance: humancensys-app created as a clean copy without preserved history; history of `web/` before 2026-05-26 lives in this repo's git log.
- **Skill-making bridge spec landed** — `docs/proposals/2026-05-25-skill-making-bridge.md` defines the detailed contract between the-loom's Architecture Registry and the engine's `services/skill-making/`. Covers the three message types (promotion candidate, registration ack, telemetry callback), HMAC auth + idempotency, the state machine, failure modes, schema versioning. Companion to the three engine-scope proposals (PR #51). Implementation pending: engine `services/skill-making/` doesn't exist yet (waiting on the MVP repo layout migration); the-loom Architecture Registry promotion-dispatcher is Phase 3+.
- **CLAUDE.md + ARCHITECTURE.md rewritten for engine-only scope (PR #53)** — Follow-up to the engine/consumer split. Two-mode diagrams now show `consumer app → engine` instead of `web/ → platform/api/`. New "How consumers integrate" section in CLAUDE.md documents the REST + MCP + JWT contract. ARCHITECTURE.md's repo strategy reflects the actual split (was "monorepo for now"). `episodic-memory` removed from the configured-MCPs list (disabled per the 2026-05-26 bloat fix; the-loom MCP is the planned replacement). No code changes.
- **`render.yaml`** — LANGSMITH_TRACING value `"false"` → `"true"`. Gated by `PLATFORM_MODE=hosted` per the two-mode discipline; self-host instances ignore.
- **Memory MCP refactor for Phase 3** (PR #45) — `platform/api/memory/mcp_server.py` now reads tenant via `_resolve_tenant()` (backed by `tenant_ctx_var` ContextVar, default `"default"`) instead of the module-level `DEFAULT_TENANT` constant. Stdio self-host behavior preserved. Sets up Phase 3 PR 2 (HTTP transport + JWT auth) to inject per-request tenant without touching handler bodies. See `docs/plans/2026-05-23-memory-mcp-phase-3.md` for execution recovery notes. Also fixes a pre-existing test helper kwarg collision (`_call(name=...)`).
- **Memory MCP Phase 3 — HTTP transport + JWT auth.** `platform/api/memory/mcp_http.py` mounts the existing low-level `Server` as `/mcp/memory` via `StreamableHTTPSessionManager` (only when `PLATFORM_MODE=hosted`). `platform/api/memory/auth_bridge.py` implements the SDK's `TokenVerifier` protocol — decodes HS256 JWTs via the same logic as `auth.py` and sets `tenant_ctx_var` per request so the 6 tool handlers see the JWT-derived tenant. Middleware sandwich: `AuthenticationMiddleware` (outermost, populates `scope["user"]`) → `AuthContextMiddleware` → `RequireAuthMiddleware` (innermost, 401 if unauthenticated). Pins `mcp>=1.20,<2`. Self-host stdio unchanged. Integration test surface at `platform/tests/test_memory_mcp_hosted.py` (3 tests skipped; fixture refactor needed to construct fresh app per-test — production code verified by direct probe).
- **Hosted-mode runbook + client wiring** — `docs/runbooks/memory-mcp-local.md` gains a "Hosted mode (cross-machine memory)" section with setup, under-the-hood explanation, isolation verification, and troubleshooting. `.claude/mcp.json.hosted-example` ships a sample client config. `docs/proposals/lancedb-memory-mcp.md` Phase 3 section updated to reflect what shipped.

### Documentation

- New skill: `skills/infrastructure-mapping/SKILL.md` — see #34.
- Test-runs log: `docs/test-runs/2026-05-23-mapping-and-observability.md` — see #34.
- Plugin v0.1.3 follow-ups punch list: `docs/plans/2026-05-23-plugin-v0.1.3-followups.md` (citation regex, dual-mode trigger gating, smoke-test items, stacked-PR discipline). Items #1 and #1a marked complete after marketplace PR #3 (v0.1.3) shipped.
- Merge-queue session log: `docs/test-runs/2026-05-23-merge-queue-and-plugin-followups.md` (9 PRs drained, friction patterns captured). Smoke-test completion section added after fresh-session verification of v0.1.3 — dual-mode docs gate confirmed working, new v0.1.4 candidate filed for silent `_observability.py` import failure under the Node launcher. Phase 3 (memory MCP) research-dispatch section + Context7 prompt-injection note added.
- Memory MCP Phase 3 implementation plan: `docs/plans/2026-05-23-memory-mcp-phase-3.md` — 12 TDD tasks across 3 PRs (contextvar refactor → HTTP transport + auth + tests → docs + client wiring). Grounded in parallel-agent research; cites SDK file:line and external sources.
- **Auto-upskilling loop proposal** — `docs/proposals/auto-upskilling-loop.md`. Captures the design for automating the `agentic-upskilling` skill: observe at defined interfaces → count repeats → at 3+ uses dispatch an author-orchestration subagent → human approves PR. Promotion target is a codified orchestration (agent + tools + contract), not a Python function. Depends on plugin v0.1.4 (hooks.jsonl writes). ~6-8 hours MVP effort.
- **Render deploy runbook** — `docs/runbooks/render-deploy.md`. Step-by-step for deploying the FastAPI app + managed Postgres + persistent disk on Render. Includes the `PLATFORM_MODE=hosted` flip that activates `/mcp/memory` for cross-machine memory. ~$7-10/mo to run.
- **Application-vs-dev-tooling scoping document** — `docs/proposals/application-vs-dev-tooling-scope.md`. Founding document for the split. Make_Skills is the application (student-facing platform); a separate application (the-loom) is the personal AI substrate Liz uses across every project she builds. The doc captures the agent's earlier confusion (treating personal dev tooling as part of the application), Liz's correction, the unifying observe→learn→codify→embed pattern, and the resolution: a new private repo at `Lizo-RoadTown/the-loom` was bootstrapped on 2026-05-25 to host the personal substrate independently. See the doc's "Resolution" section for what was decided about which code moves where.
- **Make_Skills engine-vs-consumer scoping + data model + MVP repo layout** — three new proposals naming the SECOND split that needs to happen inside this repo: Make_Skills the engine (reusable agent platform — agent runtime, skill compiler, model registry, tenant isolation) vs. humancensys.com the consumer (student-facing UI, lessons, onboarding journey). `docs/proposals/make-skills-engine-vs-consumer-scope.md` names the boundary and the skill-making bridge to the-loom. `docs/proposals/2026-05-25-make-skills-engine-data-model.md` defines 12 engine-level objects across 5 bounded contexts. `docs/proposals/2026-05-25-make-skills-engine-mvp-repo-layout.md` lays out the future monorepo shape (services/ + access/ + providers/ + runtime/ + compiler/ + sdk/) and the migration roadmap for extracting humancensys.com into its own repo.

## [0.1.0] — 2026-05-22

Initial pre-versioned development period. Highlights of work that landed in Make_Skills before automated CHANGELOG enforcement was wired:

### Added

- **LanceDB memory MCP — Phase 1** (#32): local-only MCP server wrapping the existing LanceDB layer at `platform/api/memory/`. Stdio transport, single-tenant. Six tools: `memory_read`, `memory_list`, `memory_write`, `memory_delete`, `memory_search`, `memory_recall`.
- **LanceDB memory MCP — Phase 2** (#33): the sync shim daemon (`scripts/memory_shim.py`) that mirrors typed memory files ↔ LanceDB. Plus the discipline wrapper refactor that removed in-repo `.claude/settings.json` and replaced it with a plugin-install directive.
- **`docs/proposals/lancedb-memory-mcp.md`** — full four-phase plan for the memory MCP architecture.
- **`docs/proposals/`** updated with `lancedb-memory-mcp.md`.
- **`docs/runbooks/memory-mcp-local.md`** — how to run the Phase 1 MCP locally and wire into Claude Code.
- **`docs/plans/2026-05-21-project-starter-recommendations.md`** — the project-starter handoff doc, synced bidirectionally with the project-starter agent.
- **`docs/plans/2026-05-22-discipline-plugin-and-starter-capture.md`** — systematic capture plan for the discipline plugin + project-starter enhancements.
- **Pillar 1B agent runtime** — `platform/api/runtime.py` AgentRuntime + per-`(tenant, agent_id)` deepagents instances + `platform/api/skill_compiler.py` skill compilation + per-agent `/chat/{agent_id}` endpoints.
- **BYO API keys** — `student_secrets` table + `/settings/keys` UI.
- **`web/components/BrandMark.tsx`** + sidebar visual identity.
- **First-time welcome state** in `web/components/Chat.tsx` for new users with no agents and no past threads.
- **Tabbed observability surface** at `/observability` (consolidates the previously-fragmented sessions / memory / test-runs / overview pages).
- **Design tokens** in `web/lib/tokens.ts` and `@theme inline` block in `web/app/globals.css`.

### Documentation

- **`docs/UX_CONTRACT.md`** — master UX discipline doc.
- **`CLAUDE.md`** — project context loaded into every Claude Code session.
- **Memory MCP Phase 1 + 2 PRs** (#32, #33).

### Skill marketplace (separate repo: `Lizo-RoadTown/claude-skills-marketplace`)

- `onboarding-psychologist` — IDENTITY-TO-HABIT framework
- `ai-agents-architect` — agent architecture decisions
- `make-skills-discipline` v0.1.0 → v0.1.2 — auto-injecting discipline wrapper for Claude Code sessions

[Unreleased]: https://github.com/Lizo-RoadTown/Make_Skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Lizo-RoadTown/Make_Skills/releases/tag/v0.1.0
