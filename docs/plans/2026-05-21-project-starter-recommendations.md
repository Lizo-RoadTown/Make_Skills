# 2026-05-21 — Project-starter recommendations

Recommendations for [`Lizo-RoadTown/project-starter`](https://github.com/Lizo-RoadTown/project-starter) based on auditing what's listed in its current `agent-app` and `ui-app` variants against (a) what's actually installable from the public skill ecosystem, (b) what's in the private `skills/` stash here in Make_Skills, and (c) what's currently in [`Lizo-RoadTown/claude-skills-marketplace`](https://github.com/Lizo-RoadTown/claude-skills-marketplace).

This document hands the publishing plan to project-starter. Project-starter owns the mechanics of how things get published — this doc only says **what** to publish, **why**, and **what stays private**.

Five concerns:

1. **What's actually in Make_Skills** — current state so project-starter knows the source-of-truth shape
2. **Which of Liz's private skills to publish** to the marketplace under her name
3. **What to fix in `SKILLS.md`** files (agent-app + ui-app)
4. **What to add** that's currently missing from project-starter
5. **Broader project-starter improvements** beyond `SKILLS.md` — the `_common/` template, CLAUDE.md content, variant structure, scripts

---

## 0. What's actually in Make_Skills today

Project-starter is downstream of Make_Skills — the discipline, voice, and architectural choices in project-starter's templates were extracted from Make_Skills as it was built. Knowing what's in Make_Skills lets project-starter pull from the right source-of-truth.

### Repo shape

```
Make_Skills/
├── CLAUDE.md                  Project context loaded into every Claude Code session
├── ARCHITECTURE.md            Two-mode commitment (self-host + hosted-multitenant)
├── CONTRIBUTING.md            Four-question PR template; the two-mode discipline
├── ROADMAP.md                 (gitignored — per-tenant artifact)
├── docs/
│   ├── UX_CONTRACT.md         The design discipline every UI PR passes
│   ├── proposals/             ~15 architectural design proposals (Pillar 1B agent runtime,
│   │                          portable-student-identity, guide-module, sidebar architecture,
│   │                          BYO personal Ollama, etc.)
│   ├── plans/                 Time-bounded plans, dated YYYY-MM-DD-<name>.md
│   ├── decisions/             ADRs (lighter-weight than proposals)
│   ├── test-runs/             End-to-end run friction logs
│   └── runbooks/              How to operate the platform
├── platform/api/              FastAPI + deepagents + LangGraph backend
│   ├── memory/                LanceDB tenant-scoped memory
│   ├── agent.py               Agent build, builtin_tools registry
│   ├── runtime.py             AgentRuntime — per-(tenant, agent_id) deepagents instances
│   ├── skill_compiler.py      Compiles SKILL.md into StructuredTool
│   ├── main.py                Endpoints (chat, agents/create, secrets, etc.)
│   └── ...
├── web/                       Next.js 16 / React 19 / Tailwind v4 / Motion / XState v5
│   ├── components/
│   │   ├── Chat.tsx           Streaming chat surface
│   │   ├── Sidebar.tsx        Workflow-oriented nav (THINK/BUILD/TEST/OBSERVE/MANAGE)
│   │   ├── BrandMark.tsx      Persistent visual identity (glowing-orb SVG)
│   │   ├── wizard/            Section 1 wizard — XState machine at /agents/build
│   │   │   ├── HatchScene.tsx
│   │   │   ├── BrainScene.tsx
│   │   │   ├── PersonaScene.tsx
│   │   │   ├── SkillBuildScene.tsx
│   │   │   ├── ToolsScene.tsx
│   │   │   ├── IntegrationsScene.tsx
│   │   │   └── SaveScene.tsx
│   │   └── observability/     Tabbed consolidated /observability page
│   ├── app/                   App Router pages
│   └── lib/tokens.ts          Semantic state palettes + design tokens
├── skills/                    7 public SKILL.md files (post-2026-05-21 privacy split)
│   ├── agentic-skill-design/
│   ├── deep-research-pattern/
│   ├── design-evaluation/
│   ├── documentation/
│   ├── document-parsing/
│   ├── eval-deep-research/
│   └── next-actions-planning/
├── skills_private/            7 SKILL.md files (gitignored, never committed)
│   ├── agentic-upskilling/    (planned for publish)
│   ├── orchestration-cataloging/  (planned for publish)
│   ├── lessons-learned/       (planned for publish)
│   ├── open-source-documentation/  (planned for post-launch publish)
│   ├── proposal-authoring/    (stay private — project-specific)
│   ├── roadmap-maintenance/   (stay private — project-specific)
│   └── web-app-scaffold/      (stay private — project-specific)
├── subagents/                 deepagents subagents (planner, researcher, etc.)
├── scripts/                   Setup, sync, promote-to-admin, etc.
└── .mcp.json                  Project-pinned MCP servers
```

### Stack snapshot (load-bearing to know before recommending)

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4, Motion, XState v5, Fumadocs for /docs, recharts, Drizzle (query layer only) |
| Auth | Auth.js v5, HS256 JWT override so FastAPI can verify with shared `AUTH_SECRET` |
| Backend | FastAPI, deepagents, LangGraph, langchain (`model_registry` for swappable providers), psycopg, pgcrypto |
| Memory (platform) | LanceDB (`platform/api/memory/`), tenant-scoped via Pillar 0 |
| DB | Postgres on Render, single schema, RLS on every tenant-owned table |
| Deploy | Vercel for `web/` → humancensys.com; Render for `platform/api` + Postgres |
| MCPs | github, context7, episodic-memory, figma, firecrawl, huggingface, serena (when installed) |

### What's running

- Public landing at humancensys.com (fullscreen hero with 3D-rendered crystalline forms)
- Authenticated app: chat surface + `/agents` stable + `/agents/build` wizard + `/observability` (tabbed)
- Pillar 1B is live: per-agent `/chat/{agent_id}` endpoints, AgentRuntime with per-tenant runtime resolution, skill compilation, BYO API keys (`student_secrets` table)
- Open-source repo, Apache-2.0 license, two-mode commitment documented

### What's in the running app's discipline that's worth pulling into project-starter

- **The two-mode commitment** — every change considers self-host AND hosted-multitenant. ARCHITECTURE.md + CONTRIBUTING.md hold the discipline. Could be a template option in project-starter's `_common/`.
- **The UX_CONTRACT.md** — IDENTITY-TO-HABIT arc, two-language coherence, fill-pop animations, anti-patterns. Already partially reflected in project-starter's ui-app — could be fuller.
- **The "no marketing voice" tone rule** — describe what IS, not what it ISN'T. Worth codifying in the `_common/CLAUDE.md`.
- **The proposals/plans/decisions split** — proposals (long-form, decision space), plans (time-bounded, dated), decisions (ADR-shaped, lighter). Project-starter currently has proposals + plans but no decisions; worth adding.

---

## 1. Publishing decision — what goes to the marketplace under Liz Osborn

### Strategic frame

The publishing isn't about open-sourcing for charity. It's about **named authorship** and **recruiting**. Liz is building a multi-year educational platform (Make_Skills) and needs people to know she's capable of building it now, before the running app is ready to demonstrate that itself. Publishing a coherent set of skills under her name does two things at once:

- **Authorship credit.** Each skill is a small but real intellectual artifact. Ten skills published under one name reads as a body of work, not a one-off.
- **Recruiting signal.** Anyone evaluating Liz as a collaborator can read the skills and see how she thinks about agent design, onboarding psychology, documentation discipline, and the upskilling loop. The skills *are* the resume.

This frame replaces the earlier "competitive moat" thinking. Hiding an educational framework as a moat is the wrong move for a builder whose long-term value depends on being **known** for the framework, not for hiding it.

### What gets published — 10 skills (in addition to the 2 already up)

**Already published (2):**

- `onboarding-psychologist`
- `ai-agents-architect`

**Publish now — the upskilling triad (3, headline batch):**

These three together describe Liz's full operational framework for "agents that get sharper at how you work." Publishing them as a set lets the framework be cited as one named contribution. Publishing only one and hiding the others reads as "here's the idea; I'm hiding the operational detail" — weaker authorship claim.

| Skill | Why publish | Editing needed before publish |
|---|---|---|
| `agentic-upskilling` | The headline — skill→tool promotion criteria, demotion logic, dogfooding surface design. This is the *named framework* Liz can be associated with. | Generalize the two-mode-discipline section to a multi-tenant note; reframe Make_Skills-specific paths (`platform/api/...`, `ROADMAP.md`) as case-study examples; keep the criteria and mechanics intact. |
| `orchestration-cataloging` | Meta-detection layer that drives upskilling. Pattern recognition over user workflow → promotion. Reinforces the upskilling triad. | Generalize file path references; the framework itself is portable as written. |
| `lessons-learned` | Third leg — transcript-mining tool that feeds friction patterns into the loop. | Remove Claude-Code-Windows-specific transcript path examples; generalize to "your agent's transcript store". |

**Publish now — generic-ready (6, capability-breadth batch):**

These are publishable as-is or with trivial edits. They demonstrate breadth: Liz thinks about research patterns, evaluation, documentation discipline, and design decisions, not just one niche. Publishing the breadth alongside the triad is what turns a "skill author" into a "skills *body of work* author."

| Skill | Editing needed |
|---|---|
| `agentic-skill-design` | Publish full. The memory-loop section *is* the upskilling philosophy — that's fine, it pairs with `agentic-upskilling` as the conceptual companion. The two-mode-discipline section should be lightly generalized. |
| `design-evaluation` | Drop the two-mode-fit row from the dimensions table; otherwise generic. |
| `documentation` | Publish as-is — already cites Diátaxis as source. |
| `document-parsing` | Publish as-is. |
| `deep-research-pattern` | Publish as-is — already cites real public sources (NVIDIA AI-Q, open_deep_research). |
| `eval-deep-research` | Publish as-is. |

**Publish now — light-edit (1):**

| Skill | Editing needed |
|---|---|
| `next-actions-planning` | Remove hardcoded `ROADMAP.md` and `docs/proposals/` paths; replace with "your project's roadmap / proposal source". |

**Publish later (1) — post-launch credibility marker:**

| Skill | Why later |
|---|---|
| `open-source-documentation` | Strong "this is how Make_Skills handles open-source discipline" authorship piece, but it's most credible *after* the running app demonstrates the discipline. Hold for post-launch. |

### What stays private — 3 skills (not strategic, just project-specific)

These remain in `skills_private/` (gitignored). They are not "moats." They are simply too tied to Make_Skills's specific schema, tools, or organizational structure to be useful authorship vehicles for outside readers.

| Skill | Why private |
|---|---|
| `roadmap-maintenance` | Coupled to ROADMAP.md schema and the three wired-in tools (`update_roadmap_status`, etc.). Won't help other projects. |
| `proposal-authoring` | Make_Skills's house style for `docs/proposals/`. Section template won't fit other repos. |
| `web-app-scaffold` | Stack-specific presets (Vercel chat UI, chainlit aesthetic), references Make_Skills architecture. Could be generalized in a future pass, but not currently. |

### Final marketplace tally after this push

**12 skills under `Lizo-RoadTown/claude-skills-marketplace`, all attributed to Liz Osborn:**

1. `onboarding-psychologist` ✓ already up
2. `ai-agents-architect` ✓ already up
3. `agentic-upskilling` — publish now (headline)
4. `orchestration-cataloging` — publish now
5. `lessons-learned` — publish now
6. `agentic-skill-design` — publish now
7. `design-evaluation` — publish now
8. `documentation` — publish now
9. `document-parsing` — publish now
10. `deep-research-pattern` — publish now
11. `eval-deep-research` — publish now
12. `next-actions-planning` — publish now (after light edit)

Plus `open-source-documentation` queued for post-launch.

That's a 12-skill named-author footprint, organized to demonstrate breadth (research, evaluation, documentation, design) and depth (the upskilling triad as a coherent framework).

### Handoff to project-starter's publishing process

Project-starter has specific ways of handling marketplace publishing. This document does not prescribe the mechanics — it provides the **what + why** for project-starter's publishing process to act on.

For each skill being published, project-starter's process should:

- Pull the source SKILL.md from `Lizo-RoadTown/Make_Skills/skills_private/<name>/SKILL.md` (for the 3 currently-proprietary skills) or `Lizo-RoadTown/Make_Skills/skills/<name>/SKILL.md` (for the 6 already-public ones)
- Apply the editing notes from the table above
- Add marketplace frontmatter (license: Apache-2.0, author: Liz Osborn, compatibility: agentskills.io standard)
- Follow project-starter's own marketplace-entry mechanics (plugin.json, marketplace.json entry, CI validation)
- Ensure each skill description names the framework distinctly (e.g., "Liz Osborn's agentic-upskilling framework — skill→tool promotion criteria...")

---

## 2. Project-starter fixes — what's broken in the current SKILLS.md files

The current `templates/agent-app/SKILLS.md` and `templates/ui-app/SKILLS.md` recommend skill *names* that don't all cleanly resolve to installable packages.

### `templates/agent-app/SKILLS.md` — current issues

| Current entry | Problem | Recommended fix |
|---|---|---|
| `ralph-loop` | Real, installable, but oriented around the Stop-hook iteration loop — a niche pattern most agent projects don't need. | Move to a Tier 3 "optional" section. The `superpowers:executing-plans` workflow covers most multi-step agent work better. |
| `agent-memory-systems` (community) | Manual `git clone + ln -s` install. Awkward. No marketplace entry. | Replace with `episodic-memory:remembering-conversations` (real, installable). Mention CoALA / vector-store decisions as a *concept link*, not an install step. |
| `agent-orchestrator` (Context-Engineering plugin) | Third-party with no review trail. Skill content thinner than alternatives. | Replace with `superpowers:dispatching-parallel-agents` + reference `ai-agents-architect` (Liz's) for the architectural decision. |
| `ai-agents-architect` (Liz's) | Correct. | Keep. |
| `claude-api` (Anthropic) | Bundled with Claude Code. | Keep. |
| `portable-identity` (not a skill) | Correctly noted as a design discipline. | Keep. |

### `templates/ui-app/SKILLS.md` — current issues

| Current entry | Problem | Recommended fix |
|---|---|---|
| `ui-ux-pro-max` | Real, installable. | Keep. |
| `design-system` (Triptease) | Clone-and-place install. Works but fragile. | Augment with `figma:figma-create-design-system-rules` when the project uses Figma. Keep Triptease as the no-Figma fallback. |
| `frontend-design` (Anthropic) | Bundled with Claude Code. | Keep. |
| `onboarding-psychologist` (Liz's) | Correct. | Keep. |

---

## 3. What to add — gaps in both variants

Both SKILLS.md files are missing skills that materially change agent quality.

### Universal additions (both variants)

| Skill | Reason |
|---|---|
| `superpowers:brainstorming` | Mandatory before any creative/build work per its own trigger. Skipping it is how teams ship the wrong thing. |
| `superpowers:verification-before-completion` | Evidence-before-claims discipline. Highest-leverage discipline-skill in the public stack. |
| `superpowers:writing-plans` + `superpowers:executing-plans` | Multi-step task survival across context resets. Replaces the gap left by removing `ralph-loop`. |
| `antigravity-bundle-essentials:concise-planning` | Pairs with writing-plans; produces the "next 3 things" distillation. |
| `antigravity-bundle-essentials:systematic-debugging` | Core to agent work but currently missing. |
| `antigravity-bundle-essentials:git-pushing` | Sane commit-push-PR defaults. |
| `antigravity-bundle-essentials:lint-and-validate` | Pre-merge hygiene. |

### Agent-app-specific additions

| Skill | Reason |
|---|---|
| `antigravity-bundle-llm-application-developer:prompt-caching` | Token economics. Currently no skill in either variant covers caching. |
| `antigravity-bundle-llm-application-developer:context-window-management` | Pairs with prompt-caching. |
| `antigravity-bundle-llm-application-developer:langfuse` | Observability — tool-call counts, latency, error patterns. |
| `antigravity-bundle-llm-application-developer:llm-app-patterns` | Generic LLM-app patterns. |
| `episodic-memory:remembering-conversations` | Replaces the manual-clone `agent-memory-systems`. Real, installable, durable conversation memory. |
| `agent-sdk-dev:new-sdk-app` | Bootstrap helper for Agent SDK apps. |
| `ai:building-pydantic-ai-agents` | When Python-based. |

### UI-app-specific additions

| Skill | Reason |
|---|---|
| `antigravity-bundle-web-wizard:nextjs-best-practices` | Next.js 16 has breaking changes. Critical. |
| `antigravity-bundle-web-wizard:tailwind-patterns` | Tailwind v4 uses `@theme inline`. Model defaults are v3. Critical. |
| `antigravity-bundle-web-wizard:react-patterns` + `react-best-practices` | React 19 patterns. |
| `antigravity-bundle-typescript-javascript:nextjs-app-router-patterns` | App Router specifics. |
| `figma:figma-implement-design` | Design-to-code from Figma. |
| `figma:figma-create-design-system-rules` | Design tokens. |
| `antigravity-bundle-creative-director:frontend-design` | Design taste. |
| `antigravity-bundle-creative-director:copy-editing` | UI copy quality. |
| `verify` (top-level skill) | Run the app and see the change. |

---

## 4. Suggested final shape — recommended SKILLS.md per variant

### `templates/agent-app/SKILLS.md` (recommended ~12 skills)

**Tier 1 — discipline (install first, always):**

- `claude-api` — Anthropic SDK reference
- `lizo-skills/ai-agents-architect` — architecture decisions
- `lizo-skills/agentic-skill-design` — agentic vs passive form
- `lizo-skills/agentic-upskilling` — Liz's skill→tool growth framework
- `superpowers:brainstorming` — before any build work
- `superpowers:writing-plans` + `executing-plans` — multi-step work
- `superpowers:systematic-debugging` — for stuck agents
- `superpowers:verification-before-completion` — evidence before "done"

**Tier 2 — LLM-app stack:**

- `antigravity-bundle-llm-application-developer:prompt-caching`
- `antigravity-bundle-llm-application-developer:context-window-management`
- `antigravity-bundle-llm-application-developer:llm-app-patterns`
- `antigravity-bundle-llm-application-developer:langfuse`
- `episodic-memory:remembering-conversations`

**Tier 3 — situational:**

- `ai:building-pydantic-ai-agents` (if Python)
- `agent-sdk-dev:new-sdk-app` (when bootstrapping)
- `superpowers:dispatching-parallel-agents` (when multi-agent is real)
- `antigravity-bundle-llm-application-developer:rag-implementation` (when RAG is in scope)
- `ralph-loop` (when Stop-hook iteration matches the project's pattern)

### `templates/ui-app/SKILLS.md` (recommended ~12 skills)

**Tier 1 — discipline:**

- `lizo-skills/onboarding-psychologist` — first-use surfaces
- `superpowers:brainstorming` — before design
- `superpowers:verification-before-completion` — visual confirmation, not just type-checks
- `verify` (top-level skill) — run the app and look at it

**Tier 2 — design + current framework:**

- `ui-ux-pro-max:ui-ux-pro-max` — palettes, fonts, UX rules
- `antigravity-bundle-creative-director:frontend-design` — design taste
- `antigravity-bundle-web-wizard:nextjs-best-practices` — Next.js 16 patterns
- `antigravity-bundle-web-wizard:tailwind-patterns` — Tailwind v4
- `antigravity-bundle-web-wizard:react-patterns` — React 19

**Tier 3 — Figma workflow (when relevant):**

- `figma:figma-implement-design` — design-to-code
- `figma:figma-create-design-system-rules` — design tokens

**Tier 4 — public-facing surfaces:**

- `antigravity-bundle-creative-director:copy-editing` — UI copy
- `antigravity-bundle-web-designer:scroll-experience` — marketing pages
- `antigravity-bundle-web-wizard:seo-audit` — public pages

---

## 5. Sequencing — what to do in what order

1. **Project-starter publishes the headline batch** (the upskilling triad: `agentic-upskilling`, `orchestration-cataloging`, `lessons-learned`) to `claude-skills-marketplace`. This is the recruiting signal — the named framework Liz can be associated with.
2. **Project-starter publishes the capability-breadth batch** (`agentic-skill-design`, `design-evaluation`, `documentation`, `document-parsing`, `deep-research-pattern`, `eval-deep-research`, `next-actions-planning`). This demonstrates the body of work, not a one-off.
3. **Rewrite both `SKILLS.md` files in project-starter** with the tier structure in §4 above. Replace fragile install paths with marketplace-installable equivalents.
4. **Update `templates/_common/CLAUDE.md`** to reference the recommended skill discipline (brainstorming before build, verification before claiming done, token-discipline rules).
5. **Consider a `templates/research-app/` variant** — bundling `deep-research-pattern` + `eval-deep-research` + `document-parsing` + `academic-research-skills`. This is a real workflow shape that doesn't fit cleanly under either agent-app or ui-app.
6. **Post-launch: publish `open-source-documentation`** as a credibility marker once Make_Skills's running app demonstrates the discipline.

---

## 6. Why publish now and not at launch

Earlier framing said "publish at launch so the framework and product reinforce each other." That's true *in isolation*, but it ignores recruiting.

- The launch is far enough away that waiting means going dark on personal-brand-building during the period when collaborators most need to find Liz.
- Skills published with author attribution become a low-friction way for collaborators to discover capability — they install a skill, see it's well-thought-out, follow the author back to the running platform.
- The skills don't need a running app to demonstrate value. Each skill is a small but real intellectual artifact. The body of 10 makes the case the running app *will be worth their time*.

The trade-off: publishing now means people read the framework with no demo. But the framework reads well on its own — the upskilling triad is a complete operational story, not a teaser.

---

## 7. Broader project-starter improvements (beyond SKILLS.md)

Beyond the `SKILLS.md` fixes in §2-3, the project-starter itself has improvement opportunities. These are extracted from what's working in Make_Skills's own discipline that hasn't yet propagated downstream.

### `templates/_common/CLAUDE.md` improvements

Currently `_common/CLAUDE.md` is the base context. It should include — and where it doesn't, should be expanded to include:

- **Persistent memory hierarchy** (auto-memory file → proposals → plans → UX_CONTRACT → git history → runtime memory). Make_Skills's `CLAUDE.md` has this. Project-starter should too.
- **Token discipline table** (use Glob not `ls -R`, use Grep with head_limit, use Edit not Write, etc.) — Make_Skills's CLAUDE.md has this.
- **Voice/tone rule** (no marketing voice; describe what is, not what it isn't) — load-bearing for documentation quality.
- **Commit + PR discipline** (small PRs, always `gh pr create`, never `--no-verify`, never `--amend` on pushed commits).
- **Serena MCP recommendation** — the project-starter's `_common/.mcp.json` should include the Serena server snippet, with a note about installing `uv` locally.

### `templates/_common/docs/` skeleton

Make_Skills uses: `proposals/`, `plans/`, `decisions/`, `test-runs/`, `runbooks/`, plus the root `UX_CONTRACT.md` (for UI variants).

Project-starter currently ships `proposals/`, `plans/`, `test-runs/`. Worth adding:

- **`decisions/`** — ADRs. The `documentation` skill (Liz's, soon to be published) explains the format. Light-weight Status/Context/Decision/Consequences template.
- **`runbooks/`** — operational guides. Useful once a project has anything deployed.

### `templates/ui-app/docs/UX_CONTRACT.md` — fill out fully

The current UX_CONTRACT in project-starter is partial. Make_Skills's UX_CONTRACT.md is comprehensive and could be the template source. It covers:

- Rule Zero: attention before reveal
- The IDENTITY-TO-HABIT arc (now referenced in published `onboarding-psychologist` skill)
- Two-language coherence
- Empty vs filled — `?` slots and `fill-pop` cards
- Hand-crafted, attempt-aware feedback
- Color semantics table
- Animation budget
- Navigation "one place per concern" rule
- Voice/tone
- Accessibility/touch non-negotiables
- Anti-patterns to refuse
- 13-item review checklist

### New variant: `templates/research-app/`

The current binary split (agent-app vs ui-app) misses the **research-agent** shape. A research-app variant would bundle:

- `deep-research-pattern` (Liz's) — 3-role topology
- `eval-deep-research` (Liz's) — DRB harness
- `document-parsing` (Liz's) — PDF/Office tooling
- `academic-research-skills:ars-*` family — paper-writing workflow
- `firecrawl:firecrawl-search` + `firecrawl-scrape` — web research
- `huggingface-skills:huggingface-papers` — arXiv/HF discovery

The research-app variant has its own architectural needs (planner/researcher/orchestrator separation, citation grounding, RACE+FACT eval) that don't fit agent-app or ui-app cleanly.

### `scripts/` additions

Currently project-starter has scaffolding scripts. Worth adding:

- **`sync-upstream.sh`** — pulls the upstream `anthropics/skills` library to a gitignored `skills/_upstream/`, so the user's project can reference reference skills without vendoring. Make_Skills has this pattern working.
- **`promote-to-admin.py`** — for hosted-multitenant variants that need admin bootstrapping. Make_Skills has this.

### `CLAUDE.md.extension` pattern

Project-starter uses `CLAUDE.md.extension` files in `agent-app/` and `ui-app/` that extend `_common/CLAUDE.md`. This is good. Worth documenting in `CONTRIBUTING.md` so contributors know how variants compose.

### Honest audit — what's good in project-starter that should stay

- **The variant pattern** (`_common/` + per-variant overlays) — clean, extensible, easy to add new variants
- **The `.mcp.json` per-project pin** — better than relying on user-level MCP servers
- **The `docs/assets/thumbnail-illustrative.svg`** — a real visual identity for the repo (seed sprouting into branches). Most starter templates skip this; project-starter is professional-looking from first glance.
- **The README structure** — clear variant table, three install methods (PowerShell / Bash / npx), examples of when to use each variant
- **The CONTRIBUTING.md** — documents how to add new variants

### What to *not* do

- **Don't add too many variants.** The current 2 + research-app (proposed) = 3 is plenty. Each variant has maintenance cost. Don't add a "mobile-app" variant without real demand.
- **Don't ship pre-installed skills.** The `SKILLS.md` pattern (referencing skills + showing how to install) is correct. Bundling skills into the template means stale skills.
- **Don't try to handle every stack.** Project-starter is opinionated. Next.js for ui-app, FastAPI+deepagents for agent-app. Pick the strong defaults and let users fork if they want different.

---

## 8. Open questions

- Does project-starter want the published-by-Liz skills referenced in CLAUDE.md by namespaced plugin name (`lizo-skills/agentic-upskilling`) or by short name (`agentic-upskilling`)? Namespaced is unambiguous; short is more readable. The current style uses short names.
- Should `agentic-skill-design` and `agentic-upskilling` ship as **separate plugins** in the marketplace, or **one bundled plugin** ("liz-osborn-agent-discipline") containing both? Separate is more granular; bundled is a stronger authorship signal. Recommend separate for now — easier to point individual installers at the one they need.
- Is there a **third variant** worth adding (`research-app` or `science-app`) bundling the research skills? The current binary split (agent-app vs ui-app) misses the research-agent shape, which has elements of both.

---

## References

- [`Lizo-RoadTown/project-starter`](https://github.com/Lizo-RoadTown/project-starter) — the repo being recommended for
- [`Lizo-RoadTown/claude-skills-marketplace`](https://github.com/Lizo-RoadTown/claude-skills-marketplace) — where the Liz-authored skills publish to
- [`Lizo-RoadTown/Make_Skills`](https://github.com/Lizo-RoadTown/Make_Skills) — source-of-truth repo where the running app and the strategic skills (in `skills_private/`) live
- The `skills_private/` directory in `Make_Skills` (gitignored) — source for the 3 currently-proprietary skills being moved to publish
