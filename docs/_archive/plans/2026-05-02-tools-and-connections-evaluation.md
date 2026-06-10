# Tools and connections design evaluation — 2026-05-02

## Question

Given the local VS Code development environment that's accumulated over the past two weeks — 14 skills, 4 subagents, 17 upstream Anthropic skills, the Docker stack, the FastAPI backend, GitHub + Vercel + Render integrations — **what should bridge into the webapp dashboard at humancensys.com so that working from the dashboard is roughly as effective as working from VS Code?** And what new MCP servers / integrations should be added that aren't there yet?

Two distinct bridges to evaluate:
- **Agent-side bridge:** what tools/MCPs should the dashboard's running agent have access to (server-side, automatic)
- **User-side bridge:** what surfaces should the dashboard render so the user can operate (UI, manual)

## Inventory — what's actually here

### Skills in `skills/` (project-owned, 14 total)

| Skill | What it does | UI surface today |
|-------|--------------|------------------|
| agentic-skill-design | Meta-skill: PROBE/DECIDE/ACT/REPORT pattern for skill authoring | none — filesystem |
| agentic-upskilling | Promotion criteria for skill→tool | none |
| deep-research-pattern | NVIDIA AI-Q 3-role topology | none |
| design-evaluation | Tradeoff matrix for design questions | none |
| documentation | Generic docs writing | none |
| document-parsing | LlamaParse / Marker / Docling / Unstructured selector | none |
| eval-deep-research | Benchmark the deep-research stack | none |
| lessons-learned | Extract preferences from transcripts | none |
| next-actions-planning | "What to do next" planning skill | none |
| open-source-documentation | Public docs voice + structure | none |
| orchestration-cataloging | Find reusable patterns in recent work | none |
| proposal-authoring | Author proposals in house style | none |
| roadmap-maintenance | Update ROADMAP.md as work ships | partially — `/roadmap` page renders but doesn't expose the skill's tools |
| web-app-scaffold | Spin up a fresh Next.js + Vercel app | none |

`/skills` page exists and lists these via fileviewer api, but as **read-only markdown** — there's no "run this skill on this topic" affordance.

### Subagents in `subagents/`

| Subagent | Purpose | UI surface today |
|----------|---------|------------------|
| planner | Structured planning from a user request | none |
| researcher | Single research brief with citations | none |
| researcher-coordinator | Decompose + fan-out + synthesize (built tonight) | none |
| schema-migrator | Plain-English migration → idempotent SQL + Drizzle + tests (built tonight) | none |

`/agents` is a stub. None of these are configurable or invokable from the UI yet.

### Upstream Anthropic skills (gitignored, sync-able, 17 total)

`skills/_upstream/anthropics-skills/skills/` — synced via `scripts/sync-upstream.sh`:

`algorithmic-art` · `brand-guidelines` · `canvas-design` · `claude-api` · `doc-coauthoring` · `docx` · `frontend-design` · `internal-comms` · `mcp-builder` · `pdf` · `pptx` · `skill-creator` · `slack-gif-creator` · `theme-factory` · `webapp-testing` · `web-artifacts-builder` · `xlsx`

These are NOT visible in `/skills` (gitignored — exists only on Liz's laptop). Several are directly applicable (skill-creator, mcp-builder, claude-api, frontend-design, webapp-testing).

### MCP servers configured today (`.mcp.json`)

```json
{ "mcpServers": { "llama_index_docs": { "url": "https://developers.llamaindex.ai/mcp" } } }
```

That's it. **One** MCP server. The dashboard's running agent has access to LlamaIndex docs and nothing else.

### Backend capabilities (`platform/api/`)

| Module | Capability |
|--------|------------|
| `agent.py` | deepagents runtime + TenantScopedSaver |
| `auth.py` | JWT verifier (HS256 against AUTH_SECRET) |
| `db.py` | `tenant_conn()` helper with `SET LOCAL app.tenant_id` |
| `fileviewer.py` | exposes `/docs/tree`, `/docs/file`, `/skills/list`, `/skills/file` |
| `main.py` | FastAPI route surface |
| `memory/` | LanceDB + recorder + recall |
| `migrations.py` | schema migration runner |
| `model_registry.py` | 7 model providers (lazy-loaded) |
| `observability.py` | KPI aggregations |
| `roadmap/` | file-backed roadmap tools |
| `tenant_context.py` | ContextVar for tenant scoping |
| `tools/` | agent-callable tools (`query_db`, `recall`, etc.) |

### Other connections present

| Tool | Status | How it's used |
|------|--------|---------------|
| GitHub repo | Live, public, Apache 2.0 | Code source; PRs auto-deploy on Vercel + Render |
| Docker (local) | Running | postgres + api + grafana stack |
| Vercel | Connected | `make-skills` project, auto-deploys on push |
| Render | Connected | api on `make-skills-api`, Postgres `make-skills-db`, preview environments enabled |
| `.vscode/extensions.json` | Recommends 10 extensions | Python, Docker, TOML, YAML, markdownlint, Copilot, Claude Code |
| `.github/` | **Empty** — no CI, no templates | Gap |

### MCPs available in the broader ecosystem (not yet wired)

From the tool surface visible in this environment, the following MCP servers are accessible but not yet declared in the project's `.mcp.json`:

- **Vercel MCP** (used tonight for `get_runtime_logs`, `get_deployment_build_logs`, `list_deployments`)
- **GitHub MCP** (`mcp/server-github`) — repo ops, PRs, issues
- **Render** — partially via Render CLI which can install agent skills
- **Hugging Face MCP** — model/dataset/paper search
- **Context7** — live library docs (better than fetching from the web)
- **Playwright / browser** — end-to-end testing
- **Supabase MCP** — only relevant if migrating off Render Postgres
- Various code-analysis MCPs (memory, sequentialthinking, firecrawl, etc.)

## Options on the table

- **A. Status quo** — dashboard is chat + the new sidebar pages from tonight (Plans / Proposals / Test runs / Account / stubs)
- **B. Full mirror** — surface every local tool in the dashboard. Skill runner, subagent invoker, Docker control, GitHub PR review, deployment trigger, etc. Heavy.
- **C. Selective bridge** — bring **planning, observation, reusable assets** (skills, subagents, plans, logs) into the dashboard; keep **build operations** (Docker compose control, npm, git push) in VS Code where they belong.
- **D. Phased bridge (recommended)** — Option C, but sequenced. Each phase adds the highest-ROI surfaces that match what's working today.

## Dimensions that matter

| Dimension | Why it matters |
|-----------|---------------|
| **Teaching value** | The dashboard is the academic/student surface. Bringing the right tools means students can do real work; bringing the wrong ones (e.g. Docker control) overwhelms them with infrastructure. |
| **User-fit** | Liz operates the system from VS Code; students and hosted users from the dashboard. The same surface serves both — what's for whom? |
| **IDE redundancy** | Anything that's better-done-in-VS-Code (file editing, shell commands, `git`, `npm`) shouldn't be re-built in the dashboard. The IDE wins on those. |
| **Effort** | Days vs weeks per bridge. Inverse-weighted at parity. |
| **Two-mode-fit** | Self-host users access the dashboard locally; hosted users access humancensys.com. Both must work. |
| **Reusability** | A bridge that surfaces an existing artifact (the 14 skills, the 4 subagents) is much higher-leverage than building a new feature. |
| **Multiplayer extension** | Some surfaces (skills marketplace, sharable agents) are inherently multiplayer; bringing them now sets up Phase 2 of the project. |

## Tradeoff matrix

Score 1 (bad) — 5 (strong fit). 7 dimensions, 4 options.

| Option | Teaching | User-fit | IDE-redundancy | Effort | Two-mode | Reusability | Multiplayer | Total |
|--------|----------|----------|----------------|--------|----------|-------------|-------------|-------|
| **A. Status quo** | 2 (no skill/agent runners; students can't operate) | 2 (Liz operates from VS Code; dashboard isn't useful enough yet) | 5 (no overlap) | 5 (zero work) | 4 (works in both modes minimally) | 1 (existing assets stay invisible) | 1 (no commons surface) | 20 |
| **B. Full mirror** | 3 (overwhelming for students; Docker UI is wrong abstraction) | 3 (dashboard duplicates IDE; neither is the obviously-best place) | 1 (massive overlap with VS Code) | 1 (months of work) | 4 (works in both modes) | 5 (everything visible) | 4 (commons surfaces possible) | 21 |
| **C. Selective bridge** | 5 (right tools for students, no infrastructure noise) | 5 (Liz uses what fits each tool; students get the curriculum-shaped surface) | 5 (build ops stay in IDE; planning/observation move to dashboard) | 3 (4-6 weeks across phases) | 5 (clean two-mode model) | 5 (existing skills/subagents become first-class) | 5 (sets up Phase 2 multiplayer surfaces) | 33 |
| **D. Phased bridge** | 5 (same as C) | 5 (same as C) | 5 (same as C) | 4 (each phase ships independently; current capacity respected) | 5 (same as C) | 5 (same as C) | 5 (same as C) | 34 |

D differs from C only in sequencing — phases ship as discrete chunks, each independently useful.

## Recommendation: **D — phased selective bridge**

Sequenced into four phases, with concrete deliverables per phase.

### Phase 1 — already shipped (commits `ea03caa`, `6935251`, `7e047d7` on `test-auth`)

- Workflow-oriented sidebar (THINK / BUILD / TEST / OBSERVE / MANAGE)
- `/plans`, `/proposals`, `/test-runs` functional pages reading the markdown trees
- Account section in sidebar (signed-in profile + sign-out)
- Stubs for `/sessions`, `/credentials`, `/environments`, `/settings`

This phase made the dashboard reflect "what's happening" — observability over the project itself. The next phases bring tooling, not just visibility.

### Phase 2 — high-ROI bridges (~1 week of work)

The four highest-leverage surfaces, all reusing assets that already exist on the filesystem.

#### 2a. Skills runner — `/skills` becomes interactive

Today `/skills` lists markdown files. Make it list **runnable** skills with a "Use this skill" button per row. Clicking opens a guided form populated by the skill's frontmatter (name + description) and a free-text input for context (the topic, the question, the data). Submit invokes the agent with the skill loaded into its context.

- **Implementation:** `/skills/run/[name]` route + a server action that calls `agent.ainvoke({...}, config={"configurable": {"skill": name}})`. The agent runtime already loads skills via `agent_cfg.skills` in `agent.py:49`; we just expose a per-invocation override.
- **First wave of skills to expose:** proposal-authoring, design-evaluation, next-actions-planning, orchestration-cataloging, lessons-learned, roadmap-maintenance. The other 8 either need IDE context (web-app-scaffold) or are pre-loaded by default (deep-research-pattern via the researcher subagent).

#### 2b. Subagents inspector — `/agents` becomes the builder (Pillar 1B v1)

Today `/agents` is a stub. v1 goal: list the 4 existing subagents, show each's persona + skills + model + tools, and allow inline editing of the system prompt. Save writes back to `subagents/<name>/AGENTS.md` (self-host) or `tenant_users.subagent_overrides` (hosted, when the column lands).

This is the agent-builder-flow proposal's MVP — four fields, no 3D, no class taxonomy. Just the persona + the model + the skills allowlist + the tools allowlist. Per the [learning-tool design evaluation](2026-04-29-learning-tool-design-evaluation.md), 4 fields, 50/50 inline playground, "Generate" button.

- **First wave of subagents:** the existing 4. Future subagents authored through the UI rather than the filesystem.

#### 2c. Sessions / replay-with-trace — `/sessions` becomes Pillar 3a precursor

Today `/sessions` is a stub. v1: list of past chat sessions (rows in `conversations` filtered by tenant_id, joined with checkpoint counts), click into a row to see the full message trace + tool calls + token cost.

- **Data already there:** `conversations` (Pillar 0), `checkpoints/checkpoint_blobs/checkpoint_writes` (LangGraph), `memory_records` (LanceDB). All scoped by tenant.
- **Missing:** a `/observability/session/[thread_id]` endpoint that joins those tables and a UI that renders.

#### 2d. MCP servers UI — `/credentials` companion at `/integrations`

Show what MCP servers are wired in `.mcp.json`, with install/remove buttons. The skill `mcp-builder` from upstream Anthropic skills is the natural authoring tool. Today the only MCP wired is `llama_index_docs`; this surface makes it discoverable and extensible.

- **First MCPs to declare in `.mcp.json`:** `github` (PR/issue ops), `vercel` (deploys/logs), `context7` (live library docs), `playwright` (e2e testing). All four are heavily used in this session and would be agent-side default for any project of this shape.

### Phase 3 — depth (when there's data to show)

#### 3a. Logs viewer — `/observability/logs`

Surfaces Vercel + Render runtime logs in the dashboard via the MCPs Phase 2d wires up. Today these are accessible only via my `mcp__claude_ai_Vercel__get_runtime_logs` tool. Bringing them inline closes the "I have to leave the dashboard to debug" loop.

- **Implementation:** A `/observability/logs?source=vercel|render&since=...` page that calls the MCPs server-side and renders.

#### 3b. GitHub integration — `/integrations/github`

Show PRs, deploys, branches, recent commits. The MCP added in 2d does the heavy lifting; this is just the rendering surface. Useful for hosted-multitenant tenants who don't have local checkouts.

#### 3c. Docker / self-host status — `/environments` becomes interactive

For self-host users only: show container health (postgres, api, grafana), env vars present, recent restart count. Lets a self-host user diagnose their own deployment without leaving the dashboard. Skipped for hosted-multitenant.

### Phase 4 — multiplayer surfaces (Phase 2 of the platform itself)

#### 4a. Public skills marketplace — `/library/skills`

Lists skills marked `visibility='public'`. Anyone can install one to their workspace. The 17 upstream Anthropic skills become the seed catalog (mcp-builder, skill-creator, frontend-design are immediately useful). Custom skills authored by users are publishable into this commons.

#### 4b. Forkable agents — `/library/agents`

Lists agents marked `visibility='public'`. "Fork to my workspace" copies the persona + skills + tools into the user's own subagents. Shape mirrors GitHub's fork; the multiplayer instinct she's been describing.

#### 4c. Knowledge graph — `/library/knowledge`

Pillar 3c when ready. Out of scope for this evaluation; tracked separately.

## What stays IDE-only (intentionally)

These are NOT going into the dashboard. The IDE wins on each.

- **`docker compose` control** — VS Code's Docker extension does this well. The dashboard would be a worse version.
- **`git` operations** — VS Code Source Control panel + Git CLI. The dashboard offers nothing here.
- **`npm install` / `npm run build`** — terminal in VS Code is the right surface.
- **File editing in the underlying repo** — VS Code is a code editor; the dashboard isn't.
- **Local Postgres queries** — `render psql` or psql client. The dashboard's `/observability` shows what matters.
- **Skill authoring** (writing the SKILL.md frontmatter + body) — VS Code with markdown preview. The dashboard's `/skills` is for *running* skills, not authoring them.
- **Subagent persona authoring** — same: edit `subagents/<name>/AGENTS.md` in VS Code. The dashboard's `/agents` is for *configuring + running* subagents, not authoring from scratch.

The seam between IDE-authored / dashboard-configured matters: skills and subagents live as files in the repo (canonical authority), and the dashboard provides a read + tweak + run surface over the same files.

## What new infrastructure to add

These are gaps in the current setup that would benefit any phase:

### `.mcp.json` upgrades

Add these MCP server entries (exact config TBD per server's docs):

```json
{
  "mcpServers": {
    "llama_index_docs": { "url": "https://developers.llamaindex.ai/mcp" },
    "github":   { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" } },
    "vercel":   { "url": "https://api.vercel.com/mcp", "env": { "VERCEL_TOKEN": "${VERCEL_TOKEN}" } },
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] },
    "playwright": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-playwright"] }
  }
}
```

These are agent-side: the running deepagents runtime uses them to do its work. Each provides tools the agent can call. For example, `github` lets the agent read a PR's diff and comment; `vercel` lets it pull runtime logs (replicating the tool I used tonight).

### `.github/` directory (currently empty)

- `ISSUE_TEMPLATE/bug_report.md` and `feature_request.md`
- `PULL_REQUEST_TEMPLATE.md` — referencing the four-question two-mode discipline
- `workflows/test.yml` — GitHub Actions running the Pillar 0 isolation tests on every PR
- `workflows/deploy-status.yml` — surfacing deploy health to PR comments

### `docs/lessons-learned/` directory

A new section that's neither plans, proposals, nor test runs. Captures:

- Friction-surface journeys (the auth wire-up's eight surfaces)
- Anti-pattern catalogs (per-domain — Vercel, Render, Postgres, Auth.js)
- "Things that worked" recipes (the inverse — what's worth keeping)

The `lessons-learned` skill already exists; this is its filesystem home. Browseable in the dashboard via the same `MarkdownTreeBrowser` component used by Plans / Proposals / Test runs.

### Render CLI agent skills

The Render CLI documentation (you pasted it last night) mentions:

> "Manages Render agent skills for AI coding tools such as Claude Code, Codex, OpenCode, and Cursor."

Run `.\render.exe skills install` to install Render-specific skills into Claude Code. This gives the local agent direct knowledge of Render concepts without manual setup. Worth running as a one-time bootstrap.

## Lessons from this session that should be captured into the dashboard

The 8 friction surfaces from the auth wire-up are already documented in [`docs/test-runs/2026-04-29-auth-end-to-end.md`](../test-runs/2026-04-29-auth-end-to-end.md), which is now visible at `/test-runs` in the dashboard. The pattern repeats: every test run that surfaces friction lands as a markdown file in `docs/test-runs/`, which immediately appears in the dashboard. No additional work needed for visibility.

What's NOT yet captured but should be:

| Lesson | Where it should live |
|--------|----------------------|
| "Test on preview branches, not localhost" | Already a memory; should also become a skill at `skills/preview-branch-testing/` so the agent recommends it without being asked |
| "Render Postgres external URL is the one that resolves from Vercel" | A note in `docs/lessons-learned/render-postgres.md` plus a check in the future `subagents/schema-migrator/` output |
| "Auth.js DrizzleAdapter does instanceof PgDatabase check at module init — Proxy wrappers fail" | A note in `skills/proposal-authoring/SKILL.md`'s "common gotchas" section, OR a dedicated `docs/lessons-learned/authjs-v5.md` |
| "Render CLI's `render psql` shells out to local psql binary; needs psql or pgcli on PATH" | Same — `docs/lessons-learned/render-cli.md` |
| "PowerShell rejects `&&`; use `;` or two lines" | Already a memory; could also become a small `skills/powershell-friendly-commands/` skill |

Most of these already live as memories I captured during the session. The next pass of work should *flatten* the relevant ones into a public `docs/lessons-learned/` archive — visible to her in the dashboard AND to future contributors via the public docs.

## What this implies for the next action

After PR #10 merges to main, the next concrete step is **Phase 2a: Skills runner**. The infrastructure already exists (`fileviewer.py` exposes the markdown, `agent.py` already loads skills per-invocation, the new `MarkdownTreeBrowser` component is the rendering pattern). The work is a `/skills/run/[name]` route + a server action + a refresh of `/skills` to add "Use this skill" buttons. Probably 4-6 hours.

After that: a follow-up proposal `docs/proposals/dashboard-integrations.md` that locks in the Phase 2-4 list as the multi-month implementation roadmap, with each subphase getting its own short proposal as it comes due.

## Open questions

1. **Should the upstream Anthropic skills be brought in-tree (committed) or stay synced (gitignored)?** — Currently gitignored at `skills/_upstream/`. Bringing in-tree means contributors get them on clone but the repo grows. Recommended: **stay synced** (the sync script is documented and works); add a `/skills/marketplace` page that shows synced-but-not-installed skills as installable.

2. **Where does the line sit between "skill" and "subagent"?** — Skills are markdown wisdom loaded into the agent's context. Subagents are specialists with their own personas + scoped tools. The boundary in this evaluation:
   - If the user provides 90%+ of the work and the agent fills in templates → **skill** (e.g., proposal-authoring, design-evaluation)
   - If the agent does most of the work autonomously → **subagent** (e.g., researcher-coordinator, schema-migrator)
   When in doubt, start as a skill; promote to subagent when the user finds themselves running it 5+ times the same way (the agentic-upskilling promotion criteria already in place).

3. **Self-host users without OAuth — what's their dashboard experience?** — Self-host users don't sign in; the Account section sidebar shows "Sign in" forever. Should self-host show a different chrome (no Account section, no Sign in)? Or accept the current behavior as harmless? Recommended: a future `<SelfHostBanner>` component that detects PLATFORM_MODE on the agent side and replaces the Account section with a "Self-host mode — no auth needed" indicator.

4. **GitHub PR review surface — phase 3 or earlier?** — If the dashboard shows GitHub PRs (Phase 3b), it competes with VS Code's GitHub Pull Requests extension. Worth doing only if the multiplayer use case (peer review of student PRs) materializes. Defer.

## Sources

- The actual environment scan run on 2026-05-02 — see the inventory section above for skill / subagent / module counts
- [`docs/plans/2026-04-29-orchestration-catalog.md`](2026-04-29-orchestration-catalog.md) — the original capture of which patterns were ready to become reusable
- [`docs/plans/2026-04-29-learning-tool-design-evaluation.md`](2026-04-29-learning-tool-design-evaluation.md) — the upstream design call that established the workflow-oriented sidebar
- [`docs/proposals/sidebar-architecture.md`](../proposals/sidebar-architecture.md) — Phase 1's home; the formalization that shipped tonight
- [`docs/test-runs/2026-04-29-auth-end-to-end.md`](../test-runs/2026-04-29-auth-end-to-end.md) — the journey that surfaced what's worth capturing as lessons-learned
- Liz's framing 2026-05-02: *"types of tools I have access to here in VS Code and connections to my github repo and docker (such as mcp servers) that would allow me to work as efficiently in my new webapp dashboard"*
