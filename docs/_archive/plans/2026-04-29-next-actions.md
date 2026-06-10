# Next actions — 2026-04-29

## What just shipped

- **Pillar 0 — tenant abstraction** (commit `b502b40`, +1242/-90 lines): shared schema with `tenant_id` everywhere, `tenants` + `conversations` tables, FORCE RLS on Postgres with non-superuser test role, BTREE scalar indexes on LanceDB `tenant_id` + `visibility`, `TenantScopedSaver` wrapping `AsyncPostgresSaver`, `Depends(get_current_tenant)` on every tenant-scoped endpoint, `record_turn(tenant_id, …)` background-task discipline, four passing isolation tests. `PLATFORM_MODE` env var defaults to `self_host`.
- **BYO personal Ollama Stage 1** (commit `a2040a1`): auth-header passthrough in the model registry, env vars in compose/render, design proposal, public docs, Docker Cloud runbook.
- **Tone sweep across docs and observability page** (commit `a2040a1`): cut self-congratulatory framing per saved feedback memory.

## Top recommendation

**Pick auth provider (Auth.js vs Clerk) and wire JWT verifier.** This is the single biggest unblocker on the roadmap. The user already has GitHub + Google OAuth credentials ready. Auth.js is the recommended fit (lives in Next.js, free, no vendor lock-in).

- **Effort:** ~1-2 days end-to-end (Auth.js providers + callback → issue your JWT with `tenant_id` claim → swap the `JWTTenantResolver` stub at [`platform/api/auth.py:50`](../../platform/api/auth.py#L50) to verify the token).
- **Blocks:** hosted-multitenant launch on humancensys.com, BYO Ollama Stage 2 (per-tenant endpoint registration), Pillar 1B-hosted (per-tenant subagent storage), public commons publishing UI.
- **Pull:** the user explicitly said "I have everything we need to use github and google to do oauth" in the most recent turn. Strongest possible user-pull signal.
- **Question to resolve before starting:** "Use Auth.js or Clerk?" — I recommended Auth.js in the prior message; one-line confirmation is enough.

## Other ready-to-execute options (pick one if you'd rather defer the auth decision)

1. **Pillar 1B — subagent creation form (self-host first)** — A `/agents/build` UI that writes to `subagents/<name>/` on the filesystem. Self-host works today; hosted version waits on auth. Natural progression after Pillar 1A model registry. Effort: 3-5 days. Pull: very high — the [STEM gamified vision memory](../../C:/Users/Liz/.claude/projects/c--Users-Liz-Make-Skills/memory/project_stem_gamified_vision.md) calls Pillar 1 UX "the most important hook."

2. **GitHub Actions CI** — Run the four Pillar 0 isolation tests + a smoke test in CI on every PR. Catches regressions in everything downstream. Effort: 2-4 hours. Pull: low (user hasn't asked) but blocks-medium (every future PR benefits).

3. **Power up Liz's Docker Cloud Ollama** — Hands-on task for the user using the runbook at [`docs/runbooks/power-up-docker-cloud-ollama.md`](../runbooks/power-up-docker-cloud-ollama.md). 20 min the first time. Validates BYO Ollama Stage 1 end-to-end. Pull: high (she said she'd set it up).

4. **Code of Conduct + GitHub Discussions enabled** — Default Contributor Covenant, click-to-enable Discussions. 15 min. Pillar 0 list closing items. Pull: low; minor unblockers for community contribution.

## Needs a decision before starting

- **Auth.js vs Clerk** (top item above) — open question: "Confirm Auth.js, or do you want Clerk's hosted SaaS instead?" Recommended Auth.js: fits Next.js, free, no lock-in. Affects: every "Blocked on prior decisions" item below.
- **Tenant routing format** — `humancensys.com/t/<tenant>/...` (path-based) vs `<tenant>.humancensys.com` (subdomain). Recommended path-based; subdomain is a UX upgrade later. Affects: hosted launch shape.
- **Tenant signup flow** — self-serve on first OAuth login vs invite-only. Recommended self-serve. Affects: hosted launch readiness.

## Blocked on prior decisions

- **BYO Ollama Stage 2** (per-tenant endpoint registration UI) — waiting on auth. Once auth lands, write the `tenant_secrets` table schema + UI form + encrypted-at-rest storage.
- **Pillar 1B hosted-mode persistence** — waiting on auth for the per-tenant subagent storage.
- **Public commons publishing UI** (Pillar 3c precursor) — waiting on auth for "publish to commons" action attribution.

## Parking lot (do not start)

- **Pillar 3c — Knowledge observatory** — explicitly marked `💬 needs discussion before execution` in ROADMAP.md. Largest single decision in the project; design conversation must precede code.
- **Pillar 3a — Agent comms tracing** — needs auth + at least one multi-tenant agent flow to instrument; premature without those.
- **Per-pillar deep docs** — additive polish; do after Pillar 1B ships so there's a working flow to document.

## Cross-references

- **Most recent commit:** `b502b40` (Pillar 0 tenant abstraction)
- **Auth design discussion:** the prior turn in this conversation (JWT/OAuth/Auth.js explanation, recommendation = Auth.js + path-based + self-serve + Postgres `tenant_secrets`).
- **Open proposals:** [`pillar-0-tenant-abstraction.md`](../proposals/pillar-0-tenant-abstraction.md), [`byo-personal-ollama.md`](../proposals/byo-personal-ollama.md), [`agent-builder-flow.md`](../proposals/agent-builder-flow.md), [`agent-creatures-ui.md`](../proposals/agent-creatures-ui.md), [`quest-system.md`](../proposals/quest-system.md), [`agent-retirement-and-clan-optimization.md`](../proposals/agent-retirement-and-clan-optimization.md), [`byo-claude-code-via-mcp.md`](../proposals/byo-claude-code-via-mcp.md).
- **Memory signals:** Pillar 1 UX is "the most important hook" (`project_stem_gamified_vision.md`); two-mode commitment from 2026-04-28 (`project_two_mode_commitment.md`); skills must be agentic — PROBE/DECIDE/ACT/REPORT (`feedback_agentic_skills.md`); doc tone is "state what is" (`feedback_documentation_tone.md`).

## Why this order

- **Auth wins on blocking** — three downstream items are stuck on it. One question to resolve, then a 1-2 day wire-up.
- **Pillar 1B is the strongest user-pull** — but ships fully today only for self-host; the hosted half is a re-do once auth lands. Better to wait until auth is ready and ship 1B once.
- **CI is cheap and compounds** — every PR after this benefits from regression coverage.
- **Knowledge observatory is parked correctly** — explicitly user-flagged for design conversation, no business starting code on it.
