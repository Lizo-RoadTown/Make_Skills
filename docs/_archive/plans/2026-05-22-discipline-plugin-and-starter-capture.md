# 2026-05-22 — Plan: discipline plugin + starter-repo capture

**Status:** Active. Captures the architecture and execution sequence Liz directed on 2026-05-22 evening: build the Claude Code plugin that auto-injects Make_Skills's discipline into any session, AND make sure project-starter scaffolds new repos with everything they need from day one. This document IS the artifact that ensures nothing is lost if the session ends; it survives session boundaries.

**Authors:** Liz, agent-assisted
**Date:** 2026-05-22

---

## 0. Why this plan exists (the failure mode it closes)

Today's session diagnosed a real architectural gap: Make_Skills built the discipline system into the running app's architecture (`agentic-skill-design`, `lessons-learned`, `agentic-upskilling`, etc.), but the same system never applied to the **developer's** Claude Code session. Claude Code working in this repo has been running as a generic agent inside a platform specifically designed to prevent that. Today's evidence:

1. Claimed Supabase when the codebase actually uses Drizzle + Postgres on Render (no PROBE)
2. Claimed Render containers were ephemeral when `render.yaml` provisioned a persistent disk (no PROBE)
3. Sold the file-based memory protocol as complete without flagging the cross-machine gap
4. Framed LanceDB+MCP as opt-in instead of built-in by architecture
5. Scoped MCP work as part of the running app instead of dev tooling
6. Wrote the discipline as `.claude/settings.json` in the repo instead of as a Claude Code plugin that auto-injects

Liz's exact correction sequence walked me from "files in the repo" → "memory + CLAUDE.md headline + hook in `.claude/settings.json`" → "no, that's still wrong, it must be a plugin that auto-injects." This plan captures the corrected architecture.

Quote from Liz: *"Write this so it isn't lost. Use whatever agents you need and create a systematic plan to capture EVERYTHING you need to make a good starter repo - like we are trying to do with project starter - AND what YOU need specifically. THen you are to use the skills you have to make the skills, which you have a lot, and do it. Create the plugins, upskill as you do, make what you need to. We'll update the plugins as we upskill."*

---

## 1. The two artifacts to build

The work splits into two distinct deliverables that compose:

### Artifact A — The `make-skills-discipline` Claude Code plugin

A standalone plugin published to `Lizo-RoadTown/claude-skills-marketplace`. Installable via `/plugin install make-skills-discipline@lizo-skills`. Once installed, **applies to every project the agent works in, automatically**, with no per-repo files required.

This is what makes the discipline auto-inject. The plugin is the wrapper.

### Artifact B — The project-starter template enhancements

Project-starter's `_common/` and per-variant templates updated so every new repo scaffolded from it:

- Knows it depends on the discipline plugin (one line in CLAUDE.md, not lifted files)
- Has the persistent-memory architecture (LanceDB + MCP + sync shim) baked in for `agent-app` variants
- Has the docs/ tree, memory-seed script, UX_CONTRACT (for ui-app), and runbooks ready out of the box

Project-starter v0.4.0 incorporates this. The discipline plugin is the developer-side complement; the memory architecture is the runtime-side complement.

---

## 2. Inventory — what goes in Artifact A (the plugin)

### 2.1 Plugin manifest (`plugin.json`)

```json
{
  "name": "make-skills-discipline",
  "description": "Discipline wrapper for Claude Code sessions working in Make_Skills or any project-starter-scaffolded repo. Auto-injects PROBE-first behavior, file:line citation enforcement, dev-tooling-vs-runtime distinction, and friction-as-memory writing. Same pattern as superpowers:using-superpowers — the harness's skill-matching surfaces it on every relevant message.",
  "version": "0.1.0",
  "author": { "name": "Liz Osborn" },
  "license": "Apache-2.0",
  "homepage": "https://github.com/Lizo-RoadTown/claude-skills-marketplace",
  "keywords": ["discipline", "hooks", "agent-behavior", "make-skills"]
}
```

### 2.2 Skill (`skills/make-skills-discipline/SKILL.md`)

The "use BEFORE every response" trigger-language skill body. Already drafted at `~/.claude/skills/make-skills-discipline/SKILL.md` (user-level, standalone); move into the plugin.

Six rules:

1. PROBE before asserting (Grep/Read + file:line citation)
2. Distinguish dev-tooling from runtime
3. Write friction as memory at the moment of correction
4. Cite skills by name when invoking them
5. Append to test-runs log at substantive task boundaries
6. Files over generalizations for the running app

### 2.3 Hooks (`hooks/`)

Three hook scripts handle the auto-injection:

**`hooks/user-prompt-submit.sh`** — adaptive pre-inject. Reads the user message via env var, pattern-matches intent ("does X use", "build Y", "where is Z"), echoes the relevant discipline rule(s) as a system reminder before I process the message.

**`hooks/pre-tool-use.py`** — guard rail. Fires before `Edit`, `Write`, or `Bash` on `platform/` or `web/` paths. Checks recent transcript for file:line citations matching the asserted facts. If missing, blocks with exit code 2 and a corrective message ("PROBE first; citations missing").

**`hooks/stop.py`** — end-of-turn audit. Scans my last response for unsubstantiated stack claims ("we use X", "runs on Y"). If found without corresponding file:line citations, injects a system reminder demanding verification before next response.

### 2.4 Optional extensions (deferred to v0.2.0+)

- `agents/discipline-coach.md` — a subagent that can be spawned to run `lessons-learned` programmatically
- `commands/probe.md` — `/probe <claim>` slash command that does the PROBE step explicitly
- `commands/cite.md` — `/cite <file:function>` helper that returns the exact file:line of a symbol

---

## 3. Inventory — what goes in Artifact B (project-starter enhancements)

### 3.1 `templates/_common/CLAUDE.md` additions

**Replace** the "Pre-response discipline" section (now duplicated in repos) with a one-line installation directive:

```markdown
## Discipline plugin (required)

This project uses the `make-skills-discipline` plugin for Claude Code. Install once per machine:

    /plugin marketplace add Lizo-RoadTown/claude-skills-marketplace
    /plugin install make-skills-discipline@lizo-skills

After installation, the discipline auto-applies to any Claude Code session in this repo.
```

That's it. The plugin owns the rules; the repo just declares the dependency.

### 3.2 `templates/agent-app/platform/api/memory/` — the LanceDB layer (built-in by architecture)

Lift from Make_Skills's PR #32 (Phase 1), generalize project-specific names:

- `lance.py` — LanceDB connection + insert + search + tenant scoping
- `mcp_server.py` — MCP server with the six tools (`memory_read`, `memory_list`, `memory_write`, `memory_delete`, `memory_search`, `memory_recall`)
- `recall.py` — Python-side recall helper
- `recorder.py` — record-writing helper

### 3.3 `templates/agent-app/platform/tests/test_memory_mcp.py` — generalized smoke tests

The 9 tests from Make_Skills/PR #32 with placeholder paths.

### 3.4 `templates/agent-app/scripts/memory_shim.py` — Phase 2 sync shim

From PR #33. Generalize the `_REPO_ROOT` calculation.

### 3.5 `templates/agent-app/scripts/seed-memory.{sh,ps1}` — memory protocol seed

Idempotent script that creates `~/.claude/projects/<project-key>/memory/MEMORY.md` + placeholder typed-memory files (`user_role.md`, `project_purpose.md`) showing the format.

### 3.6 `templates/_common/render.yaml` template — persistent disk provisioned

Mount path `/data/memory`, 1GB, `starter` plan (required for persistent disks).

### 3.7 `templates/_common/docs/` skeleton additions

Currently has: `proposals/`, `plans/`, `test-runs/`. Add:

- `decisions/` — ADRs
- `runbooks/` — operational guides

Each with a README explaining the role.

### 3.8 `templates/ui-app/docs/UX_CONTRACT.md` — fill out fully

Currently partial. Use Make_Skills's `docs/UX_CONTRACT.md` as the template source.

### 3.9 `templates/_common/.gitignore` additions

Add `skills_private/` (if the project might have a private skill stash) and `local-memory-data/` (the default `MEMORY_DATA_DIR` for local development).

### 3.10 `templates/agent-app/docs/runbooks/memory-mcp-local.md` — generalized runbook

From PR #32. Adjust paths.

### 3.11 `templates/_common/platform/requirements.txt` — base deps

For agent-app variants: `mcp>=1.0`, `lancedb>=0.18`, `fastembed>=0.5`, `pyarrow>=18.0`, `watchdog>=4.0`, `PyYAML>=6.0`, `fastapi>=0.115`, `uvicorn>=0.30`, plus testing.

### 3.12 New variant proposal: `templates/research-app/`

Bundles `deep-research-pattern` + `eval-deep-research` + `document-parsing` + ARS skills. Deferred to v0.5.0 per project-starter agent's response.

---

## 4. What I (Claude / Make_Skills agent) specifically need

Separate from project-starter scaffolding. These are things that improve MY own work in Make_Skills.

### 4.1 The discipline plugin installed and active (#1 priority)

Once Artifact A ships and is installed, every future Claude Code session in Make_Skills picks up the discipline automatically. This is the deliverable that prevents today's failures from recurring.

### 4.2 The test-runs log (currently sparse)

`docs/test-runs/` exists but I don't append to it consistently. Rule 5 of the discipline says I should — every substantive task boundary. Need a hook or behavioral trigger to make this consistent.

### 4.3 Access to public skills via plugins (currently happens automatically)

`superpowers`, `antigravity-bundle-*`, `episodic-memory`, `figma`, `firecrawl`, `huggingface-skills` — these are already installed and surfaced. No action needed; just need to remember to invoke them (the discipline plugin's hook helps).

### 4.4 The LanceDB+MCP memory layer running (cross-machine memory)

PR #32 + PR #33 ship Phase 1 + 2. Phase 3 (hosted JWT auth + HTTP transport) is the durable end-state. Until Phase 3, I'm still local-machine-bound; the value of the local-only path is proving the architecture and enabling the sync shim.

### 4.5 The upskilling loop active for my session

Currently the upskilling loop targets the running app's served agents (tenant=<student>). I should be the FIRST tenant. Need to wire the same observation/promotion mechanism for `tenant_id="default"` (developer session). Deferred — depends on Phase 3 of memory MCP.

### 4.6 A way to verify hooks/plugins are actually firing

In each new session, I should see evidence that the discipline plugin's hooks are firing — the pre-inject reminder visible in my context, citations enforced when I try to Edit, etc. Need a smoke test for the wrapper: at session start, confirm the plugin is loaded and hooks are wired. If absent, halt and notify Liz.

---

## 5. Subagent research dispatched (will fill in below)

Three parallel research questions need answering before the plugin build is precise:

### 5.1 What does an existing Claude Code plugin actually look like?

**Question:** Inspect 2-3 existing installed plugins (`superpowers`, `antigravity-bundle-essentials`, `episodic-memory`) and report: their plugin.json schema, where hooks live, where skills live, how hooks get registered, what env vars hooks receive, examples of working hook scripts. Goal: ground the Artifact A build in reality, not speculation.

**Dispatched to:** Explore agent. See §5.1.R for the findings.

### 5.2 What's in project-starter today, what's missing for Artifact B?

**Question:** Read `/c/Users/Liz/web-project-starter/` end-to-end. Report: current `templates/_common/` contents, current per-variant contents, what `setup.sh` and `setup.ps1` actually do, what install-skills mechanism exists, what's already partially wired vs. greenfield. Identify each item in §3 above as already-exists / partially-exists / not-yet.

**Dispatched to:** Explore agent. See §5.2.R for the findings.

### 5.3 What hook scripts have proven patterns?

**Question:** Search the broader Claude Code skill ecosystem (anthropics/skills, sickn33/antigravity-awesome-skills, muratcankoylan/Agent-Skills-for-Context-Engineering, others) for **any plugin that ships hook scripts**. Report: what hook events they target, what their scripts do, what patterns are working in the wild. Goal: avoid reinventing patterns that exist.

**Dispatched to:** general-purpose agent.

---

## 6. Execution sequence

Phase order matters because pieces depend on each other:

| Phase | What | Depends on | Status |
|---|---|---|---|
| 1 | This plan written + committed | nothing | **In progress (this doc)** |
| 2 | Research subagents (§5) run in parallel | Phase 1 | Queued |
| 3 | Integrate research findings into §2 and §3 | Phase 2 results | Queued |
| 4 | Build `make-skills-discipline` plugin (Artifact A) | Phase 3 | Queued |
| 5 | Publish plugin to `Lizo-RoadTown/claude-skills-marketplace` | Phase 4 | Queued |
| 6 | Refactor PR #33: remove `.claude/settings.json` from repo, replace CLAUDE.md "Pre-response discipline" with the plugin-install directive | Phase 5 | Queued |
| 7 | Project-starter enhancements (Artifact B) — single PR to `Lizo-RoadTown/project-starter` lifting the memory-layer files, adding the seed script, filling out UX_CONTRACT, adding the install-plugin directive | Phase 5 + Phase 6 | Queued |
| 8 | Smoke-test in a fresh Claude Code session: install plugin from marketplace, open Make_Skills, verify hooks fire, verify skill is surfaced | Phase 7 | Queued |
| 9 | Project-starter agent picks up Phase 7 changes, ships project-starter v0.4.0 release | Phase 7 | Queued (their work) |

Phases 1-6 are within reach in this session if context budget permits. Phases 7-9 likely span sessions.

---

## 7. Upskilling discipline during this work

Per the discipline rules (which this plan embodies), do the following while executing:

- **Rule 3 — Write friction as memory:** any moment I realize "I should have known X but didn't," save a `feedback_*.md` immediately.
- **Rule 4 — Cite skills by name:** when applying `agentic-skill-design` PROBE step, name it in the commit message and PR body.
- **Rule 5 — Test-runs log:** append to `docs/test-runs/2026-05-22-discipline-plugin.md` at every substantive milestone (plan written, plugin built, refactor done, etc.).

These rules aren't aspirational — they're the test of whether the architecture I'm building actually works on me. If I finish this work without writing any test-runs entries or feedback memories, the wrapper didn't fire.

---

## 8. Open questions to revisit

1. **Hook env-var contract.** What env vars does Claude Code expose to hooks? `CLAUDE_USER_MESSAGE`? `CLAUDE_TRANSCRIPT_PATH`? Need to verify via §5.1 research before the hooks rely on specific names.
2. **Plugin auto-activation.** Plugins are user-scope installed but should they conditionally activate per-project (e.g., only when CLAUDE.md mentions `make-skills-discipline`)? Or always-on? Probably always-on for v0.1.0; conditional is over-engineering.
3. **Hook timing on Windows.** Plugin hooks are shell scripts. On Windows, do `.sh` files run via WSL or via Git Bash? Need a `.cmd` or `.ps1` fallback or use Python (which works cross-platform). Probably standardize on Python.
4. **CLAUDE.md duplication risk.** The plugin's behavior is documented in the plugin's SKILL.md. The repo's CLAUDE.md installs the plugin. If both drift, which is canonical? Plugin is canonical; the repo's CLAUDE.md just references it.
5. **Project-starter agent coordination.** Once Artifact B lands in Make_Skills's docs, project-starter agent picks it up from the shared recommendations doc. Should the project-starter PR be drafted by Make_Skills agent (me) or wait for them to write it? Probably the latter — their domain.
6. **Plugin update cadence.** Liz: *"We'll update the plugins as we upskill."* That implies frequent minor-version bumps as friction patterns get added. Version bumping discipline needed.

---

## 9. References

- [docs/proposals/lancedb-memory-mcp.md](../proposals/lancedb-memory-mcp.md) — the runtime-side memory architecture
- [docs/plans/2026-05-21-project-starter-recommendations.md](2026-05-21-project-starter-recommendations.md) — the project-starter handoff doc
- [Lizo-RoadTown/claude-skills-marketplace](https://github.com/Lizo-RoadTown/claude-skills-marketplace) — where the plugin publishes
- [Lizo-RoadTown/project-starter](https://github.com/Lizo-RoadTown/project-starter) — the scaffolding repo this plan extends
- PR #32 (Make_Skills) — Phase 1 of the memory MCP
- PR #33 (Make_Skills) — Phase 2 + the misshapen in-repo wrapper (to be refactored per §6 Phase 6)
- Memory files informing this plan: `feedback_pre_response_discipline.md`, `feedback_cite_files_not_memory.md`, `feedback_distinguish_dev_tooling_from_runtime.md`, `project_discipline_is_a_plugin_not_a_repo_file.md`
