# Changelog

All notable changes to Make_Skills are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version-bumps and releases are managed by `release-please`.

## [Unreleased]

### Added

- **CHANGELOG.md** seeded with the work that landed across 2026-05-15 → 2026-05-23. Future entries go under `## [Unreleased]` and `release-please` rolls them into versioned releases.
- **Three GitHub Actions workflows** under `.github/workflows/`: `release-please.yml` (versioning + CHANGELOG automation, with `extra-files` syncing version drift), `pr-title-lint.yml` (Conventional Commits enforcement via `amannn/action-semantic-pull-request`), `changelog-required.yml` (warns when infra files change without a CHANGELOG entry).
- **Infrastructure-mapping system** — `skills/infrastructure-mapping/SKILL.md` (Simon-grounded mapping discipline) + `scripts/architecture_snapshot.py` + `scripts/architecture_diff.py` + first baseline at `docs/architecture-snapshots/2026-05-22-2353-*`. Ships in #34.
- **`docs/test-runs/2026-05-23-mapping-and-observability.md`** — friction-surface log for the 2026-05-22 → 23 arc.
- **LangSmith tracing** flipped on in `render.yaml` (`LANGSMITH_TRACING="true"`) — only takes effect when `PLATFORM_MODE=hosted`. Self-host stays untraced.
- **Sentry SDKs** wired in `platform/requirements.txt` (`sentry-sdk[fastapi]`) and `web/package.json` (`@sentry/nextjs`). DSNs unset by default; self-host gets no telemetry until the user explicitly opts in.
- **Dev-experience observability layer** (#38) — `platform/deploy/docker-compose.yml` adds Loki + Promtail services. Promtail tails the host's `~/.claude/logs/hooks.jsonl` (from the make-skills-discipline plugin v0.1.2+) and ships parsed entries to Loki. New Grafana dashboard `dev-experience.json` shows hook activity over time, action breakdown, and recent events. Runbook: `docs/runbooks/dev-experience-observability.md`. Local-machine only by design — does not ship to Render.
- **LangSmith + Sentry init code** (#40) — `platform/api/main.py` pops LangSmith env vars when `PLATFORM_MODE != hosted`, and calls `sentry_sdk.init()` only when `SENTRY_DSN` is set AND `PLATFORM_MODE=hosted`. `web/sentry.{client,server,edge}.config.ts` + `web/instrumentation.ts` wire Next.js telemetry for all three runtimes; `web/next.config.ts` is wrapped with `withSentryConfig` for build-time source-map upload.

### Changed

- **`render.yaml`** — LANGSMITH_TRACING value `"false"` → `"true"`. Gated by `PLATFORM_MODE=hosted` per the two-mode discipline; self-host instances ignore.

### Documentation

- New skill: `skills/infrastructure-mapping/SKILL.md` — see #34.
- Test-runs log: `docs/test-runs/2026-05-23-mapping-and-observability.md` — see #34.
- Plugin v0.1.3 follow-ups punch list: `docs/plans/2026-05-23-plugin-v0.1.3-followups.md` (citation regex, dual-mode trigger gating, smoke-test items, stacked-PR discipline). Items #1 and #1a marked complete after marketplace PR #3 (v0.1.3) shipped.
- Merge-queue session log: `docs/test-runs/2026-05-23-merge-queue-and-plugin-followups.md` (9 PRs drained, friction patterns captured). Smoke-test completion section added after fresh-session verification of v0.1.3 — dual-mode docs gate confirmed working, new v0.1.4 candidate filed for silent `_observability.py` import failure under the Node launcher. Phase 3 (memory MCP) research-dispatch section + Context7 prompt-injection note added.
- Memory MCP Phase 3 implementation plan: `docs/plans/2026-05-23-memory-mcp-phase-3.md` — 12 TDD tasks across 3 PRs (contextvar refactor → HTTP transport + auth + tests → docs + client wiring). Grounded in parallel-agent research; cites SDK file:line and external sources.

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
