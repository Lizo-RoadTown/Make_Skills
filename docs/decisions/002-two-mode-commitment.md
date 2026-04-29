# ADR-002: Build for both self-host and hosted-multitenant from day one

- **Status:** Accepted
- **Date:** 2026-04-28
- **Decided by:** Liz

## Context

Early versions of the platform assumed a single user, single instance — the typical "personal AI agent" stack. Then it became clear other people would want to use it: their own knowledge graph, their own organization, their own agents to play with. Three deployment shapes were on the table:

- **A. Self-host only** — each user clones the repo and runs it; no hosted variant
- **B. Multi-tenant SaaS only** — humancensys.com is the platform; users have accounts
- **C. Both, in parallel** — open-source self-host AND hosted SaaS variant, supported in the same codebase

The trade-off matters because once data is being written without tenant scoping, retrofitting multi-tenancy is a migration nightmare; conversely, building multi-tenancy unnecessarily into a single-user project is over-engineering.

## Decision

**Adopt Shape C: both modes, parallel, in the same codebase, from now onward.** Every change considers both deployment modes, with documentation and tests for each. The architectural separation is documented in [`ARCHITECTURE.md`](../../ARCHITECTURE.md); the contributor discipline is in [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Consequences

### Positive

- **Open-source pillar real.** Contributors can fork and self-host without the project being "secretly" SaaS-coupled. The codebase IS the deployable artifact for self-host.
- **Hosted future preserved.** Liz can run humancensys.com as a hosted SaaS without re-architecting later; the tenant abstraction is in place from the start.
- **Forced discipline.** Every PR has to answer four questions (self-host? hosted? tests for both? docs for both?). This catches ambiguity early.
- **Repo strategy is contribution-friendly.** Module boundaries (platform/, web/, skills/) are explicit and split-able later if growth demands it.

### Negative

- **More upfront work per feature.** Tenant scoping, mode-aware tests, and dual documentation roughly double the per-PR overhead vs. single-mode development.
- **Risk of architectural over-fit to imagined hosted scenarios.** Some "multi-tenant" considerations may turn out to be premature optimization for a hosted variant that never reaches scale. We accept this risk because the alternative — retrofitting — is worse.
- **Contributor cognitive load.** New contributors must understand two modes, not one. CONTRIBUTING.md and ARCHITECTURE.md mitigate but don't eliminate this.

### Neutral

- **Self-host is the default for now.** No hosted-multitenant deployment exists yet — the discipline is forward-looking. The hosted path lights up when auth, tenant abstraction, and config-loader abstractions ship (tracked in ROADMAP Pillar 0).

## Alternatives considered

### Alternative A: Self-host only

Simpler — no multi-tenancy concerns. Rejected because closing off the hosted future would disqualify humancensys.com as a SaaS surface for users who don't want to self-host. The project's reach narrows significantly.

### Alternative B: Multi-tenant SaaS only

Could optimize for one deployment story. Rejected because closing off self-host would disqualify the open-source contribution pillar — contributors who can't run the platform locally are unlikely to contribute meaningfully, and the project becomes "Liz's hosted product with public source code" rather than an open-source platform.

## References

- [`ARCHITECTURE.md`](../../ARCHITECTURE.md) — five-layer model, mode detection via `PLATFORM_MODE` env var
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — four-question PR template enforcing the discipline
- [`ROADMAP.md`](../../ROADMAP.md) — Pillar 0 tracks each dual-mode readiness item (gitignored; user-specific)

## Related ADRs

- [ADR-001: Adopt Apache License 2.0](001-license-apache-2.md) — license choice was forced by the open-source pillar of this commitment
