# ADR-001: Adopt Apache License 2.0

- **Status:** Accepted
- **Date:** 2026-04-28
- **Decided by:** Liz

## Context

The project committed to open-source distribution alongside a hosted-multitenant variant on the same date (see ADR-002). A license must be chosen before contributors can legally fork, modify, or redistribute the code, and before the hosted version can run with a clear contributor agreement.

Three license families were under genuine consideration:

- **MIT** — minimal, no patent grant, maximum permissiveness
- **Apache 2.0** — permissive with explicit patent grant and notice requirements
- **AGPL v3** — strong copyleft including SaaS use ("network use is distribution")

## Decision

Adopt **Apache License 2.0** as the project license. `LICENSE` at the repo root contains the canonical text fetched directly from `apache.org/licenses/LICENSE-2.0.txt`. CONTRIBUTING.md states that contributions are licensed under the same terms (inbound = outbound).

## Consequences

### Positive

- **Patent grant.** Apache 2.0 includes an explicit patent license from contributors to users — meaningful in AI/agent space where patentable IP is dense. MIT lacks this.
- **Highest adoption in the AI/ML ecosystem.** Major projects (Hugging Face, Kubernetes, many Apache Software Foundation projects, parts of LangChain ecosystem) use it; contributors and corporate users are familiar.
- **Corporate-friendly.** Most legal departments approve Apache 2.0 without review friction. AGPL software is banned at many large organizations.
- **Dual-license-able later.** If the project's commercial defense priority shifts (e.g., a competitor running a managed SaaS without contributing back), we can relicense to AGPL or offer a commercial license alongside Apache. Grafana did exactly this — Apache 2.0 → AGPL v3 in April 2021 — when their commercial play matured.

### Negative

- **No SaaS-defensive copyleft.** Anyone (including future competitors) can fork, modify, and run a hosted version of Make_Skills without contributing changes back. Apache 2.0 does not require sharing modifications used in network services. If this becomes a real competitive threat, we will need to pay the cost of relicensing.
- **Notice-preservation overhead.** Apache 2.0 requires preserving copyright notices and a NOTICE file when one exists. Slight overhead for forks vs MIT (which has a similar but lighter requirement).
- **Patent retaliation clause.** Section 3 of Apache 2.0 terminates the patent grant for any party that initiates patent litigation against the project. Mostly a positive, but could create friction if ever entangled in licensing disputes with patent-holding contributors (rare).

### Neutral

- **No copyleft on derivatives.** Apache permits proprietary derivatives, which is neutral — depends on your viewpoint whether this is an asset (encourages adoption) or a liability (allows free-riding).

## Alternatives considered

### Alternative 1: MIT

Simpler text, even broader corporate acceptance, used by LangChain itself. Rejected primarily because of the missing patent grant. In the AI/agent space, where patent landscapes are dense and contributor-employer relationships often involve patentable work, the explicit grant is worth the slight extra notice burden Apache imposes.

### Alternative 2: AGPL v3

Strong copyleft that would force any future SaaS competitor to share modifications. Used by Grafana for exactly this reason. Rejected for now because:

- Project priority is "people contribute and like it" — AGPL is banned at many corporate users, reducing the contributor pool meaningfully
- The hosted-multitenant variant of Make_Skills is not yet a meaningful commercial play; defensive copyleft is solving a problem we don't have
- We can relicense to AGPL later if the commercial landscape changes (Grafana's path), whereas the inverse (AGPL → permissive) is much harder to do retroactively

## References

- [`LICENSE`](../../LICENSE) — canonical Apache 2.0 text
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — inbound = outbound contribution licensing
- [Apache License 2.0 — apache.org](https://www.apache.org/licenses/LICENSE-2.0)
- [Grafana's Apache → AGPL relicensing announcement (April 2021)](https://grafana.com/blog/2021/04/20/grafana-loki-tempo-relicensing-to-agplv3/) — concrete example of the dual-license-later path

## Related ADRs

- [ADR-002: Two-mode commitment](002-two-mode-commitment.md) — the open-source vs hosted-multitenant dual posture that made licensing a forced decision now
