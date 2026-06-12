# Changelog

All notable changes to Make_Skills are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version-bumps and releases are managed by `release-please`.

## [Unreleased]

### Added

- **Phase 4 bridge-receiver + compiler shape sketch** (`docs/proposals/2026-06-12-bridge-receiver-and-compiler-phase-4-sketch.md`). Per Loom-agent's ask in the ratified 7-phase upskilling sequence, this is the spare-cycles design sketch for what Phase 4 (un-stubbing `services/skill_making/bridge_receiver.py` + extending `core/skill_making/compiler.py`) will look like when its upstream gates (Phases 0-3 in the-loom: Stop-hook enforcement, candidate registry, local observer, cross-project pattern detection) ship. Documents module surface, per-candidate flow, status transitions, failure modes, compiler extension points, and 5 open Phase-4-time decisions. No implementation; the stub stays a stub until candidates flow.

- **Canonical `default-seed/` templates per adapter type** (`adapters/{development,classroom,research-project}/default-seed/`). Each adapter now ships a 19-file template tree that consumers materialize as `.project-intelligence/` at spawn time. Placeholder syntax (`{{project-slug}}`, `{{instance-slug}}`, etc.) follows the-loom's existing scaffolder convention. Cross-adapter contract documented at [`adapters/default-seed-contract.md`](adapters/default-seed-contract.md). Adapter-specific values baked in: `project_type`, `attached-adapters` name, `pattern_detection_triggers`, `system_prompt_seed`, instance `watches` list. Unblocks Phase 3 cross-project pattern detection (per the ratified 7-phase upskilling sequence — without canonical seeds, candidates from different projects are structurally incomparable). Follow-ups (not in this PR): the-loom's `scripts/new-loom-project.ps1` needs to consume `default-seed/` at spawn time; existing hand-crafted seeds (the-loom, humancensys-app, Hub, SDE_Extraction, loom-platform, Make_Skills) re-seeded if Phase 3 surfaces structural friction.

- **Initial public release as a module of the-loom platform.** Make_Skills ships its three-layer engine — `core/` (reusable engine: runtime, skill compilation, model registry, subagent orchestration, auth, db, providers, tools), `adapters/` (project-type adapter stubs: classroom, development, research-project), `services/` (FastAPI app + admin + skill-making bridge stub) — plus a 16-skill methodology library (`skills/` + `skills_private/`) and 4 specialized subagent definitions. Two-mode supported from day one (`PLATFORM_MODE=self_host` default; `PLATFORM_MODE=hosted` for multi-tenant deployments behind a consumer app's JWT). Apache 2.0 licensed.

  Memory storage is delegated to the-loom (see [CLAUDE.md](CLAUDE.md) CORE DIRECTIVE 1) — Make_Skills no longer self-hosts a memory subsystem. The boundary rule: *Make_Skills improves local agency and produces candidates. The-loom observes across projects, governs promotion, and stores durable structure.*

  See [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](docs/proposals/2026-05-31-three-layer-engine-spec.md) for the canonical architecture spec, [`README.md`](README.md) for the integration overview, and [`ROADMAP.md`](ROADMAP.md) for what's shipped / in flight / deferred.

  Historical changelog from the pre-public-release prototype era is preserved at [`docs/_archive/CHANGELOG-prototype-era.md`](docs/_archive/CHANGELOG-prototype-era.md). The provenance trail is auditable but does not appear in `release-please`'s versioning surface.
