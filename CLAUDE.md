# Working in this repo

Project context for Claude Code. Loaded into every conversation. Keep it tight; if a rule belongs to a subsystem, move it to a subdirectory `CLAUDE.md` (`web/CLAUDE.md`, `platform/CLAUDE.md`) instead of growing this file.

## The stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind v4, Motion, XState v5, Fumadocs for /docs, recharts, Drizzle (query layer only — not migrations) |
| Auth | Auth.js v5, HS256 JWT override so FastAPI can verify with shared `AUTH_SECRET` |
| Backend | FastAPI, deepagents, LangGraph, langchain (model_registry for swappable providers), psycopg, pgcrypto |
| Memory (platform) | LanceDB (`platform/api/memory/`), tenant-scoped via Pillar 0 |
| DB | Postgres on Render (external URL needed for tools), single schema, RLS on every tenant-owned table |
| Deploy | Vercel for `web/` → humancensys.com; Render for `platform/api` + Postgres |
| MCPs configured | github, context7, llama_index_docs, episodic-memory, figma, firecrawl, huggingface (see `.mcp.json`) |

Two-mode commitment: every change considers BOTH self-host AND hosted-multitenant. `PLATFORM_MODE=self_host` (default, current) or `=hosted`.

## Persistent memory hierarchy

Use the right tool for the right horizon:

1. **`C:\Users\Liz\.claude\projects\c--Users-Liz-Make-Skills\memory\MEMORY.md` + sibling files** — auto-loaded every conversation. Project principles, user feedback, accumulated vision. Single source of truth for "things Liz already told me and I should not forget." Write here when something is durable across sessions.
2. **`docs/proposals/*.md`** — architectural decisions that took time to land. Every Pillar / major feature has one. Cite section numbers in PRs.
3. **`docs/plans/*.md`** — time-bounded plans dated `YYYY-MM-DD-name.md`. Active when work is in flight; archived once shipped.
4. **`docs/test-runs/*.md`** — friction-surface logs from real end-to-end runs. Used to remember what broke and why.
5. **`docs/UX_CONTRACT.md`** — the design discipline every UI PR passes. Reference its sections in PR bodies.
6. **Git history** — every commit message explains *why*. Use it instead of reconstructing.
7. **LanceDB (platform-side)** — runtime memory of student interactions. NOT for Claude Code session context.

**Discipline:** when starting a task, first check memory (it's already loaded). Then proposals (relevant only when the area was designed). Then plans (relevant only if the area has an in-flight plan). Only then read code. Read code with the smallest viable scope.

## Token discipline

Default: **read the smallest viable scope, never re-read what you've already loaded**.

| If you need… | Use… | Don't use… |
|---|---|---|
| To find files matching a pattern | `Glob` | `Bash ls -R` |
| To search code for a string | `Grep` with `head_limit` | `Read` on a candidate file, then another, then another |
| To know what a symbol means in context | `Grep -n` to find it, then `Read` with `offset` + `limit` around it | `Read` the whole file |
| To modify a file you've already read | `Edit` (sends only the diff) | `Write` (sends the whole new content) |
| To browse repo structure | `Glob "**/*.{md,ts,py}"` | Recursive `Read` |
| To check git state | `Bash git status --short`, `git diff --stat` | `git diff` (verbose) without filtering |

Avoid:

- **Reading files just to confirm something obvious** (e.g. that an import is at the top). Trust the editor.
- **Re-reading files within the same conversation** unless they've changed.
- **Reading full migration files / huge endpoint files when you only need a function.** Use `Grep -n` then `Read offset/limit`.
- **Quoting long file contents in your responses** when a path + line range suffices.

## Serena (recommended install)

[Serena](https://github.com/oraios/serena) is an MCP server that provides semantic code retrieval and editing via the Language Server Protocol. Replaces grep + read patterns with symbol-level operations across 40+ languages, including Python and TypeScript (our two).

**Why install it:** Cross-file renames, reference lookups, "show me this function and its callers" — operations that take 8–12 careful Grep + Read steps today collapse into one atomic Serena call. Reduces token usage substantially on multi-file changes.

**Install:**

```powershell
uv tool install -p 3.13 serena-agent@latest --prerelease=allow
serena init
```

Then add to `.mcp.json`:

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena-agent", "serena-mcp-server", "--context", "ide-assistant", "--project", "${workspaceFolder}"]
    }
  }
}
```

After install, reload plugins (`/reload-plugins` in Claude Code) and the Serena tools will be available.

**When to prefer Serena over Grep + Read:**

- "Where is this function used?" → Serena's `find_references` instead of Grep + N file reads.
- "Rename X to Y across the codebase" → Serena's `rename_symbol` (atomic, LSP-validated) instead of `Grep | Edit` per file.
- "Show me the structure of this file" → Serena's `get_symbols_overview` instead of `Read` the whole file.
- "Replace the body of this function" → Serena's `replace_symbol_body` instead of `Edit` with potentially fragile string matching.

**When NOT to prefer Serena:**

- Looking at a markdown doc, config, or anything non-code → use `Read`.
- Checking git state → use `Bash`.
- Reading a small, known file you're going to edit anyway → just `Read`.

## Tone — no marketing voice

From the existing memory rule (`feedback_documentation_tone`): describe what *is*, not what it *isn't*. No "the unlock," no "delightful," no "we built a beautiful X," no defensive contrasts. Plain, direct, descriptive.

This applies to: docs, commit messages, PR bodies, dialog copy in the guide, error messages, headings. The guide character itself has a voice — dry, observational, choice-aware. Not chirpy.

## Commit + PR discipline

- **Small PRs.** One concern per branch. Stack only when the dependency is real.
- **Always open via `gh pr create`** with a body that includes a Test Plan checklist.
- **Cite proposals / UX_CONTRACT sections** when relevant.
- **Never `--no-verify`, never `--amend` on something already pushed.** Make a new commit.
- **Co-author tag**: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

## Environment

- Liz's terminal is PowerShell 5.1 on Windows. `&&` parses as error; use `;` or `; if ($?) { }`.
- Python isn't on PowerShell's default PATH; available via Bash (use Bash tool for Python).
- Vercel CLI global is broken (Anaconda path collision); use `npx vercel@latest` or the dashboard.
- Render is the default for any backend/database hosting decision.

## What to do when in doubt

1. Search memory first (already loaded — re-read MEMORY.md links if needed).
2. Search proposals (`docs/proposals/`) for the relevant subsystem.
3. Check `docs/UX_CONTRACT.md` for any user-facing decision.
4. If you have to read code, scope it tight: Grep first, Read with offset/limit second.
5. If you're about to make a destructive change, ask before acting.

## What's *not* yet effective in our persistent-memory setup

Honest audit:

- **Auto-memory works well** — Liz's principles, voice rules, vision elements survive across sessions. Memory file index is at ~20 entries, still readable.
- **Proposals capture decisions** — three landed proposals (portable-student-identity, guide-module, pillar-1b-agent-runtime) keep architecture out of conversation context.
- **Git history is forensic** — commit messages explain why, not just what.
- **Weak spot: in-session token efficiency.** Long sessions burn tokens by re-reading files, reading full files when symbols suffice, and quoting code back to the user. Serena directly addresses this.
- **Weak spot: cross-conversation hand-off.** When a session ends, the next session inherits memory + git but not "where I left off mid-task." `docs/plans/` partially covers this for big work; for in-progress branches the PR description carries it. Could be improved with an explicit "where I am" file but trying that has diminishing returns vs. just shipping smaller PRs.

The combination of *auto-memory + proposals + UX_CONTRACT + Serena* is what we should be running on. Memory and proposals already work; Serena is the recommended add.
