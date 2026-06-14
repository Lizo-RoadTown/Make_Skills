# skills/

**This directory is empty of operator patterns by design.** All canonical patterns moved to the `liz-patterns` plugin on 2026-06-13 per [tapestry/MANIFESTO.md Pillar 1](https://github.com/Lizo-RoadTown/tapestry/blob/main/MANIFESTO.md): every reusable pattern has ONE name, ONE home, available everywhere via reference, not copy.

The only content remaining: `_upstream/` (gitignored vendored Anthropic reference skills) — NOT operator patterns.

## Where the patterns live

```text
/plugin marketplace add Lizo-RoadTown/claude-skills-marketplace
/plugin install liz-patterns@lizo-skills
```

The plugin contains:

- **7 agents**: `infrastructure-mapping`, `next-actions-planning`, `lessons-learned`, `orchestration-cataloging`, `eval-deep-research`, `web-app-scaffold`, `agentic-upskilling`
- **8 skills**: `agentic-skill-design`, `deep-research-pattern`, `design-evaluation`, `documentation`, `document-parsing`, `layered-explanation`, `open-source-documentation`, `proposal-authoring`

Invoke by name: `Agent({subagent_type: "liz-patterns:<name>", ...})` for agents; Skill tool with `liz-patterns:<name>` for skills.

## What WAS here (historical)

This repo previously hosted 9 skills at `skills/` (public methodology library) and 7 entries in `skills_private/`. All were deleted on 2026-06-13 in commit `ee757d7` when they migrated to the plugin. See `tapestry/docs/proposals/2026-06-13-skill-vs-agent-conversion-and-self-observer.md` for the promotion rationale.

## The one exception that stays in Make_Skills

`subagents/roadmap-maintenance/AGENTS.md` (NOT in this `skills/` dir but in `Make_Skills/subagents/`). Stays here because its tools (`update_roadmap_status`, `add_roadmap_item`, `roadmap_overview` at `services/admin/roadmap/tools.py:22, 69, 106`) are LangChain `@tool`-decorated Python functions imported in-process via `core/runtime/agent.py`. The agent must run inside the Make_Skills deepagents runtime to call them.

Future work: expose tools as MCP, then move agent into the plugin.

## `_upstream/`

Vendored reference skills from `anthropics/skills`. Gitignored; refresh via `scripts/sync-upstream.sh`. These are NOT the operator's patterns — don't migrate them.
