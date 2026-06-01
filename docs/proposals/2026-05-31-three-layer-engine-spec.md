# Make_Skills three-layer engine — module spec

**Date:** 2026-05-31 (written 2026-06-01; back-dated to match the ratification day).
**Status:** Module-spec proposal. Mirrors `the-loom/docs/proposals/2026-05-25-platform-data-model.md` on the engine side.
**Supersedes:** the "narrowed Make_Skills as one module" framing in earlier proposals.
**Companion to:** [`2026-05-25-skill-making-bridge.md`](2026-05-25-skill-making-bridge.md) (the contract between this engine and the-loom platform).

This proposal defines the **three-layer recursive skill engine** that Make_Skills owns, after the engine/consumer split (PR #52), the CLAUDE.md+ARCHITECTURE.md rewrite (PR #53), and the skill-making bridge spec (PR #54). It is the engine-side counterpart to the-loom's `platform-data-model.md v3`.

Liz + Loom-agent + a third agent ratified the three-layer framing on 2026-05-31. This doc puts that framing into module-spec form.

## What this spec defines

1. The **three layers** the engine exposes: reusable core, project-type adapters, project-local instances.
2. The **core engine's responsibilities** — what runs in every consuming project regardless of type.
3. The **adapter contract** — what every adapter (`classroom`, `development`, `research-project`, `operations-project`, future ones) must provide and what it receives from the core.
4. The **project-local instance contract** — what every consuming project's `.project-intelligence/<instance>/` directory must contain.
5. The **runtime agent loop** — what the engine does on each per-turn invocation.
6. The **agency-vs-structure boundary** — where Make_Skills stops and the-loom begins.
7. The **two promotion paths** — local candidates (Path A) and platform observatory candidates (Path B).
8. The **skill-making pipeline** — how a promoted candidate becomes a runnable CompiledSkill.
9. The **recursive-skill loop** — how skills compose, how skills promote to tools.
10. **Integration points** with the-loom (memory MCP, Project Registry, Project Observatory, Architecture Registry, Policy Service).
11. **Open questions** and **what this spec does NOT cover**.

## What this spec does NOT cover

- The compiler pipeline internals (`docs/architecture/skill-compilation.md` later).
- The MVP repo layout migration from the current `platform/api/` to the proposed `services/`+`adapters/`+`runtime/`+etc. structure — that's `docs/plans/...-mvp-migration.md`, Liz-driven.
- Specific adapters' detailed behavior — each adapter gets its own `docs/proposals/2026-XX-XX-adapter-<name>.md`.
- The skill-making bridge wire format — see `2026-05-25-skill-making-bridge.md`.
- The-loom's bounded contexts — see `the-loom/docs/proposals/2026-05-25-platform-data-model.md`.

## Architectural anchor sentences

> **Make_Skills detects local agency patterns. The-loom detects and governs cross-project structure.**

> **The local engine improves agency inside a project. The platform codifies structure across projects.** Local repeated behavior becomes a candidate. Platform governance decides whether that candidate becomes durable structure.

> **Reusable capability lives in the platform. Project-type behavior lives in adapters. Project-specific learning lives in instances.**

These three rules anchor every architectural decision below.

## The three layers

### Layer 1 — Reusable Core Engine (the Agency-to-Structure Engine)

**Lives in:** `Make_Skills/core/` (planned location; current code is at `platform/api/` pending MVP migration).

**Audience:** Every consuming project, regardless of type. The core is project-type-agnostic.

**Responsibilities:**

| Responsibility | Description |
|---|---|
| Per-turn agent loop | Receives a request, calls model, dispatches tool use, streams response, captures the turn shape |
| Local pattern detection | Watches the project-local instance's request shapes; detects 3+ recurrence of similar shapes |
| Skill candidate generation | When pattern detection fires, builds a SKILL.md draft + supporting metadata into the instance's `promotion-candidates/` |
| Skill compilation | Takes a promoted (ratified) SKILL.md from the-loom's bridge and turns it into a runnable CompiledSkill |
| Recursive skill execution | Loads CompiledSkills into the runtime agent's tool/skill registry; allows skills to invoke other skills |
| Multi-agent orchestration | Composes subagents into orchestrations (planner + researcher + writer + reviewer; tool-use + deep-research + synthesis; etc.) |
| Memory MCP client | Reads/writes to the-loom's Agent Context Service via `mcp__loom-memory__*` tools |
| Project Registry client | Reads project metadata from the-loom's Project Registry |
| Telemetry emitter | OTLP-emits structural metadata (no PII) to the-loom's Project Observatory tagged with `project_id` |
| Promotion candidate submitter | Submits Path A candidates to the-loom's Architecture Registry over the skill-making bridge |

The core is stateless about cross-project knowledge. It calls into the-loom for everything durable.

### Layer 2 — Project-Type Adapters

**Lives in:** `Make_Skills/adapters/<type>/`. Initial set: `classroom`, `development`, `research-project`, `operations-project`. Extensible.

**Audience:** Each adapter customizes the core engine for a CLASS of projects. One adapter, many instances of that class.

**Adapter contract (what every adapter MUST provide):**

| Required artifact | Purpose |
|---|---|
| `manifest.json` | Declares adapter name, version, project_type label, supported instance surfaces (e.g., `student-facing`, `developer-facing`) |
| `watches.json` | Lists what this class of project produces that the engine should watch (e.g., classroom: assignments, study patterns; development: dev tasks, architecture decisions) |
| `pattern-triggers.json` | Per-shape recurrence thresholds + candidate-generation rules specific to this project type |
| `system-prompt-fragments/` | Markdown fragments the core engine composes into the runtime agent's system prompt at instantiation time |
| `default-skills.json` | Which methodology skills this adapter expects to be present in the consuming project's `skills/` directory |
| `observatory-events.json` | The event taxonomy this adapter emits to the Project Observatory (extends the core's base events) |

**Adapter inputs (what the core provides):**

| Input | Source |
|---|---|
| Project-local instance state | Read from the consuming project's `.project-intelligence/<instance>/` |
| Memory access (read/write) | Via the-loom's MCP, scoped to the instance's `project_tags` |
| Project metadata | From the-loom's Project Registry |
| Skill catalog | From the-loom's catalog endpoint (or the consuming project's local `skills/` for not-yet-promoted skills) |

**Adapter outputs (what the core consumes):**

| Output | Destination |
|---|---|
| Customized watches list | Drives what the local pattern detector looks for |
| Customized pattern triggers | Drives when the engine emits promotion candidates |
| System prompt for this instance | Composed into the per-turn agent loop |
| Promotion candidates (when triggers fire) | Submitted to the-loom over the skill-making bridge |

### Layer 3 — Project-Local Instances

**Lives in:** Each consuming project's `.project-intelligence/<instance-id>/` folder.

**Audience:** ONE per active instance. A consuming project may have multiple instances (e.g., the Hub has `ime4020-hub-app` + `ime4020-hub-dev`).

**Instance contract (what every instance directory MUST contain):**

| Required file | Purpose |
|---|---|
| `project-type.json` | Declares the instance's `loom_project_id`, surface (e.g., `student-facing`), and which adapter to attach |
| `attached-adapters.json` | Lists the adapters in use (primary + secondary) with version pins |
| `agent-profile.json` | Instance's agent persona (system prompt seed, model preference, tool set, memory discipline rules) |
| `project-context.json` | Project-specific context the agent needs (course info for a classroom, repo info for development, etc.) |
| `observatory-config.json` | Events this instance logs, pattern-detection triggers, no-PII rule, dashboard filter |

**Required subdirectories:**

| Subdir | Contents |
|---|---|
| `local-skill-candidates/` | Drafts of skills the local pattern detector has surfaced but not yet promoted |
| `workflow-candidates/` | Drafts of multi-step workflows (often pre-skill) |
| `promotion-candidates/` | Candidates ready for submission to the-loom's Architecture Registry |
| `lessons-learned/` | Local operational lessons; may or may not be promotion-worthy |

**Hard boundary rule:** if a consuming project has multiple instances, they share the same engine code but **MUST NOT share memory, context, permissions, or logs**. Each has its own `loom_project_id` and its own `project_tags` scope in the memory MCP.

## The runtime agent loop (per turn)

```text
1. Request arrives at the consuming project's agent endpoint (e.g., /api/agent for a deployed app,
   or Claude Code session-start for a dev instance).

2. Core engine receives the request along with:
     - The instance ID (which .project-intelligence/<instance>/ to read from)
     - Active context (assignment / file / task)
     - User-provided notes if any

3. Core engine reads:
     - The instance's agent-profile.json (model, tool set, memory discipline)
     - The instance's project-context.json (project-specific context)
     - The active adapter's watches.json + pattern-triggers.json
     - Relevant memories from the-loom MCP via memory_recall(project_tags=[<instance_id>])

4. Core engine composes the system prompt:
     - Adapter's system-prompt-fragments/
     - Instance's agent-profile.json system_prompt_seed
     - Recalled memories formatted as context

5. Core engine runs the agent loop (model call, tool use, multi-agent orchestration if invoked).

6. Core engine emits telemetry to the-loom's Project Observatory tagged with the instance's project_id.

7. Core engine watches the turn shape:
     - Does it match a pattern in pattern-triggers.json?
     - If 3+ recurrence → generate a promotion candidate, write to
       .project-intelligence/<instance>/promotion-candidates/<slug>.md
     - Submit the candidate to the-loom's Architecture Registry over the skill-making bridge

8. Core engine writes durable memory:
     - Useful exchanges → memory_write(record_type="lesson", project_tags=[<instance_id>])
     - Friction-as-memory → record_type="feedback" with the why bound to the incident

9. Response streamed back to the request originator.
```

## The agency-vs-structure boundary

The critical division of labor between Make_Skills and the-loom:

| Action | Owner | Rationale |
|---|---|---|
| Detecting repeated behavior inside this project's agency loop | **Make_Skills** local instance | Local collaboration signal — agency-side |
| Creating a local candidate skill/workflow | **Make_Skills** local instance | Still project-specific |
| Detecting repetition across projects/agents/repos/types | **the-loom** Architecture Registry / Project Observatory | Cross-project structural recognition |
| Generating a platform-side candidate from observatory signals | **the-loom** Architecture Registry | Path B — see below |
| Deciding whether ANY candidate (Path A or B) becomes durable structure | **the-loom** Policy + Architecture Registry | Governance is platform's job |
| Persisting durable structure (skill catalog entries, architecture nodes) | **the-loom** Architecture Registry | Canonical record |
| Compiling an approved candidate into a runnable CompiledSkill | **Make_Skills** core | The skill-making domain logic |
| Loading the compiled skill into the runtime agent | **Make_Skills** core | Runtime |

## The two promotion paths

Both converge at the-loom's Policy + Architecture Registry. The difference is WHO notices the candidate first.

### Path A — Local candidate path

```text
Project-local Make_Skills instance
  → local pattern detected (3+ recurrence in this project's agency loop)
  → promotion candidate generated by adapter
  → candidate submitted via the skill-making bridge (see 2026-05-25-skill-making-bridge.md)
  → the-loom Architecture Registry receives
  → Policy Service ratifies (or rejects)
  → persisted as durable structure
  → Make_Skills compiles the SKILL.md → CompiledSkill
  → registered in catalog
  → available to all consuming projects' runtime agents
```

### Path B — Platform observatory path

```text
the-loom Project Observatory
  → cross-project pattern detected (same shape across multiple projects/instances)
  → platform-side promotion candidate generated by the-loom's Architecture Registry
  → Policy Service ratifies (or rejects)
  → persisted as durable structure
  → Make_Skills compiles
  → registered in catalog
  → propagated to consuming projects
```

Both paths use the same skill-making bridge schema (see PR #54).

## The skill-making pipeline

Once a candidate is ratified, Make_Skills' `services/skill-making/` (pending implementation post-MVP-migration) takes over:

```text
1. Receive ratified SKILL.md (markdown source) + metadata over the bridge
2. Parse + validate against the agentskills.io SKILL.md spec
3. Compile:
     - Extract structured fields (name, description, triggers, scripts/, references/, assets/)
     - Resolve internal cross-references
     - Build the CompiledSkill artifact (JSON manifest + executable bundle)
4. Register in the skill catalog:
     - skill_id, version, source_origin="promoted"
     - Bundle stored where the runtime can fetch it
5. Emit registered_skill metadata back to the-loom over the bridge
6. Available to all consuming projects' runtime agents on next session
```

## The recursive-skill loop

Skills can compose other skills. Skills can promote themselves to `@tool`-decorated callable functions when promotion criteria are met (per the `agentic-upskilling` methodology).

**Composition:** A SKILL.md may reference other skills by name in its body. At runtime, the core engine resolves these references and loads the composed set into the agent's context. Cycles are detected and prevented at compile time.

**Skill → tool promotion:** Per `skills_private/agentic-upskilling/SKILL.md`'s criteria, a skill becomes a candidate for promotion to a tool when:

1. The skill has been invoked 3+ times the same way
2. The work inside the skill is mechanical (same inputs → same outputs)
3. The agent's reading-and-following the skill has produced errors that a code path wouldn't make
4. The output shape is stable
5. There's an external system to interface with (DB, file, API)

When all 5 are true, the engine drafts a `@tool` function (using the skill's body as the spec) and submits it as a tool-promotion candidate alongside the existing skill. The skill stays (its wisdom is still useful); the tool is the new mechanical execution path.

## Integration points with the-loom

| What | How | Direction |
|---|---|---|
| Memory | `mcp__loom-memory__*` MCP tools | Bidirectional (Make_Skills reads + writes; project_tags scope) |
| Project registration | `POST /projects` to Project Registry | Make_Skills (or scaffolder) → the-loom |
| Project metadata | `GET /projects/by-slug/<slug>` | the-loom → Make_Skills |
| Telemetry | OTLP push to `${OTEL_EXPORTER_OTLP_ENDPOINT}` | Make_Skills → the-loom |
| Promotion candidates | Skill-making bridge schema (per PR #54) | Make_Skills → the-loom |
| Registered skill metadata | Skill-making bridge schema | the-loom → Make_Skills |
| Skill catalog reads | the-loom's catalog endpoint (Phase 3+) | the-loom → Make_Skills |

Auth: HMAC-shared-secret per PR #54. Tenant_id semantics: see PR #54 § Open Question #5 (clarified by the Classroom Hub case — one tenant per machine for self-host).

## Mapping to current state and migration path

Make_Skills' current code is at `platform/api/` (the old engine structure). The three-layer model requires:

| Current location | Target location |
|---|---|
| `platform/api/runtime.py`, `agent.py`, `skill_compiler.py` | `core/` (Layer 1) |
| `platform/api/memory/lance.py`, `mcp_server.py` | Deprecate — the-loom's MCP replaces these for cross-project use |
| `platform/api/auth.py` | `core/auth/` (still needed for tenant resolution from JWTs) |
| `platform/api/model_registry.py` | `core/providers/` |
| `subagents/<name>/AGENTS.md` | `core/subagents/` (still needed at runtime) |
| `skills/` + `skills_private/` | Stay — these are methodology skills, bundled per Liz's "all repos have them" rule |
| `Make_Skills/adapters/<type>/` | **NEW** — the project-type adapter layer (Layer 2) |

The MVP migration is its own plan (`docs/plans/<date>-mvp-migration.md`, Liz-driven). This spec doc describes the END state; the migration path is separate.

## What this commits to

| Commitment | Implication |
|---|---|
| **Three layers, not one** | Adapters are a real layer, not a sub-detail of the core; they get their own contract and their own directory |
| **One instance, one project_id, one memory scope** | Multi-instance consuming projects (like the Hub) are first-class; the boundary rule is enforced by tag-scope |
| **Make_Skills detects, the-loom codifies** | The agency-vs-structure split is structural, not just naming. Pattern detection LOGIC lives in Make_Skills core + adapter; structural CODIFICATION lives in the-loom. |
| **Two promotion paths converge at one governance point** | Path A (local) and Path B (observatory) both end at the-loom Policy + Architecture Registry. Avoids two competing governance models. |
| **Make_Skills stays stateless across projects** | All durable cross-project knowledge lives in the-loom. The engine asks the platform for memory, registry data, catalog data on every relevant operation. |

## Open questions

1. **Adapter versioning + compatibility** — when an adapter changes, what happens to instances pinned to an older version? Lazy upgrade on next session? Explicit migration command?
2. **Skill-tool promotion governance** — when the engine drafts a `@tool` function from a skill, who reviews the generated code before it executes? Default: human-in-the-loop (Liz approves). But for trusted skills, an auto-promote path could exist later.
3. **Cross-instance skill discovery** — when `ime4020-hub-app` uses a CompiledSkill that was originally promoted from `ime4020-hub-dev`, is the skill catalog the only path? Or should there be a fast in-repo cache?
4. **Adapter composition** — can an instance attach multiple adapters at once? SDE_Extraction's `attached-adapters.json` lists both `research-project` (primary) and `development` (secondary). What does "primary + secondary" mean operationally? Tie-breaker rules?
5. **Migration sequencing** — the current `platform/api/` code has running tests + a running engine. The three-layer migration is non-trivial. Plan: separate `docs/plans/<date>-mvp-migration.md`. Not in this spec's scope.

## Next steps after this spec lands

1. **Stub each adapter directory** with a README defining its contract (no code yet). Initial set: `classroom`, `development`, `research-project`. The Hub + SDE_Extraction reference these as `pending` today.
2. **Write `docs/plans/<date>-mvp-migration.md`** — the sequencing for moving from `platform/api/` to `core/` + `adapters/` + etc. Liz drives.
3. **Implement the first adapter** end-to-end as a vertical slice — likely `development` since the Hub's `-dev` instance + SDE_Extraction's `-dev` instance both already reference it.
4. **Add `services/skill-making/` skeleton** — receives bridge messages from the-loom, currently inert; full implementation tracks the bridge spec.

## Cross-references

- [`2026-05-25-skill-making-bridge.md`](2026-05-25-skill-making-bridge.md) — the bridge contract with the-loom
- [`2026-05-25-make-skills-engine-data-model.md`](2026-05-25-make-skills-engine-data-model.md) — engine data model (Tenant, AgentInstance, Skill, etc.)
- [`2026-05-25-make-skills-engine-mvp-repo-layout.md`](2026-05-25-make-skills-engine-mvp-repo-layout.md) — target monorepo shape
- [`make-skills-engine-vs-consumer-scope.md`](make-skills-engine-vs-consumer-scope.md) — the engine/consumer split rationale
- [`the-loom/docs/proposals/2026-05-25-platform-data-model.md`](https://github.com/Lizo-RoadTown/the-loom/blob/main/docs/proposals/2026-05-25-platform-data-model.md) — the-loom's v3 spec (the platform-side counterpart to this engine-side spec)
- [`the-loom/docs/proposals/2026-05-25-agency-optimizer-pattern.md`](https://github.com/Lizo-RoadTown/the-loom/blob/main/docs/proposals/2026-05-25-agency-optimizer-pattern.md) — the capability-vs-instance pattern this spec inherits from
- [`the-loom/docs/architecture/2026-05-31-five-module-platform.md`](https://github.com/Lizo-RoadTown/the-loom/blob/main/docs/architecture/2026-05-31-five-module-platform.md) — the 5-module overview (Module 4 = this engine)
