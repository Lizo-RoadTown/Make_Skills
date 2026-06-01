# `adapters/research-project/` — Research Project Adapter

**Status:** Stub (README-only). Real artifacts pending the MVP migration + core engine landing in `core/`.

## What this adapter is for

Customizes the core Agency-to-Structure Engine for **research-heavy projects** — projects where the primary work is reading literature, analyzing data, and synthesizing findings. The defining traits:

- Discovery-shaped: the agent helps surface what's true, not produce a product
- Iterative: literature reviews → notebooks → findings → decisions → more questions
- Output is durable knowledge (findings, ADRs, lessons-learned), not features
- May or may not eventually produce a product — that's a phase transition, not the starting state

Active users today: SDE_Extraction's `sde-extraction-dev` instance (primary adapter; `development` is secondary).

## Contract (per [`../../docs/proposals/2026-05-31-three-layer-engine-spec.md`](../../docs/proposals/2026-05-31-three-layer-engine-spec.md) § Layer 2)

### `manifest.json` (planned shape)

```jsonc
{
  "name": "research-project",
  "version": "0.0.0",
  "project_type": "research-project",
  "supported_instance_surfaces": ["researcher-and-developer-facing"],
  "description": "Embedded research methodology + finding synthesis while a researcher works through a corpus"
}
```

### `watches.json` (planned shape)

What the engine should watch in research-project instances:

- Literature review patterns (how the user annotates, what fields they track)
- Recurring research questions (the user asks the same question shape across sessions)
- Data analysis workflows (notebook → finding → decision cycles)
- Findings synthesis (the user pulls N findings into one write-up — what shape?)
- Decision points (the user picks a direction; what evidence supported it?)
- Sources of friction (the user gets stuck on the same kind of question repeatedly)
- Dev tasks (when the project moves into `apps/` or `services/` and the `development` adapter takes over secondarily)

### `pattern-triggers.json` (planned shape)

| Trigger | Shape | Threshold | Action |
|---|---|---|---|
| `repeated_research_question` | Same research question shape across sessions | 3+ | Emit candidate for a domain-specific research-query playbook |
| `repeated_synthesis_pattern` | User requests synthesis of N findings into a write-up with the same shape | 3+ | Emit workflow candidate for a `synthesize-N-findings` template |
| `repeated_lit_review_format` | User formats lit reviews the same way | 3+ | Emit candidate for a domain-specific `lit-review-template` skill |
| `recurring_data_extraction_shape` | User extracts the same kind of data from sources the same way | 3+ | Emit candidate for a data-extraction skill (the SDE_Extraction case specifically) |

### `system-prompt-fragments/` (planned shape)

- `researcher-companion-persona.md` — sets the agent as a research collaborator, not an answerer
- `deep-research-pattern.md` — pulls the canonical research methodology forward
- `evidence-not-opinion.md` — every claim cites a source (paper, notebook, dataset)
- `synthesize-after-evidence.md` — don't summarize before reading; quote before generalizing
- `findings-as-durable-memory.md` — when a finding stabilizes, write it as a `record_type="lesson"` memory
- `topic-articulation-prompt.md` — when the project's topic is still TBD (the seeded state), help the user articulate it

### `default-skills.json` (planned shape)

Methodology skills this adapter expects bundled in the consuming project's `skills/`:

- `skills/deep-research-pattern` — THE primary playbook
- `skills/eval-deep-research` — evaluating research outputs
- `skills/document-parsing` — extracting structure from sources
- `skills/documentation` — Diátaxis docs methodology for findings
- `skills/layered-explanation` — ELI5 → quick ref → depth → mental model
- `skills_private/lessons-learned` — friction-as-memory + findings as durable memory
- `skills_private/proposal-authoring` — when research drives a decision, write the proposal

### `observatory-events.json` (planned shape)

- `research_finding_written`
- `research_question_logged`
- `literature_source_added`
- `data_extracted_to_notebook`
- `synthesis_completed`
- `decision_proposal_drafted`
- `adr_written`
- `topic_articulated` (when a previously-TBD topic gets defined)

Standard structural metadata. NO paper/finding contents in telemetry (the contents are the work product — they live in `research/`, not in telemetry events).

## Phase transitions

Research projects often move through phases:

1. **heavy-research** (current for SDE_Extraction) — literature, data, synthesis. Primary adapter: `research-project`.
2. **synthesis-and-decision** — findings stabilize; decisions get made. Same primary adapter, but more proposal-authoring + ADR work.
3. **build-out** — if the research surfaces a product, `apps/` and `services/` start getting populated. The `development` adapter becomes co-equal or primary; `research-project` continues in the background.

The adapter SHOULD adapt to these phases — likely via the `phase` field in `project-context.json` (already present in SDE_Extraction's instance config).

## Cross-references

- Spec: [`../../docs/proposals/2026-05-31-three-layer-engine-spec.md`](../../docs/proposals/2026-05-31-three-layer-engine-spec.md)
- First consumer: SDE_Extraction's `sde-extraction-dev` instance ([`Lizo-RoadTown/sde-extraction`](https://github.com/Lizo-RoadTown/sde-extraction))
- Secondary adapter: when work moves to `apps/` + `services/`, `development` adapter activates alongside this one
