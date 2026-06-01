# `adapters/classroom/` — Classroom Agency Adapter

**Status:** Stub (README-only). Real artifacts pending the MVP migration + core engine landing in `core/`.

## What this adapter is for

Customizes the core Agency-to-Structure Engine for **classroom-support-apps** — projects that embed an agent inside a student's learning environment. The defining traits:

- One student (or a small set), not a population
- Class/course as the primary organizational unit (assignments, due dates, instructors, syllabi)
- Student-facing agency: agent helps the student learn, take notes, synthesize, ask questions
- Learning-loop output is the value (study sheets, summaries, clarifications) — not a product feature

Active users today: Summer 2026 Hub's `ime4020-hub-app` instance (Liz's IME 4020W ethics class).

## Contract (per [`../../docs/proposals/2026-05-31-three-layer-engine-spec.md`](../../docs/proposals/2026-05-31-three-layer-engine-spec.md) § Layer 2)

This adapter MUST eventually provide:

### `manifest.json` (planned shape)

```jsonc
{
  "name": "classroom",
  "version": "0.0.0",
  "project_type": "classroom-support-app",
  "supported_instance_surfaces": ["student-facing"],
  "description": "Embedded agent inside a student's learning environment"
}
```

### `watches.json` (planned shape)

What the engine should watch in classroom-support-app instances:

- Class information (course name, term, schedule, instructors)
- Assignments (prompts, due dates, points, attempts)
- Discussions, quizzes, surveys, papers
- Repeated confusion (same conceptual question across sessions)
- Study patterns (synthesis requests, review cycles)
- Feedback loops (when the student says "that worked" vs "that didn't help")
- Learning workflows (the student's specific way of working through assignments)
- Missing structure in the student's school life (gaps the agent could fill)

### `pattern-triggers.json` (planned shape)

Domain-specific triggers that fire promotion candidates:

| Trigger | Shape | Threshold | Action |
|---|---|---|---|
| `study_sheet_requests` | User asks to synthesize notes from N classes into a study sheet | 3+ same shape | Emit candidate for `study-sheet-from-notes` skill |
| `repeated_confusion_topic` | User asks the same conceptual question across 2+ sessions | 2 | Surface to user; if confirmed pattern, write a `preference` memory about framing that works |
| `repeated_lit_review_format` | User formats summaries of readings the same way | 3+ | Emit candidate for a `domain-lit-summary` skill |

### `system-prompt-fragments/` (planned shape)

Markdown fragments composed into the runtime agent's system prompt:

- `classroom-companion-persona.md` — sets the agent as a learning companion, not a tutor or grader
- `eli5-first.md` — enforces the layered-explanation pattern (ELI5 → quick ref → depth → mental model)
- `worked-examples-over-definitions.md` — pulls Liz's known preference forward
- `no-pii-rule.md` — telemetry constraints specific to student-facing apps
- `instructor-aware.md` — when the active assignment has a specific instructor (Gonzalez vs Jackiw for IME 4020W), tailor framing

### `default-skills.json` (planned shape)

Methodology skills this adapter expects bundled in the consuming project's `skills/`:

- `skills/deep-research-pattern` — for research-shaped questions
- `skills/document-parsing` — for parsing source material
- `skills/documentation` — for writing findings / notes
- `skills/layered-explanation` — for every technical explanation
- `skills_private/lessons-learned` — for friction memories

### `observatory-events.json` (planned shape)

Events this adapter emits to the Project Observatory (extending the core's base events):

- `user_marked_assignment_complete`
- `user_typed_note`
- `agent_recalled_prior_session_memory`
- `agent_emitted_study_sheet_candidate`
- `instructor_focus_tag_applied`

All events include `project_id` (e.g., `ime4020-hub-app`), `session_id`, structural metadata only. NO message contents, NO assignment notes, NO PII per the no-PII rule.

## Cross-references

- Spec: [`../../docs/proposals/2026-05-31-three-layer-engine-spec.md`](../../docs/proposals/2026-05-31-three-layer-engine-spec.md)
- First consumer: Summer 2026 Hub's `ime4020-hub-app` instance ([`Lizo-RoadTown/summer-2026-hub`](https://github.com/Lizo-RoadTown/summer-2026-hub), see `.project-intelligence/ime4020-hub-app/`)
- Boundary rule: classroom adapter instances MUST NOT share memory with `*-dev` instances of the same project (per the Hub's two-instance pattern)
