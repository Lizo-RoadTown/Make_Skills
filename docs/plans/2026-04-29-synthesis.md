# Synthesis — 2026-04-29

This file ties together three plans written today:

1. [Next actions](2026-04-29-next-actions.md) — what to ship next
2. [Learning-tool design evaluation](2026-04-29-learning-tool-design-evaluation.md) — what design style to adopt for the platform UI
3. [Orchestration catalog](2026-04-29-orchestration-catalog.md) — what recurring patterns should become reusable subagents/skills

## The story across the three plans

The user is in **active build mode** with a clear next phase (Pillar 1B agent-builder UI), a settled architectural foundation (Pillar 0 just shipped), and a build process that has produced enough repeated patterns to start capturing them as reusable orchestrations. The three plans say the same thing from three angles:

- *Next actions* says: the gating decision is **auth provider** (Auth.js confirmed), and the natural feature is **Pillar 1B**.
- *Design evaluation* says: Pillar 1B should follow a **hybrid Console + Foundry + inline-pedagogy style**, with sidebar slots locked in BEFORE any one page is built.
- *Orchestration catalog* says: build **`researcher-coordinator` + `proposal-authoring` + `ui-scaffolder`** subagents/skills FIRST, because they accelerate everything downstream — the auth wire-up, the Pillar 1B form, the future `/sessions` and `/credentials` pages.

The three plans agree on the order:

1. Capture the orchestrations that everything else depends on (this week)
2. Lock the sidebar architecture (a single proposal that sets all the slots)
3. Wire auth + ship Pillar 1B as the first feature inside the new sidebar
4. Use the captured orchestrations to ship Pillar 1B faster than it would have been ad hoc

## Recommended sequence (2-3 weeks of work)

### Week 1 — orchestration capture + sidebar lock-in

| Day | Action | Why |
|-----|--------|-----|
| Mon | Build `subagents/researcher-coordinator/` | Highest-impact capture (score 80). Used by every subsequent design pass. |
| Tue | Write `skills/proposal-authoring/SKILL.md` + `references/template.md` | Score 80. Next 3-5 proposals all benefit. |
| Wed | Write `docs/proposals/sidebar-architecture.md` (using the new proposal-authoring skill) — locks in: Workbench, Agents, Sessions, Templates, Skills, Memory, Credentials, Environments, Observability, Manage | Sets the slots that Pillar 1B and everything after fits into. |
| Thu | Build `subagents/ui-scaffolder/` | Score 48. Used by every page in the new sidebar. |
| Fri | Write `skills/tenant-isolation-testing/SKILL.md` (low effort) + start auth wire-up: Auth.js providers (GitHub + Google) in `web/`, JWT verifier replacing the 501 stub in `platform/api/auth.py` | Two small wins + start of the gating work. |

### Week 2 — auth + Pillar 1B form

| Day | Action | Why |
|-----|--------|-----|
| Mon-Tue | Finish auth: invite-only signup flow (per user decision), `tenant_secrets` table migration via `subagents/schema-migrator/` (also new — building it as part of this), Render env config, end-to-end test | Unblocks BYO Ollama Stage 2 and the per-tenant config path Pillar 1B needs. |
| Wed-Thu | Build `/agents/build` page using `subagents/ui-scaffolder/` — 4-field form (name, model, instructions, skills) with inline 50/50 playground, "Generate" button (Haiku-backed), "Get Code" toggle | First feature in the new sidebar; first page through the new ui-scaffolder; demonstrates the orchestration captures paying off. |
| Fri | Update [`agent-builder-flow.md`](../proposals/agent-builder-flow.md) to reflect the v1 4-field reality (was 6 steps); update [`byo-personal-ollama.md`](../proposals/byo-personal-ollama.md) Stage 2 to reference the now-existent `tenant_secrets` table | Keep the audit trail honest. |

### Week 3 — first dogfooding

| Day | Action | Why |
|-----|--------|-----|
| Mon-Wed | Build `/sessions` page (replay-with-trace) and `/templates` page (outcome-named cards, dual-purpose for Quests) using the ui-scaffolder | Two more pages that were previously days of work, now ~half a day each. |
| Thu | Wire the agent-builder's "Generate" button to a Haiku call (`/api/agent/generate-prompt`) | The single highest-leverage piece of inline pedagogy — collapses the "what do I write here" freeze. |
| Fri | First end-to-end student-flow walkthrough: sign in → fork a template → tweak the prompt with Generate → save → run a session → review the trace | The dogfooding moment — does the platform actually teach? |

## What changes if the user picks differently

| Alternative | What shifts |
|-------------|-------------|
| Skip orchestration capture, go straight to Pillar 1B | Pillar 1B takes 1.5-2× longer; the proposal-authoring + ui-scaffolder gains aren't realized; the next pillar starts from scratch again |
| Build all pillar pages first (1B, 2, 3 in parallel) without locking sidebar | Re-renders are guaranteed when the sidebar changes; data shape decisions get re-litigated mid-build |
| Defer auth indefinitely | Pillar 1B ships for self-host only; hosted launch slips by 6+ weeks; BYO Ollama Stage 2 stuck |
| Add Fine-tuning / Model Conversion (from Foundry) | Out-of-scope creep; weeks of work for a feature academic users don't need |

## Open questions (quick to resolve)

1. **Workspace vs Tenant naming in UI** — Anthropic uses Workspace; recommend the same for friendliness, keep "tenant" as SQL/internal term.
2. **Templates as a separate sidebar slot vs nested under Agents** — recommend separate, because Templates is the Pillar 2 quest entry point in disguise.
3. **What does "invite-only" mean concretely** — recommend a single `invitations` table with `email`, `tenant_id`, `created_by`, `consumed_at` columns, and a `/invite` page where Liz issues invites by email. Each invite has a single-use token. Cheap to build.

## What the user should do next

Pick one of three:

- **"Go full sequence"** — execute Week 1 starting with `researcher-coordinator`. The three weeks are ordered for compounding gains.
- **"Auth first, capture later"** — start the auth wire-up now, build the orchestrations as the friction surfaces. Slower overall but matches a less-patient build cadence.
- **"Just lock the sidebar first"** — write only `docs/proposals/sidebar-architecture.md` this week, defer the orchestration captures and the auth work to next week. Lowest risk; lowest velocity.

The recommended choice is the first one, but all three are coherent. The orchestrations + sidebar capture is the highest-leverage week the project has had since Pillar 0.

## Cross-references

- Skills created today: [`design-evaluation`](../../skills/design-evaluation/SKILL.md), [`orchestration-cataloging`](../../skills/orchestration-cataloging/SKILL.md), [`next-actions-planning`](../../skills/next-actions-planning/SKILL.md) (earlier this session)
- Three plans referenced above
- Auth decision (in conversation 2026-04-29): Auth.js + invite-only signup
- Most recent commit: `b502b40` (Pillar 0 tenant abstraction)
