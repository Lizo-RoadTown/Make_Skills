# Orchestration catalog — 2026-04-29

## Methodology

Surveyed:
- 30 most recent commits (`git log --oneline -50`)
- All 7 active proposals in `docs/proposals/`
- All 2 plans in `docs/plans/` (this one + the next-actions plan written today)
- Existing subagents (`subagents/planner`, `subagents/researcher`)
- Existing scripts (`scripts/backfill-claude-code.py`, `smoke-test-llamaparse.py`, `sync-*` x4)
- The recent conversation pattern across the Pillar 1A → BYO Ollama → tone sweep → Pillar 0 → planning sequence

Scoring: Frequency × Mechanical fit × Time-per-run, each on a 1-5 scale, multiplied for a total. Threshold for tool: ≥60. Subagent: 30-59. Skill: 15-29. Park: <15.

## Patterns observed (frequency-ordered)

### 1. Parallel research bursts — observed 4+ times

- **Where:** Pillar 0 tenant abstraction (4 parallel agents on multi-tenant patterns / FastAPI scoping / LanceDB / LangGraph saver). Also Render config research, document-parsing tool research, deep-research-stack research earlier in the project.
- **Shape:** Take an unfamiliar topic, decompose into 3-5 focused angles, fan out to general-purpose agents in parallel, wait for completion, synthesize into a proposal section. Each agent gets a self-contained brief with: the question, what's already known, what to skip, a target word count, and required citations.
- **Variable:** The topic, the decomposition, the brief specifics.
- **Score:** Frequency 5/5 · Mechanical 4/5 (decomposition is the variable; everything else is identical) · Time 4/5 (each pass is 30-60 min real time, plus synthesis) = **80**
- **Recommendation:** **Subagent** — `subagents/researcher-coordinator/`. Persona reads the topic + project context, decomposes into N parallel briefs (with a default of 4), fans out, waits, synthesizes a structured "research findings" section ready to drop into a proposal. Output schema known. Inputs known (topic + project context). The judgment piece (decomposition quality) is the reason it's a subagent and not a tool.
- **Concrete next step:** Create `subagents/researcher-coordinator/` with `AGENTS.md` + `deepagents.toml`. System prompt: "You decompose unfamiliar topics into 3-5 parallel research briefs and synthesize the results. Each brief is self-contained — assume the executing agent has zero context. Synthesis output is structured: consensus findings / disagreements / open questions / cited sources." Tools: spawn parallel general-purpose agents (LangGraph subgraph or simple `asyncio.gather`).

### 2. Design-proposal authoring — observed 7 times

- **Where:** `docs/proposals/agent-builder-flow.md`, `agent-creatures-ui.md`, `agent-retirement-and-clan-optimization.md`, `byo-claude-code-via-mcp.md`, `byo-personal-ollama.md`, `pillar-0-tenant-abstraction.md`, `quest-system.md`. All authored 2026-04-28 → 2026-04-29.
- **Shape:** Same template every time — Status / Authors / Date frontmatter, Problem section, Insight section, Decision/Recommendation, Schema or Code sketch, Phases or Implementation steps, Two-mode notes, Open questions, References. The body adapts; the structure does not.
- **Variable:** Topic, schemas, phase counts.
- **Score:** Frequency 5/5 · Mechanical 4/5 (template is fixed; body is judgment) · Time 4/5 (each proposal is ~30 min of actual writing) = **80**
- **Recommendation:** **Skill** — `skills/proposal-authoring/SKILL.md`. The mechanical core is the template + section list; the judgment is the body content, which the user wants to keep human-loop-able. Skill captures the template + the discipline of "no marketing language" (already in `feedback_documentation_tone.md`). Could later graduate into a tool that scaffolds the file with frontmatter and section stubs, but a skill is the right level today.
- **Concrete next step:** Write `skills/proposal-authoring/SKILL.md` with the canonical section list (frontmatter / Problem / Insight / Decision / Schema or Code / Phases / Two-mode notes / Open questions / References / Sources), the tone rules (state-what-is, no defensive contrasts), and a `references/template.md` stub. Optional v2: a `scaffold_proposal(topic, slug)` tool that creates the file pre-stubbed and links it from `docs/proposals/README.md`.

### 3. Schema migrations across stores — observed 3 times

- **Where:** Initial Postgres setup (LangGraph checkpointer + analytics tables), LanceDB schema with embeddings, Pillar 0 `tenants` + `conversations` + `tenant_id` column on records.
- **Shape:** Idempotent migration runner that touches Postgres AND LanceDB with default-tenant backfill. Hooked into FastAPI lifespan startup. Always: `CREATE TABLE IF NOT EXISTS`, `INSERT … ON CONFLICT DO NOTHING`, `add_columns({...})` with SQL defaults, `create_scalar_index(...)` with try/except, log lines for each step.
- **Variable:** Table names, column types, RLS policies, LanceDB columns.
- **Score:** Frequency 3/5 · Mechanical 5/5 (the idempotent-runner shape is identical) · Time 3/5 (~20 min per migration) = **45**
- **Recommendation:** **Subagent** — `subagents/schema-migrator/`. Reads a migration spec (target tables, columns, indexes, RLS policies), produces the Python migration module (`migrations.py`-shaped), and a corresponding isolation test stub. The user reviews and the agent runs `docker compose up -d --build api` to verify. The subagent is the judgment piece (which tables get RLS? what column type? what default backfill?). The runner is already a tool (`migrations.run_all`).
- **Concrete next step:** Create `subagents/schema-migrator/`. Inputs: a migration intent in plain English ("add `tenant_secrets` table with encrypted-column for storing per-tenant API keys"). Outputs: the migration code, the indexes, the RLS policy, an isolation test fixture, and a smoke test plan.

### 4. Endpoint scoping for tenant abstraction — observed across 8 endpoints in one session

- **Where:** Pillar 0 commit, eight endpoints in `platform/api/main.py` updated to take `ctx: TenantContext = Depends(get_current_tenant)` and pass `ctx.tenant_id` through.
- **Shape:** Every tenant-touching endpoint gets the same Depends + signature change + helper-function pass-through. The transformation is mechanical.
- **Variable:** Which endpoints (a one-time finite list per scoping pass).
- **Score:** Frequency 1/5 (might recur with new pillar additions, but mostly one-time) · Mechanical 5/5 · Time 2/5 (~5 min per endpoint, 40 min total) = **10**
- **Recommendation:** **Park** — Pillar 0 covered the existing endpoints. Future endpoints will add Depends as part of the per-feature work. Don't build an "endpoint scoper" — it's solving last quarter's problem.

### 5. Isolation test authoring — observed once (4 tests)

- **Where:** `platform/tests/test_pillar_0_isolation.py`, four tests covering LanceDB cross-tenant filter, public-commons crossover, Postgres RLS with non-superuser role.
- **Shape:** Fixture cleanup pattern, two tenant UUIDs, insert-under-A / read-under-B pattern, assert isolation. RLS-specific tests need a non-superuser role spun up in the fixture.
- **Variable:** What's being tested (which table, which filter).
- **Score:** Frequency 1/5 (one pass, but every new tenant-scoped table needs one) · Mechanical 4/5 (fixture pattern fixed; assertions vary) · Time 3/5 (~30 min per test set) = **12**
- **Recommendation:** **Skill** — `skills/tenant-isolation-testing/SKILL.md`. Captures the fixture pattern, the non-superuser role gotcha, the cleanup discipline. Not a subagent (judgment-light) and not a tool yet (every test set is a one-shot composition). Promotes to a tool when there are 5+ test sets in the repo.
- **Concrete next step:** Write `skills/tenant-isolation-testing/SKILL.md` with the fixture template, the cross-tenant assertion pattern, and the non-superuser-role recipe.

### 6. Decision matrix authoring — observed 3+ times today alone

- **Where:** Today's MS Foundry pattern chart, today's Claude Console comparison chart, today's design-evaluation file. Earlier: Pillar 0 architecture pattern comparison (the four research agents implicitly converged into a matrix).
- **Shape:** Multiple options × multiple dimensions × scored cells × recommendation.
- **Variable:** Topic, options, dimensions, weights.
- **Score:** Frequency 5/5 · Mechanical 4/5 · Time 3/5 (15-30 min per matrix) = **60**
- **Recommendation:** **Skill (already exists)** — this is exactly what `skills/design-evaluation/SKILL.md` (created today) captures. Done.
- **Concrete next step:** None. Use it.

### 7. Doc copy tone-sweeps — observed once (commit `a2040a1`)

- **Where:** Sweep across README + 8 docs + 4 UI pages to remove self-congratulatory framing per `feedback_documentation_tone.md`.
- **Shape:** Read each file, identify "real X not Y" / "the unlock" / defensive contrasts / conversation-language, replace with plain "what is" descriptions.
- **Variable:** The files, the specific phrases.
- **Score:** Frequency 1/5 · Mechanical 4/5 (the patterns are reproducible) · Time 4/5 (~2 hours for the sweep) = **16**
- **Recommendation:** **Skill** — `skills/tone-sweep/SKILL.md`. Captures the anti-pattern catalog and the systematic file-walk procedure. Likely useful again whenever marketing/conversation language drifts back in.
- **Concrete next step:** Write `skills/tone-sweep/SKILL.md` with the anti-pattern table from `feedback_documentation_tone.md`, the recommended file-walk order, and the diff/commit shape.

### 8. UI page scaffolding (route → form → API client → backend) — observed for /memory, /observability, /skills, /docs, /agents, /upskilling, /roadmap

- **Where:** Multiple pages built across the visible-UI commit and follow-ups.
- **Shape:** Next.js App Router page → fetcher to FastAPI → backend endpoint → page render with Tailwind.
- **Variable:** The data model, the chart/list shape.
- **Score:** Frequency 4/5 · Mechanical 3/5 (form/list pattern repeats; shape varies a lot) · Time 4/5 = **48**
- **Recommendation:** **Subagent** — `subagents/ui-scaffolder/`. Inputs: the data model (LanceDB or Postgres table), the page shape (list / form / dashboard / chart), the route. Outputs: the page component, the FastAPI endpoint, the fetcher hook, types. Judgment piece: which Tailwind primitives, which layout, what empty state. Takes the existing pattern and accelerates the next page from ~2h to ~30m.
- **Concrete next step:** Create `subagents/ui-scaffolder/` with persona that knows the codebase's conventions (zinc-* color scale, Tailwind utility-first, App Router page-per-route, fetcher pattern). Use it for the next pages: `/sessions`, `/credentials`, `/templates`.

### 9. Memory recording for cross-session continuity — observed across the whole session

- **Where:** `feedback_documentation_tone.md` was saved during this session and `feedback_agentic_skills.md` from a prior session. The pattern of "save this signal so future sessions don't drift" recurred.
- **Shape:** User states a preference / correction → save as `feedback_*.md` or `project_*.md` with frontmatter (name, description, type) and update `MEMORY.md` index.
- **Variable:** Topic, content.
- **Score:** Frequency 5/5 · Mechanical 5/5 (the format is fixed) · Time 1/5 (~30 sec per record) = **25**
- **Recommendation:** **Skill (already in the prompt)** — the auto-memory pattern is in the system prompt as guidance, not yet a skill file. Keep it as system-prompt guidance for now since making it a skill would be moving it sideways.
- **Concrete next step:** None. The auto-memory loop is working.

## What we already have (don't duplicate)

- `subagents/planner/` — generic planner subagent. Useful, but not specific to the recurring patterns above.
- `subagents/researcher/` — generic researcher subagent. Doesn't coordinate parallel work; that's the gap.
- `skills/agentic-skill-design/` — meta-skill for authoring agentic skills. Foundational.
- `skills/agentic-upskilling/` — promotion criteria for skill → tool. Foundational.
- `skills/lessons-learned/` — extract preferences from transcripts. Used by the recorder.
- `skills/roadmap-maintenance/` — already covers ROADMAP.md updates.
- `skills/web-app-scaffold/` — exists but is for scaffolding new Next.js apps, not pages within an existing one.
- `skills/document-parsing/`, `skills/deep-research-pattern/`, `skills/eval-deep-research/`, `skills/documentation/`, `skills/open-source-documentation/` — content-domain skills, not orchestration patterns.
- `skills/design-evaluation/` (today) — covers decision-matrix pattern.
- `skills/orchestration-cataloging/` (today) — this skill itself; recursively covers its own pattern.
- `skills/next-actions-planning/` (today) — covers the "what next" pattern.

## Recommended order to build

1. **`subagents/researcher-coordinator/`** — score 80, highest impact. Every future deep-dive (auth provider research, knowledge-graph design, agent-comms tracing instrumentation) starts here.
2. **`skills/proposal-authoring/`** — score 80, second-highest. Scaffolds the next 3-5 proposals. Reduces each from 30 min of writing to 10 min of judgment + 5 min of fill-in.
3. **`subagents/schema-migrator/`** — score 45. The next obvious migration is `tenant_secrets` (for BYO Ollama Stage 2 + auth keys); building this subagent now means that migration takes 10 min instead of an hour.
4. **`subagents/ui-scaffolder/`** — score 48. The next 2-3 pages (`/sessions`, `/credentials`, `/templates`) all need this; building the subagent first saves time across all of them.
5. **`skills/tenant-isolation-testing/`** — score 12, but cheap to author. Captures the non-superuser-role gotcha so the next migration doesn't relearn it.
6. **`skills/tone-sweep/`** — score 16, low priority but easy. Defends against language drift.

## Parking lot

- **Endpoint scoping for tenant abstraction** — Pillar 0 done; future endpoints just add Depends as part of feature work.
- **Memory recording loop** — already working as system-prompt guidance; promotion to skill is sideways motion.

## What this implies for self-correcting orchestration

The two highest-impact captures (`researcher-coordinator` + `proposal-authoring`) form a **build pipeline**: research → synthesize → propose. Adding `schema-migrator` + `ui-scaffolder` extends it: research → propose → migrate → scaffold UI. Building these in order means by the third or fourth proposal authored, the friction has dropped to "describe what you want, fill in the judgment, ship". That's the self-correcting loop the user asked about — each completed orchestration absorbs work that previously required ad-hoc decisions.

The user's interest in **dogfooding her own interface to track the build** maps cleanly: every subagent run becomes a Session in the future `/sessions` UI; every proposal becomes a row in `/templates` (since templates and proposals share structural DNA — both are "starting states for new work"); every captured pattern becomes a skill row in `/skills`. The platform becomes the build journal.
