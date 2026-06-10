# Proposal: Workflow-oriented sidebar (dogfood architecture)

**Status:** Open — surfaced 2026-05-02 after Liz reviewed the test-auth flow and noted "the menu doesn't make sense; I should have far more observability"
**Authors:** Liz, agent-assisted
**Date:** 2026-05-02

## Problem

The current sidebar is grouped by **content type**:

```
WORKSPACE          LIBRARY            PILLARS
├─ Chat            ├─ Skills          ├─ Agents (P1, stub)
├─ Memory          └─ Docs            ├─ Upskilling (P2, stub)
└─ Roadmap                            └─ Observability (P3)
```

This grouping has two problems:

1. **It hides the workflow.** Building Make_Skills (or building inside it as a student) is a journey: think about what to do, build it, test it, observe what happened, manage configuration. The current sidebar doesn't surface that journey — Plans live in the filesystem (`docs/plans/`) with no UI; Proposals live in `docs/proposals/` with no UI; Test runs live in `docs/test-runs/` with no UI. To find any of them you `git log` or `ls`.

2. **Observability is just one slot.** A platform that wants to teach observability needs the user to constantly *see* what's happening — what was planned, what got built, what got tested, what failed and why. That can't all live behind a single "Observability" tab; observability should pervade the sidebar.

Liz's framing (2026-05-02): *"the menu should be reflective of what we are doing... It needs to do what you called 'dogfooding' where I'm doing what I'm doing here. I should have far more observability after that."*

## Goal

Restructure the sidebar so it mirrors the actual workflow Liz has been running for the past week — research, plan, design, build, test, observe — and so a student building their own agent-clan sees the same five-stage rhythm.

The journey:

```
THINK   →   BUILD   →   TEST   →   OBSERVE   →   MANAGE
  ↑                                                   │
  └───────────────────────────────────────────────────┘
              (the loop closes — observation feeds the next think)
```

## Decision: five top-level groups, each surfacing the artifacts that already exist

```
THINK           — what we plan to do, why, and what's been decided
BUILD           — interactive build surfaces (chat with the agent, agent builder, skill library)
TEST            — verification artifacts (test runs, sessions, quests)
OBSERVE         — runtime state (dashboards, memory, public docs, knowledge graph when ready)
MANAGE          — administrative (credentials, environments, settings, account)
```

The new sidebar:

```
WORKSPACE  [Default ▾]

THINK
  ├─ Roadmap        ← /roadmap (existing)
  ├─ Plans          ← /plans (NEW — lists docs/plans/*.md)
  └─ Proposals      ← /proposals (NEW — lists docs/proposals/*.md)

BUILD
  ├─ Chat           ← / (existing — interactive build with the agent)
  ├─ Agents   P1    ← /agents (existing stub — the builder UI)
  └─ Skills         ← /skills (existing)

TEST
  ├─ Test runs      ← /test-runs (NEW — lists docs/test-runs/*.md)
  ├─ Sessions       ← /sessions (NEW stub — replay-with-trace, Pillar 3a-bound)
  └─ Quests   P2    ← /upskilling (existing stub, renamed in label)

OBSERVE
  ├─ Dashboard      ← /observability (existing)
  ├─ Memory         ← /memory (existing)
  └─ Docs           ← /docs (existing — public Fumadocs)

MANAGE
  ├─ Credentials    ← /credentials (NEW stub — for tenant_secrets)
  ├─ Environments   ← /environments (NEW stub — self-host vs hosted)
  └─ Settings       ← /settings (NEW stub — profile, account, billing later)

ACCOUNT (bottom-pinned, existing)
  ├─ profile chip
  └─ Sign out

HELP (bottom-pinned, existing)
  └─ Apache 2.0 · GitHub
```

### What's new vs existing

| Route | Status | Source |
|-------|--------|--------|
| `/plans` | NEW page | Reads `docs/plans/*.md` via existing `/docs/tree` + `/docs/file` api |
| `/proposals` | NEW page | Reads `docs/proposals/*.md` via same api |
| `/test-runs` | NEW page | Reads `docs/test-runs/*.md` via same api |
| `/sessions` | NEW stub | Becomes Pillar 3a (agent comms tracing) when ready |
| `/credentials` | NEW stub | `tenant_secrets` table UI when Pillar 0 stage 2 lands |
| `/environments` | NEW stub | Workspace switcher between self-host and hosted modes |
| `/settings` | NEW stub | Account settings, billing later |

The three NEW *functional* pages (plans, proposals, test-runs) are nearly free — the FastAPI side already has `/docs/tree` and `/docs/file` endpoints that walk markdown trees. Just point new web routes at different subdirectories of `docs/`.

The four NEW *stub* pages are placeholders with a one-paragraph description and a "coming soon" banner — they make the nav structure visible and discoverable today, before the underlying features are implemented.

## Why this beats alternatives

**Why not keep the current Workspace / Library / Pillars grouping?**
- It groups by what something IS (a skill is a skill, an agent is an agent), not by what you're DOING with it. The same Skills entry sits under "library" whether you're teaching a new skill (BUILD) or browsing a public commons skill someone else published (OBSERVE). The verb matters more than the noun for navigation.

**Why not just add a "Plans" tab and leave the rest alone?**
- Single-tab additions don't fix the underlying problem — the sidebar's mental model is still content-typed. A workflow-oriented model is what makes future additions (Test runs, Sessions, Comms tracing) land in obvious slots instead of as one-off insertions.

**Why not put everything under one giant "Workflow" tab with a sub-menu per stage?**
- Hierarchical nav is the wrong shape for a sidebar where most stages have 2-4 items. Five flat top-level groups with 2-3 items each is what users (and students) can scan at a glance.

## Two-mode notes

| Mode | What changes |
|------|--------------|
| **Self-host** | Sidebar reads filesystem directly via the existing fileviewer endpoints. Manage section's Credentials / Environments / Settings tabs all reference the local `.env` and Docker setup. |
| **Hosted-multitenant** | Sidebar same shape, but Credentials surface reads/writes the `tenant_secrets` table; Environments shows current PLATFORM_MODE and active tenant; Settings hits the per-tenant config store. The workspace switcher at the top changes context across all tabs. |

## Implementation phases

| Phase | Scope | Output |
|-------|-------|--------|
| **P1: Sidebar restructure** | New groupings in `web/components/Sidebar.tsx` + 3 functional pages reading existing `/docs/*` api + 4 labeled stub pages | Sidebar reflects workflow; everything is at least visible |
| **P2: Test runs explorer** | `/test-runs` lists by date with a side-pane viewer (similar to `/docs`'s shape) | Liz can flip through past test outcomes; new test runs land here automatically |
| **P3: Sessions UI** | When Pillar 3a (agent comms tracing) lands, `/sessions` shows replay-with-trace per chat thread | Pre-existing `conversations` table + checkpoint data → list view + trace view |
| **P4: Credentials UI** | When Pillar 0 stage 2 lands (tenant_secrets table), `/credentials` is the per-tenant secrets manager | Liz / users register Ollama URLs, OpenAI keys, etc. via the UI instead of env vars |
| **P5: Environments + Settings** | When hosted-multitenant lights up, `/environments` shows mode + tenant + workspace switcher; `/settings` shows profile/account/billing | Closes the MANAGE section |

P1 ships immediately (this PR). P2-P5 land alongside the underlying features.

## Open questions

1. **Roadmap under THINK or its own section?** — Roadmap is forward-looking (intent), Plans are dated (snapshots of intent), Proposals are pre-decision design space. All three are "thinking" artifacts; grouping them works. If Roadmap grows to be very large, it could break out later.
2. **Memory under OBSERVE or BUILD?** — Memory is what the agent has accumulated; reading from it is observation. Adding to it (via chat) is build. Recommended: leave under OBSERVE; the building you do via chat goes through `/` (Chat).
3. **Public Docs under OBSERVE?** — Docs is publicly-readable knowledge — observing what the platform offers as canonical reference. Fits OBSERVE. Could equally fit LIBRARY but we're not using that grouping anymore.
4. **Sessions naming** — The data model calls them "threads" (LangGraph thread_id). The UI calls them "Sessions". One-time decision: pick one consistent name. Recommended: **Session** in the UI, `thread_id` only in code/SQL. Friendlier and matches Anthropic/Claude Console terminology.

## What this implies for the next action

After P1 ships, the natural next move is implementing the Pillar 1B agent builder under `/agents` (which already has a stub page). Now the slot is locked in — `/agents` lives under BUILD, not in some general "Pillar 1" bucket — so the form's UX can be designed for "I'm building an agent" rather than "I'm exploring Pillar 1."

## Sources

- [Learning-tool design evaluation](../plans/2026-04-29-learning-tool-design-evaluation.md) — the upstream design call that established the recommended sidebar slots (this proposal formalizes them)
- [Test-run journey log](../test-runs/2026-04-29-auth-end-to-end.md) — the eight friction surfaces, all of which would have benefited from a more observable sidebar (Plans / Proposals / Test runs visible by default)
- Liz's 2026-05-02 framing: *"the menu should be reflective of what we are doing... I should have far more observability after that"*
