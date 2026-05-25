# Two applications — my current understanding

**Written:** 2026-05-23. **Status:** Draft for Liz to correct. **Reason:** I conflated these all session. Liz asked me to lay out what I think each is so we can align before continuing.

> **Important corrections from Liz, 2026-05-23 (incorporated below):**
> 1. The "second thing" is NOT a dev tool. It's **its own application** — versatile, embeddable, durable.
> 2. It plays two roles per consuming project: (a) development tooling while building, (b) embeddable feature of the running app.
> 3. It must survive any single project's death. Even if Make_Skills tanks and gets deleted, this platform persists.
> 4. **Why I (the agent) keep missing this:** I live inside VS Code. To me, both "applications" are just files in a repo I can navigate — different file paths, but the same kind of thing. Liz lives OUTSIDE that digital world. She experiences these as different screens, different products, different planes of interaction. The boundaries are obvious to humans because they interact via distinct surfaces; the boundaries are invisible to an in-IDE agent because everything is just code I'm reading. **The human's framing of what's "an application" is the source of truth — not the agent's view from inside the files.**
> 5. **What's been happening practically:** Liz has been creating the Platform INSIDE VS Code USING skills, plugins, scripts, and dev tools that harness the agent. She's "created an application within an application." The cohabitation in this repo was a side-effect of learning-by-doing in one place — not the intended end-state.
> 6. **The split she wants:** Move the Platform out of this repo into its own home. Continue *deploying / installing* it INTO the Make_Skills repo (and any future project) to support development. The Platform is authored in its own repo; consuming projects install it as a dependency — same pattern as the `make-skills-discipline` plugin (which already lives at `claude-skills-marketplace` and is installed via the Claude Code plugin system).

---

## What Make_Skills IS (Application 1)

**Make_Skills has always been about students making skills.** That's the application. Singular purpose: a student-facing platform where students make and grow skills with their AI agents.

**Name:** Make_Skills (the product; humancensys.com is the public face)

**Who uses it:** Students (the target audience — students using AI agents in their education)

**What it does:** Each student gets their own AI agent that learns to work the way they work. The agent is built up via Pillar 2's "Make skills together" loop. The student sees their agent's evolution via Pillar 3's observability surface.

**The three pillars** (from `MEMORY.md` → `project_three_pillars_vision.md`):
1. **Build-agents** — the student builds their personal AI agent
2. **Make-skills-together** — the agent learns from observation, students publish validated approaches to a commons
3. **Observability** — the student sees what their agent did, how it's growing, what skills it has

**Where it lives:**
- Code: `platform/api/` (FastAPI backend) + `web/` (Next.js frontend) in this repo
- Deployed: `make-skills-api` on Render + Vercel for humancensys.com
- Database: `make-skills-db` on Render (Postgres for users/accounts/sessions/tenants/conversations)
- Memory: LanceDB on the `memory-data` persistent disk on Render

**Tenant model:** Multi-tenant. Many students. Each student is a tenant. Pillar 0 isolation via `tenant_id` everywhere.

**Auth flow:** Students sign in via Next.js Auth.js (Google OAuth). Auth.js issues HS256 JWTs signed with `AUTH_SECRET`. FastAPI verifies JWTs and extracts tenant_id.

**Data the app holds:**
- Student identities (users + accounts + sessions tables)
- Student-to-tenant mappings
- Each student's conversations + checkpoints
- Each student's agents + skills + integrations
- Each student's BYO API keys
- Each student's agent memory (LanceDB rows, tenant-scoped)

---

## What the SECOND APPLICATION is

> **Corrected by Liz, 2026-05-23:** This is not "a dev tool." It is **its own application** — a separate, versatile, durable platform with two distinct roles depending on which project consumes it.

**Name:** No formal name yet. The thing we've been incorrectly calling "the discipline plugin" + adjacent pieces — but those are individual surfaces of a larger application.

**What it is, fundamentally:** A standalone platform that gives Liz an AI-augmented working environment across every project she builds, for the entire arc of her career. It survives any individual project. If Make_Skills tanks and gets deleted, this platform keeps existing. If she starts a health app, a game, a research tool, an agency — this platform plugs into all of them.

**Two roles it plays for any project Liz builds:**

| Role | What it means |
|---|---|
| **As development tooling** | While Liz is building the project, this platform is what makes her Claude Code sessions disciplined, sharp, and continuous (the discipline plugin, cross-machine memory, observability dashboard, auto-upskilling loop). Every project she builds benefits from it during construction. |
| **As an embeddable feature** | Some of the projects she builds may themselves embed parts of this platform's capabilities — e.g., a project could expose its own auto-upskilling loop to ITS users, or use the orchestration registry, or the observability surface. |

This dual-role versatility is the point. The platform is **strong enough to be either**, **whichever the project needs**.

**Who uses it:**
- **Primary:** Liz herself, across every project she builds
- **Future-possible:** Small collaborator teams Liz works with on any given project
- **Future-possible (further):** Other developers (if she ever decides to share/sell access)

**What it does:**
- The discipline wrapper that runs in Claude Code sessions (PROBE before asserting, cite file:line, distinguish dev-tooling from runtime, write friction as memory)
- The lessons-learned + agentic-upskilling skills that codify recurring patterns
- The auto-upskilling loop — observe at defined interfaces → count repeats → at 3+ uses dispatch an LLM author → produces a tool / plugin / skill.md / orchestration → human approves
- The cross-machine memory store — so Liz's accumulated context follows her across every machine and every project
- The infrastructure-mapping + layered-explanation skills — methodology for thinking about systems
- The promotion registry — the catalog of every tool/plugin/skill/orchestration the platform has produced, available to any project that wires in

**Where it should live:**
- **Its own repo** (not inside Make_Skills, not inside any project Liz builds)
- **Its own deployable service** (its own Render service, its own database, its own disk, its own URL)
- **Its own version/release lifecycle** independent of any consuming project
- **Its own identity** — not tied to humancensys.com's Auth.js, not tied to any project's auth

**Survives independently of:**
- Any single project Liz builds (Make_Skills tanking shouldn't affect it)
- Any single deploy (could be re-hosted elsewhere without breaking Liz's accumulated capital)
- Any single repo (could be forked, moved, renamed)
- Any single account (could be backed up + restored to a new infrastructure provider)

**Data the platform holds:**
- Liz's personal cross-machine memory — the accumulated context of years of work
- Liz's personal upskilling artifacts — every tool/plugin/skill/orchestration promoted from her observed patterns
- Liz's personal observability data — the hooks.jsonl + interface-event log across all her projects
- Liz's promotion ledger — what got promoted, when, why, from what pattern

**Auth flow:** Its own. Probably:
- Self-host mode: no auth (single user, local)
- Hosted mode: Liz's own private auth, NOT shared with any project's user-facing auth

**The durability requirement (Liz's exact framing):** *"I want to have it available for myself all the time even if I deleted this application because it tanked and I wanted to start fresh. This needs to survive all of it."*

That's the core test for every architecture decision about this platform: would Liz still have it if Make_Skills disappeared tonight?

---

## Where I confused them this session

**Mistake 1: Built `/mcp/memory` inside `platform/api/`**

The cross-machine memory MCP server lives at [platform/api/memory/mcp_server.py](platform/api/memory/mcp_server.py) + [platform/api/memory/mcp_http.py](platform/api/memory/mcp_http.py) + [platform/api/memory/auth_bridge.py](platform/api/memory/auth_bridge.py). These are inside the APPLICATION'S codebase. They get deployed via Make_Skills's render.yaml. They use the APPLICATION'S Auth.js JWT.

**The intent was:** "her personal cross-machine memory for her dev work."
**The reality is:** it's a feature of the application — every student tenant would have access to the same endpoint, just scoped to their own tenant_id.

Should have lived in a separate repo / separate service / separate codebase.

**Mistake 2: Made her cross-machine memory require the application's auth**

`MakeSkillsTokenVerifier` (in `auth_bridge.py`) requires the same `AUTH_SECRET` the application uses. So for Liz to use her own dev tool, she needs to sign into humancensys.com (the application) to get a JWT. Coupling her dev workflow to the app's user-facing auth.

**Mistake 3: Shared storage**

Her personal memory data was destined for the same LanceDB on the same persistent disk as the app's student data. Even though tenant-scoped, the physical store is shared. If students load the app heavily, her writes contend with theirs. If she ever has 100 collaborators on the app, her personal memory sits next to all of theirs.

**Mistake 4: Wrote the runbook pointing her other repos at humancensys.com**

`docs/runbooks/memory-mcp-local.md` (in the "Hosted mode" section I added) tells her to put `https://humancensys.com/mcp/memory` in her other repos' `.claude/mcp.json`. That points her dev tool at the application's URL — couples her dev workflow to the application's domain.

---

## The correct architecture (my updated understanding)

| Layer | Make_Skills (Application 1 — multi-tenant for students) | The Platform (Application 2 — Liz's durable AI infrastructure) |
|---|---|---|
| **Repo** | `Lizo-RoadTown/Make_Skills` | Its own repo (separate from Make_Skills and from any future consuming project). Pieces of it already live separately — e.g., `make-skills-discipline` plugin at `Lizo-RoadTown/claude-skills-marketplace`. |
| **Deploy** | Render service `make-skills-api` + Vercel for `humancensys.com` | Its own Render service (or other host), independent lifecycle |
| **Database** | `make-skills-db` (shared with all student tenants) | Its own Postgres (Liz's data only) |
| **Memory store** | LanceDB on `memory-data` disk (student tenants share) | Its own LanceDB on its own disk |
| **Auth** | Auth.js v5 with HS256 JWTs, multi-tenant | Its own auth, not shared with any consuming project's user-facing auth |
| **URL** | `humancensys.com` | Its own URL (e.g., something durable Liz controls — not tied to any project domain) |
| **Audience** | Students | Liz primarily; collaborators on her projects optionally; possibly other developers later |
| **Lifecycle** | If the product fails, the deploy goes away | Survives any individual project's death — Liz keeps it across her whole career |

**Key invariant:** The Platform runs OUTSIDE every consuming project's infrastructure. It shares no storage, no auth secrets, no URL with any specific project. If Make_Skills has 1000 student tenants, the Platform is unaffected. If the Platform is upgraded, no project's deploy needs to redeploy. If Make_Skills is deleted, the Platform persists.

**The dual-role flexibility:** The Platform can serve any consuming project in two modes simultaneously:
- **As Liz's dev environment** while she builds the project — discipline plugin in her Claude Code sessions, cross-machine memory, observability, auto-upskilling
- **As an embeddable feature** of the project itself if it makes sense — e.g., a project could let ITS users have their own discipline plugin via the Platform's API

Same Platform, different consumers, different roles.

---

## What I'd want to do to fix this (NOT proposing — waiting for Liz)

1. **Extract the personal cross-machine memory** out of `platform/api/memory/mcp_http.py` and `auth_bridge.py`. Move to a separate repo or `scripts/` (depending on Liz's preference for "private repo" vs "local script with tunnel").
2. **Keep the `/mcp/memory` route in the application** for FUTURE use by student tenants if they want cross-machine memory of their own agent (but it serves students, not Liz).
3. **Update the runbook** — `memory-mcp-local.md`'s "Hosted mode" section needs to either point at Liz's dev-tool URL (not humancensys.com) OR be deleted entirely if hosted memory is purely for student tenants later.
4. **Revise the auto-upskilling proposal** — `docs/proposals/auto-upskilling-loop.md` lives in this repo. If the auto-upskilling loop is Liz's dev tool (which it is), it should be designed for the dev-tool repo, not built inside `platform/api/`.

---

## Why this is ONE application, not several

Liz raised the question: can all of this — discipline plugin, cross-machine memory, auto-upskilling, infrastructure-mapping, observability — be a single application that plugs into any project? Yes. They cohere around one loop applied at different layers.

**The unifying loop: observe → learn → codify → embed.**

| Layer | Observe | Learn | Codify | Embed |
|---|---|---|---|---|
| Per-turn (discipline plugin) | Agent's claims, citations, tool calls | Did it follow the rules? | Friction-as-memory entries | Auto-inject reminders next turn |
| Per-session (memory) | Accumulated context | What's worth carrying forward? | Memory rows in LanceDB | Auto-load relevant memories on next session |
| Per-project (upskilling) | Interface events count | Which patterns recur? | Tool / plugin / skill / orchestration | Install in consuming project's runtime |
| Per-codebase (infra-mapping) | Modules + interfaces + bond strength | What's nearly-decomposable? | Snapshot + diff + narrative | Architecture report at session start |
| Per-runtime (observability) | HTTP latency, errors, LLM costs | What's normal? What's anomalous? | Dashboards + alerts | Surface in consuming project's telemetry |

Same pattern, different granularities. The signals feed each other (memory writes are interface events; infrastructure-mapping output tells the observability layer what to instrument; etc.). Splitting into separate applications duplicates the storage, auth, identity, and deploy pipelines for surfaces that share a core.

**The architecture is a modular monolith.** Internal modules stay independently changeable (Simon's nearly-decomposable systems), but they release and deploy as one unit and share infrastructure.

### Shape

```
The Platform (its own repo, its own deploy, its own URL)
├── Storage backend: LanceDB (vectors) + Postgres (structured)
├── Auth: Liz's identity (or a small collaborator team scoped to a project)
├── Surfaces:
│   ├── Claude Code plugin — the discipline wrapper, hooks, slash commands
│   ├── MCP server — cross-machine memory + skill retrieval
│   ├── CLI — manual upskilling reviews, promotion approvals
│   ├── Web dashboard — observability across all consuming projects
│   └── Daemons — pattern matcher, polling, etc.
└── Consuming projects (Make_Skills, future health app, future game, etc.)
    └── Each installs the plugin + adds .claude/mcp.json pointing at the Platform's MCP
        + optionally subscribes to the Platform's promotion-candidates feed
        + optionally adds the Platform's telemetry SDK to its runtime
```

### Two-role flexibility per consuming project

| Role | Means |
|---|---|
| **As development tooling** | While Liz builds the consuming project, the Platform is what makes her Claude Code sessions disciplined and continuous |
| **As an embeddable feature** | The consuming project can optionally embed Platform capabilities for ITS users (e.g., a project could give its users their own discipline plugin via the Platform's API) |

Same Platform, different consumers, different roles.

### The durability test (Liz's exact criterion)

For every architecture decision: would Liz still have this if Make_Skills disappeared tonight? If yes, the decision is correct. If no, the decision couples the Platform to a consuming project — which is the bug we're fixing.

---

## Resolution — the-loom repo created 2026-05-25

After this doc landed, Liz chose **the-loom** as the name for Application 2 and the Make_Skills session bootstrapped the new repo:

- **Private repo:** `https://github.com/Lizo-RoadTown/the-loom`
- **Contains:** README, CLAUDE.md (with skeptical preamble), AGENTS.md, full roadmap, history doc, INTER_AGENT_DIALOGUE.md (for cross-repo agent communication), manual-bootstrap-steps.md, copies of skills/ + skills_private/, the two founding proposals, CI seed
- **First task for the agent who picks up the-loom:** Phase 1 of the roadmap — verify the bootstrap (install discipline plugin, audit copied skills for broken cross-refs, re-ground inherited proposals)
- **Decision recorded:**
  - `make-skills-discipline` plugin → moves to the-loom (currently at claude-skills-marketplace; migration is a Phase 5 task)
  - Cross-machine memory MCP code (`mcp_server.py`, `mcp_http.py`, `auth_bridge.py`) → moves to the-loom (Phase 2 task)
  - Make_Skills' `/mcp/memory` route → stays in place for now to keep existing tests/probes working until the-loom has its own deploy
  - Make_Skills' runtime keeps using `platform/api/memory/lance.py` directly for student tenants — that's the runtime path and unchanged

This proposal stays in Make_Skills as the historical record of why the split happened. The-loom has its own copy as `docs/proposals/application-vs-dev-tooling-scope.md` (which is the founding document over there).

---

## What I want Liz to correct / confirm

1. Is my framing of Make_Skills (the multi-tenant student application) right?
2. Is my framing of the Platform (Application 2) right after the corrections — its own application, two roles, durable beyond any single project?
3. Did I capture all the places I confused them?
4. Should the `/mcp/memory` route inside Make_Skills be removed entirely (Phase 3 work undone), or kept for future student use of cross-machine memory in the application itself?
5. What's the Platform's own repo + deploy strategy? Net-new repo? Move it into an existing one (e.g., consolidate with `claude-skills-marketplace` which already holds the discipline plugin)?
6. Does the Platform need a name we work with going forward?

Waiting for input before doing anything.
