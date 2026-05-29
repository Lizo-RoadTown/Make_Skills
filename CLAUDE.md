# Working in this repo

Project context for Claude Code. Loaded into every conversation. Keep it tight; if a rule belongs to a subsystem, move it to a subdirectory `CLAUDE.md` (e.g., `platform/CLAUDE.md`) instead of growing this file.

## What this repo is

The **engine** — agent runtime, skill compilation, model registry, memory MCP, Pillar 0 tenant scoping. Consumed by separate apps over HTTPS + MCP.

This is NOT:

- A student-facing product — that's [`Lizo-RoadTown/humancensys-app`](https://github.com/Lizo-RoadTown/humancensys-app) (the first consumer, extracted 2026-05-26 in PR #52)
- A dev tool for Liz — that's [`Lizo-RoadTown/the-loom`](https://github.com/Lizo-RoadTown/the-loom) (personal AI substrate, dev-time only, never touches deployed runtime)
- A specific UI, identity provider, or branding — consumers bring those

See [`docs/proposals/make-skills-engine-vs-consumer-scope.md`](docs/proposals/make-skills-engine-vs-consumer-scope.md) for the engine/consumer boundary.

## Discipline plugin (required)

This project depends on the `make-skills-discipline` Claude Code plugin (being renamed to `loom-discipline` as part of the-loom Phase 1; both names work during transition). Install once per machine:

    /plugin marketplace add Lizo-RoadTown/claude-skills-marketplace
    /plugin install make-skills-discipline@lizo-skills

The plugin auto-injects behavioral rules into every Claude Code session in this repo — PROBE before asserting, cite `file:line`, distinguish dev-tooling from runtime, write friction as memory at the moment of correction, cite skills by name, append to the test-runs log. Hook scripts enforce the rules; the skill body documents them.

The discipline-skills in `skills/` and `skills_private/` (`agentic-skill-design`, `lessons-learned`, `agentic-upskilling`, `orchestration-cataloging`, `next-actions-planning`, `design-evaluation`) are the longer-form discipline the plugin points at.

## The engine stack

| Layer | Tech |
|---|---|
| Runtime | FastAPI, deepagents, LangGraph, langchain (`model_registry` for swappable providers), psycopg, pgcrypto |
| Memory | LanceDB (`platform/api/memory/`), tenant-scoped via Pillar 0, single typed table for episodic + session memory |
| Auth | HS256 JWT (engine verifies tokens signed by consumers with shared `AUTH_SECRET`) |
| DB | Postgres on Render (external URL needed for tools), single schema, RLS on every tenant-owned table |
| Deploy | Render for `platform/api` + Postgres (engine has no frontend) |
| MCPs configured | github, context7, llama_index_docs, figma, firecrawl, huggingface (see `.mcp.json`) |

**Two-mode commitment:** every change considers BOTH self-host AND hosted-multitenant. `PLATFORM_MODE=self_host` (default) or `=hosted`.

## How consumers integrate

A consumer (e.g., humancensys-app, future health-app) integrates via:

- **HTTPS REST** at `/chat/{agent_id}`, `/agents/*`, etc. — for agent management + chat
- **MCP** at `/mcp/memory` (when `PLATFORM_MODE=hosted`) — for memory read/write/search; JWT-gated
- **JWT contract** — consumer signs HS256 tokens with `AUTH_SECRET`; engine verifies via `platform/api/auth.py`

## Persistent memory hierarchy

Use the right tool for the right horizon:

1. **`C:\Users\Liz\.claude\projects\c--Users-Liz-Make-Skills\memory\MEMORY.md` + sibling files** — auto-loaded every conversation. Project principles, user feedback, accumulated vision. Single source of truth for "things Liz already told me and I should not forget."
2. **`docs/proposals/*.md`** — architectural decisions that took time to land. Every Pillar / major feature has one.
3. **`docs/plans/*.md`** — time-bounded plans dated `YYYY-MM-DD-name.md`.
4. **`docs/test-runs/*.md`** — friction-surface logs from real end-to-end runs.
5. **Git history** — every commit message explains *why*.
6. **LanceDB (engine runtime)** — tenant-scoped agent memory at runtime. NOT for Claude Code session context.

The-loom MCP (Phase 2 in flight) will be the cross-machine semantic memory layer; once live, the file-based MEMORY.md becomes the local cache + MCP becomes source-of-truth.

**Discipline:** start with memory (already loaded). Then proposals (relevant only when the area was designed). Then plans (relevant only if work is in flight). Only then read code, smallest viable scope.

## Token discipline

Default: **read the smallest viable scope, never re-read what you've already loaded**.

| If you need… | Use… | Don't use… |
|---|---|---|
| To find files matching a pattern | `Glob` | `Bash ls -R` |
| To search code for a string | `Grep` with `head_limit` | `Read` on a candidate file, then another |
| To know what a symbol means in context | `Grep -n` to find it, then `Read` with `offset` + `limit` | `Read` the whole file |
| To modify a file you've already read | `Edit` (sends only the diff) | `Write` (sends whole new content) |
| To browse repo structure | `Glob "**/*.{md,ts,py}"` | Recursive `Read` |
| To check git state | `Bash git status --short` | `git diff` without filtering |

Avoid:

- Reading files just to confirm something obvious (trust the editor)
- Re-reading files within the same conversation unless they've changed
- Reading full migration files / huge endpoint files when you only need a function
- Quoting long file contents in your responses when a path + line range suffices

## Serena (recommended)

[Serena](https://github.com/oraios/serena) — MCP server for semantic code retrieval via LSP. Cross-file renames + reference lookups in one call instead of 8-12 Grep+Read steps. Install via the `serena` plugin in `claude-plugins-official`.

To pin project-locally in `.mcp.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"]
    }
  }
}
```

Use Serena for: `find_references`, `rename_symbol`, `get_symbols_overview`, `replace_symbol_body`. Use plain `Read` / `Grep` for: docs, config, small known files.

## Tone — no marketing voice

Describe what *is*, not what it *isn't*. No "the unlock," no "delightful," no "we built a beautiful X," no defensive contrasts. Plain, direct, descriptive. Applies to docs, commit messages, PR bodies, error messages.

## Commit + PR discipline

- **Small PRs.** One concern per branch.
- **Always open via `gh pr create`** with a body that includes a Test Plan checklist.
- **Cite proposals** when relevant.
- **Never `--no-verify`, never `--amend` on something already pushed.** Make a new commit.
- **Co-author tag**: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## Environment

- Liz's terminal is PowerShell 5.1 on Windows. `&&` parses as error; use `;` or `; if ($?) { }`.
- Python isn't on PowerShell's default PATH; available via Bash (use Bash tool for Python).
- Render is the default for any backend/database hosting decision.

## What to do when in doubt

1. Search memory first (already loaded — re-read MEMORY.md links if needed).
2. Search proposals (`docs/proposals/`) for the relevant subsystem.
3. If you have to read code, scope it tight: Grep first, Read with offset/limit second.
4. If you're about to make a destructive change, ask before acting.
