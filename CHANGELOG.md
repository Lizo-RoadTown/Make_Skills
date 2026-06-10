# Changelog

All notable changes to Make_Skills are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Version-bumps and releases are managed by `release-please`.

## [Unreleased]

### Added

- **Initial public release as a module of the-loom platform.** Make_Skills ships its three-layer engine — `core/` (reusable engine: runtime, skill compilation, model registry, subagent orchestration, auth, db, providers, tools), `adapters/` (project-type adapter stubs: classroom, development, research-project), `services/` (FastAPI app + admin + skill-making bridge stub) — plus a 16-skill methodology library (`skills/` + `skills_private/`) and 4 specialized subagent definitions. Two-mode supported from day one (`PLATFORM_MODE=self_host` default; `PLATFORM_MODE=hosted` for multi-tenant deployments behind a consumer app's JWT). Apache 2.0 licensed.

  Memory storage is delegated to the-loom (see [CLAUDE.md](CLAUDE.md) CORE DIRECTIVE 1) — Make_Skills no longer self-hosts a memory subsystem. The boundary rule: *Make_Skills improves local agency and produces candidates. The-loom observes across projects, governs promotion, and stores durable structure.*

  See [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](docs/proposals/2026-05-31-three-layer-engine-spec.md) for the canonical architecture spec, [`README.md`](README.md) for the integration overview, and [`ROADMAP.md`](ROADMAP.md) for what's shipped / in flight / deferred.

  Historical changelog from the pre-public-release prototype era is preserved at [`docs/_archive/CHANGELOG-prototype-era.md`](docs/_archive/CHANGELOG-prototype-era.md). The provenance trail is auditable but does not appear in `release-please`'s versioning surface.
