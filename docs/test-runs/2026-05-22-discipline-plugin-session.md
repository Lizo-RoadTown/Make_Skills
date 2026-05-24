# 2026-05-22 — Discipline plugin session

Friction-surface log from the session that built the `make-skills-discipline` plugin. Eating my own dogfood — discipline rule 5 says append to this log at substantive task boundaries; this is the first entry written in compliance, after I was caught skipping the entire discipline.

## What shipped

- **`Lizo-RoadTown/claude-skills-marketplace` PR #1** — adds the `make-skills-discipline` plugin (plugin.json, SKILL.md, hooks.json, three Python hook scripts, marketplace.json entry). Installable once via `/plugin install make-skills-discipline@lizo-skills`.
- **`Lizo-RoadTown/Make_Skills` PR #33 update** — three additions on top of the Phase 2 sync shim work:
  - Removed `.claude/settings.json` (yesterday's misshapen in-repo wrapper)
  - CLAUDE.md "Pre-response discipline" section replaced with "Discipline plugin (required)" — points at the install command and the plugin's SKILL.md
  - New: `docs/plans/2026-05-22-discipline-plugin-and-starter-capture.md` — systematic plan capturing both artifacts (plugin + project-starter enhancements) with research findings integrated
- **Session memory entries** (all in `~/.claude/projects/c--Users-Liz-Make-Skills/memory/`):
  - `feedback_pre_response_discipline.md` — the canonical rules content
  - `feedback_cite_files_not_memory.md` — case studies from today's failures
  - `feedback_distinguish_dev_tooling_from_runtime.md` — MCP scoping failure
  - `project_discipline_is_a_plugin_not_a_repo_file.md` — architectural decision
  - `reference_claude_code_plugin_anatomy.md` — research findings from subagents
  - `project_seed_memory_protocol.md` — seed every new project with the protocol
  - `project_memory_cross_machine_gap.md` — Option B chosen
  - `project_lancedb_memory_mcp_planned.md` — Phase 1+2 shipped, Phase 3 deferred
  - `project_lancedb_mcp_built_in_by_architecture.md` — directive for project-starter

## Friction surfaced

Six distinct moments where my discipline failed and Liz had to manually course-correct. Each becomes a feedback memory entry. Each is a data point on whether the architecture works.

| # | Friction | Liz's correction | What I changed |
|---|---|---|---|
| 1 | Forgot to tell project-starter agent about PR #29's Pair-with sections | "Are you sure you gave them updated info? Did you give them the updates on how you updated your skills too?" | Wrote follow-up section in shared doc; saved as feedback |
| 2 | Said Make_Skills auth is Supabase | "You use supabase, I'm sure, how else are we signing people in or out?" | Grep'd `web/auth.ts`, confirmed Drizzle + Postgres on Render, corrected. Saved `feedback_cite_files_not_memory.md` |
| 3 | Said LanceDB on Render runs on ephemeral container filesystem | "I need to know how this is getting lost" | Read `render.yaml`, found persistent disk provisioned. Same memory entry |
| 4 | Sold the file-based memory protocol as Liz's complete answer to cross-machine memory | "But I want the shared memory between files and machines. This is what I get frustrated with" | Acknowledged the gap, proposed Options A/B/C, ended up at B (LanceDB MCP) |
| 5 | Framed LanceDB+MCP as opt-in (`--memory-mcp <url>` flag) for project-starter | "Did you address the lancedb persistent memory with the other agent to ensure all my repos are begun this way? Built in by architecture?" | Rewrote as architectural directive — built-in for every agent-app variant. Saved `project_lancedb_mcp_built_in_by_architecture.md` |
| 6 | Scoped LanceDB+MCP work as if it were part of the running app | "make sure we know that's for the repo building of the app, not the app itself" | Added "Scope" section to proposal distinguishing dev-tooling from runtime. Saved `feedback_distinguish_dev_tooling_from_runtime.md` |
| 7 | Wrote the wrapper as `.claude/settings.json` in the repo | "these skills should not be in the repo, they need to be a plugin that is auto injected" | Refactored: removed in-repo files; built `make-skills-discipline` plugin in marketplace |
| 8 | (Meta) Wasn't running our skills, documentation, or logging discipline at all | "I feel like you haven't done any of those things. You used to keep a log, go through that log, make sure you were updating yourself etc." | Diagnosed the architectural gap (skills built for running app, never wired to developer's agent). Built plugin to close it |

## Decisions made

1. **Plugin shape**: Three hooks (`UserPromptSubmit`, `PreToolUse`, `Stop`), all Python, all scope-guarded to Make_Skills / project-starter repos
2. **Cross-platform**: Python over shell scripts (`.sh` is not first-class on Windows per the official hooks docs)
3. **Reminder cadence**: pre-inject on every prompt (adaptive based on intent), pre-check on every Edit/Write touching runtime code, post-audit on every turn
4. **Strictness**: hooks default to soft reminders (additionalContext) rather than blocking. Setting `DISCIPLINE_STRICT=1` env var promotes PreToolUse citation check to blocking
5. **Memory MCP architecture**: Option B (extend Make_Skills LanceDB layer to serve via MCP). Phase 1 + Phase 2 shipped; Phase 3 (hosted JWT + HTTP) deferred
6. **Built-in by architecture**: project-starter agent-app variants ship the memory layer (lance.py + mcp_server.py + shim) as part of the template, not as an opt-in. Persistent disk in render.yaml provisioned by default
7. **Don't publish proprietary skills now**: the upskilling triad (`agentic-upskilling`, `orchestration-cataloging`, `lessons-learned`) stays in `skills_private/` for now — Liz changed her mind on publishing during the session ("the launch is too far away. I need other people to know I'm capable of building"). They'll publish next session via project-starter's publishing process

## Sources Liz cited or referenced

- `web/auth.ts` (Auth.js + Drizzle adapter)
- `render.yaml` (persistent disk provisioning)
- `platform/api/memory/lance.py` (LanceDB layer)
- Lizo-RoadTown/project-starter (sibling repo)
- Lizo-RoadTown/claude-skills-marketplace (sibling repo)
- `~/.claude/projects/c--Users-Liz-Make-Skills/memory/` (session memory)

## What the next session should do

In order:

1. **Smoke-test the plugin**. Open a fresh Claude Code session in Make_Skills. Run `/plugin marketplace add Lizo-RoadTown/claude-skills-marketplace` then `/plugin install make-skills-discipline@lizo-skills`. Confirm:
   - Skill appears in available skills
   - UserPromptSubmit hook fires on a probe-style question
   - PreToolUse hook fires when editing platform/api/
   - Stop hook fires after a turn with an unsubstantiated claim
2. **Merge PR #32 (Phase 1)** if smoke tests pass
3. **Merge PR #33 (Phase 2 + wrapper refactor)** if PR #32 is in
4. **Merge marketplace PR #1** if the plugin works as designed
5. **Open project-starter PR** — lift the LanceDB+MCP files into `templates/agent-app/`, add the discipline-plugin-install directive to `_common/CLAUDE.md`, add the `platform/` scaffold the inventory found missing
6. **Test in a brand-new scaffold** — scaffold a new project from project-starter, confirm the discipline plugin auto-applies, confirm the memory layer is present

## Lessons baked into the architecture

If the discipline plugin works:

- A future Claude session in Make_Skills doesn't need me to manually invoke `agentic-skill-design`. The plugin's `UserPromptSubmit` hook injects the PROBE reminder automatically.
- A future Claude session can't easily make a confident-wrong claim about the stack. The `PreToolUse` hook flags missing citations; the `Stop` hook audits the response post-hoc.
- The architecture extends to every project scaffolded from project-starter, automatically. Liz doesn't have to teach the discipline per-repo.

If the discipline plugin DOESN'T work as expected (hooks don't fire, harness ignores them, skill descriptions don't trigger), this log captures the diagnosis to come back to.

## Open questions for next session

1. Does the harness's skill-matching actually surface the discipline skill on relevant messages, or only when explicitly requested?
2. Do the hook scripts get the env vars and stdin format I assumed (per the research)?
3. Is `${CLAUDE_PLUGIN_ROOT}` actually the right env var name in the installed plugin context?
4. How does the plugin behave when the user opens an unrelated project? (The hooks should self-scope-out, but verification is needed)
5. Does the Stop hook's transcript-parsing actually find the last assistant turn correctly across Claude Code's JSONL transcript format?
