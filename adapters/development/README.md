# `adapters/development/` — Development Agency Adapter

**Status:** Stub (README-only). Real artifacts pending the MVP migration + core engine landing in `core/`.

## What this adapter is for

Customizes the core Agency-to-Structure Engine for **software-development repos** — projects where the agent is helping a developer build, refactor, debug, or document code. The defining traits:

- One developer (or a small team), working in a code repo
- Repo / module / file as the primary organizational unit
- Developer-facing agency: agent helps write code, review architecture, capture lessons, refactor
- Output is changes to the codebase + durable knowledge (memory, ADRs, test-runs)

Active users today:

- Summer 2026 Hub's `ime4020-hub-dev` instance (Liz developing the Hub itself)
- SDE_Extraction's `sde-extraction-dev` instance (secondary adapter — research is primary)
- Eventually: any consuming project's `-dev` instance, regardless of project type

## Contract (per [`../../docs/proposals/2026-05-31-three-layer-engine-spec.md`](../../docs/proposals/2026-05-31-three-layer-engine-spec.md) § Layer 2)

### `manifest.json` (planned shape)

```jsonc
{
  "name": "development",
  "version": "0.0.0",
  "project_type": "software-development",
  "supported_instance_surfaces": ["developer-facing"],
  "description": "Embedded discipline + agency-optimization while a developer builds a repo"
}
```

### `watches.json` (planned shape)

What the engine should watch in software-development instances:

- Repeated dev tasks (same multi-step edit sequence across sessions)
- Architecture corrections (Liz reverses a confident claim → friction-as-memory)
- Naming patterns (consistent vs inconsistent module / function / variable naming)
- Module boundaries (which imports cross which lines)
- UI/API workflow patterns (the user-facing surface the agent is shaping)
- Repo structure (where files go, why)
- Agent mistakes (categories of correction)
- Project formation decisions (early-stage architectural calls)

### `pattern-triggers.json` (planned shape)

| Trigger | Shape | Threshold | Action |
|---|---|---|---|
| `repeated_correction` | User corrects the same class of mistake | 3+ in N sessions | Emit candidate to `promotion-candidates/`; consider promoting to a discipline plugin rule |
| `repeated_dev_task_shape` | Agent performs same multi-step sequence of edits | 3+ same shape | Surface; if confirmed pattern, write a skill candidate |
| `agent_mistake_class_repeats` | Same type of error (wrong-confident-claim, missing PROBE, etc.) | 3+ | Emit a feedback-memory candidate that codifies the prevention rule |
| `naming_inconsistency_repeats` | Mixed naming styles for the same kind of thing | 3+ in one PR | Surface to user; if confirmed pattern, write a project-specific naming-convention skill |

### `system-prompt-fragments/` (planned shape)

- `dev-companion-persona.md` — sets the agent as Liz's dev collaborator, not autopilot
- `probe-before-asserting.md` — pulls the canonical PROBE rule forward
- `dev-vs-runtime-distinction.md` — names which audience each piece of infra serves
- `friction-as-memory.md` — when Liz corrects, save the correction immediately as feedback memory
- `cite-skills-by-name.md` — invocation transparency
- `commit-pr-discipline.md` — small PRs, Test Plan checklists, no `--no-verify`, no `--amend` after pushing

### `default-skills.json` (planned shape)

Methodology skills this adapter expects bundled in the consuming project's `skills/`:

- `skills/infrastructure-mapping` — for understanding system architecture
- `skills/design-evaluation` — for assessing design choices
- `skills/agentic-skill-design` — for proposing new skills (meta)
- `skills_private/lessons-learned` — friction-as-memory operational
- `skills_private/proposal-authoring` — for ADRs + design proposals
- `skills_private/roadmap-maintenance` — for project roadmap updates
- `skills_private/orchestration-cataloging` — when composing subagents
- `skills/next-actions-planning` — for breaking work into shippable chunks

### `observatory-events.json` (planned shape)

- `user_corrected_agent`
- `feedback_memory_written`
- `architectural_decision_recorded`
- `pr_opened`
- `pr_merged`
- `commit_with_co_author_tag`
- `test_run_logged`
- `friction_pattern_surfaced`

Standard structural metadata, no message contents, no source code excerpts.

## Cross-references

- Spec: [`../../docs/proposals/2026-05-31-three-layer-engine-spec.md`](../../docs/proposals/2026-05-31-three-layer-engine-spec.md)
- First consumers: Hub `ime4020-hub-dev`, SDE_Extraction `sde-extraction-dev`
- Boundary rule: development adapter instances of consuming projects with multiple instances MUST NOT share memory with the `-app` instance (per the Hub's two-instance pattern)
- This adapter is the most universal — likely every consuming project gets a `-dev` instance of it, regardless of what the project itself is (research / classroom / product / operations)
