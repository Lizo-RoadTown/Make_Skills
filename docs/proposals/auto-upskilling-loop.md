# Auto-upskilling loop (MVP)

**Status:** Proposed, 2026-05-23. Priority: high. Dependency: plugin v0.1.4 (hooks.jsonl writes).

## What this is

Automated version of the `agentic-upskilling` skill (currently manual). The agent observes its own work at defined interface points, counts repeated workflows, and at 3+ uses dispatches an LLM agent to author a **codified orchestration** (an agent + specified tools + contract) from the pattern. Human approves via PR review.

## Promotion targets: four shapes, matcher classifies

The original `agentic-upskilling` skill framed promotion as one thing — "skill → tool." On reflection there are **four promotion shapes**. The matcher's job is to detect a recurring pattern AND classify which shape it should become. Different shapes for different pattern characteristics:

| Shape | When to promote here | Example |
|---|---|---|
| **Tool (a button)** — Python function or single shell call | Pure mechanical, ZERO agent judgment needed, deterministic input→output | `open_pr(title, body) → pr_number` — same gh command shape every time, no decisions |
| **Plugin (hooks)** | Behavioral pattern that needs enforcement at hook points (before/after a tool call, at session start, etc.) | The discipline plugin's PROBE-before-asserting check; `_observability.py` log writes |
| **Skill.md** | Small reusable prescriptive pattern; agent reads and follows; some judgment but no orchestration | "How to write a feedback memory" — frontmatter shape, body shape, MEMORY.md index update |
| **Codified orchestration** (agent + tools + contract) | Multi-step workflow with real judgment moments (handle errors, branch on conditions) | PR ceremony with CI handling — branch → edit → push → open → handle bounces → merge |

**Critical refinement: patterns count even when not consecutive.** If the same workflow appears 3+ times across a session interspersed with other work, it still counts. The matcher tracks recurrence, not consecutiveness.

**Routing logic (the matcher's classification step):**

```
For each detected recurring pattern:
  - Does it need any judgment? (branch on conditions, handle errors)
    NO → tool (button)
    YES → continue
  - Is it enforced as a check before/after another action?
    YES → plugin (hooks)
    NO → continue
  - Is it primarily a single prescriptive sequence the agent reads-and-follows?
    YES → skill.md
    NO → orchestration (agent + tools + contract)
```

This matches the platform's existing patterns:
- **Tools** are what the discipline plugin promoted for `log_event`, `_check_citation`
- **Plugins** are how the discipline itself was codified (PROBE/cite/distinguish behaviors → hooks.json)
- **Skills.md** are how `agentic-skill-design`, `lessons-learned`, `infrastructure-mapping` were codified
- **Orchestrations** are how the platform's `agent-app` variant works (agents with tools with contracts)

The auto-upskilling loop produces more of the SAME kinds of units the platform already runs.

## Why this matters

Today: same workflows happen every session (PR ceremony, docker test commands, CHANGELOG edits, feedback memory writes) and the agent re-reads the skill markdown each time, hitting the same gotchas in the same ways. The hours of bloat in the 2026-05-23 session is the cost.

Once shipped: the agent gets sharper after every session. Skills that prove themselves become callable functions; the agent stops re-reading markdown for things it can just do.

## The MVP loop

```
Existing observability (hooks.jsonl + dev-experience dashboard)
   ↓
Pattern matcher scans log for repeated workflows at known interfaces
   ↓
Count reaches 3 → write candidate to ledger
   ↓
SessionStart surfaces "N candidates pending review"
   ↓
On review: dispatch author-tool subagent (LLM authors Python tool from pattern + parent skill)
   ↓
Subagent opens a PR; Liz reviews + merges
   ↓
After merge: agent uses the tool; skill SKILL.md gets a "PROMOTED" note pointing at the tool
```

## Interfaces to watch (already mapped via infrastructure-mapping)

| Interface | Fields to capture |
|---|---|
| Hook fire (PreToolUse, UserPromptSubmit, Stop, SessionStart) | hook name, action, note, elapsed_ms, exit_code |
| Tool call (Edit, Write, Bash, Read, Grep, Glob) | tool name, target path or pattern, success/fail, retry-after-correction? |
| Subagent dispatch (`Agent` tool) | description, status returned, duration |
| Skill invocation (`Skill` tool) | skill name, did agent then drift from the skill's prescribed steps? |
| PR cycle (`gh pr create`, `gh pr checks`, `gh pr merge`) | branch, title, CI bounce count, merge outcome |
| Memory write (Write to `~/.claude/projects/.../memory/`) | memory type (user/feedback/project/reference), preceded by user correction? |
| Test run (`pytest` invocation) | pattern, pass/fail/error/skip counts, retry count |

## Pieces to build (in order)

| # | Piece | Effort | Depends on |
|---|---|---|---|
| 1 | Plugin v0.1.4 fix — `_observability.py` import works under Node launcher | 1-2 hours | — (in flight) |
| 2 | Extend observability to capture tool calls + skill invocations, not just hook fires | 1 hour | #1 |
| 3 | Pattern-matcher script — normalizes variable args (file paths, titles, IDs), counts repeats, writes to `~/.claude/projects/<repo>/upskilling_candidates.jsonl` | 2-3 hours | #2 |
| 4 | SessionStart surface — read candidate ledger, inject "N candidates pending review" into session-start context | 30 min | #3 |
| 5 | Author-orchestration subagent prompt template — input: candidate pattern + parent skill content + sample invocations from log; output: an orchestration spec (agent role + tool list + contract) + test + PR | 1-2 hours | #4 |
| 6 | Review workflow doc — what to look for in the auto-authored PR, when to reject | 30 min | #5 |

**Total: ~6-8 hours to MVP.**

## What's NOT in MVP (deferred to v2)

- **Demotion path.** Voyager's known failure mode is skill-library bloat with no retirement. Add usage-tracking + auto-demotion when bloat becomes a real problem, not before.
- **Toil-budget ritual** (Google SRE-style quarterly review). Threshold of 3 is fine for now; revisit when noise becomes a problem.
- **Stylist-as-approver pattern** (Stitch Fix). For now, Liz reviews her own candidate PRs. If approvals become a bottleneck, add a "guide-agent auto-approves mechanical promotions" path.
- **Cross-user pattern aggregation.** Stays per-user by design (per Pillar 0 tenant scoping). Aggregation is a Pillar 3c "public commons" concern, not MVP.
- **Pillar 2 web UI** for browsing candidates. Chat-based first; web UI when the candidate volume justifies it.

## Open design decisions (decide when building #3)

1. **Pattern normalization rules.** What gets replaced with `<VAR>` and what stays literal? File paths and titles obviously variable; flags and command structure are signal. Need a small spec.
2. **Grading mode.** Pure count (3 uses = candidate) vs. count + heuristic (3 uses AND error/retry observed nearby). The latter avoids promoting things that work fine without a tool.
3. **Skill linkage.** A candidate pattern is generally adjacent to a skill that describes the workflow. Should the matcher link the candidate back to the parent skill automatically (search `skills/*/SKILL.md` for keyword overlap) or just leave it for the author-tool subagent to figure out?

## Traps to avoid (from 2026-05-23 research dispatch)

1. **Silent generalization** — every PBD system from 1993-2010 hit this. Always require dialogue before promoting. Our "PR review" gates this naturally.
2. **Skill-library bloat with no demotion** — Voyager's actual shipped problem. Watch usage counts post-promotion; add demotion when needed.
3. **Cross-user template marketing** — Zapier's trap. Don't aggregate across users — promotion must reflect THIS user's workflow.

## Refs

- `skills_private/agentic-upskilling/SKILL.md` — the manual version this automates
- `skills_private/lessons-learned/SKILL.md` — companion skill (review transcripts → intake forms + memory)
- `docs/plans/2026-05-23-plugin-v0.1.3-followups.md` §6 — the v0.1.4 fix this depends on
- `docs/runbooks/dev-experience-observability.md` — the existing observability layer this builds on
- Research dispatch summary in test-runs log (2026-05-23) — Voyager, Toolformer, Google SRE toil, Stitch Fix patterns
