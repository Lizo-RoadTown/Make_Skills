# `adapters/` — Layer 2 of the three-layer engine

Per [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](../docs/proposals/2026-05-31-three-layer-engine-spec.md), the recursive skill engine has three layers:

1. **Reusable core engine** (Layer 1) — lives in `core/` (pending MVP migration; currently scattered under `platform/api/`)
2. **Project-type adapters** (Layer 2) — **lives here**
3. **Project-local instances** (Layer 3) — lives in each consuming project's `.project-intelligence/<instance-id>/`

## What an adapter is

An adapter customizes the universal core engine for ONE class of consuming projects. The core engine knows how to run an agent loop, detect local patterns, generate candidates, compile skills, orchestrate subagents. An adapter tells the core:

- WHAT this class of project produces that's worth watching
- WHEN to fire a promotion candidate (per-shape recurrence thresholds)
- HOW to compose the agent's system prompt for projects of this type
- WHICH methodology skills this class of project expects to be available
- WHICH events this class of project emits to the Project Observatory

The same core + different adapters = engine behavior tailored to classroom-support-apps vs software-development-repos vs research-projects, without changing the core.

## The adapter contract (every adapter MUST provide)

Per the spec doc § "Layer 2 — Project-Type Adapters":

| Artifact | Purpose |
|---|---|
| `manifest.json` | Adapter name, version, project_type label, supported instance surfaces |
| `watches.json` | What this class of project produces that the engine should watch |
| `pattern-triggers.json` | Per-shape recurrence thresholds + candidate-generation rules |
| `system-prompt-fragments/` | Markdown fragments composed into the runtime agent's system prompt |
| `default-skills.json` | Which methodology skills this adapter expects in the consuming project's `skills/` |
| `observatory-events.json` | The event taxonomy this adapter emits (extends the core's base events) |

## Adapters that exist today (stubs)

| Adapter | Status | Used by |
|---|---|---|
| [`classroom/`](classroom/) | Stub — README-only contract definition | Summer 2026 Hub's `ime4020-hub-app` instance |
| [`development/`](development/) | Stub — README-only contract definition | Hub's `ime4020-hub-dev`, SDE_Extraction's `sde-extraction-dev` (secondary) |
| [`research-project/`](research-project/) | Stub — README-only contract definition | SDE_Extraction's `sde-extraction-dev` (primary) |

Each adapter directory below contains only its `README.md` defining the contract — the actual artifacts (`manifest.json`, `watches.json`, etc.) will be populated when the MVP migration lands and the core engine moves into `core/`. Until then, these READMEs document what each adapter must become.

## Adapters that don't exist yet

Per the spec § Layer 2, the initial set includes `operations-project` (for operational workflows). Add it when a consuming project needs that adapter type. Adapter types are NOT enumerated rigidly — new ones get added when a new class of consuming project shows up.

## When implementing an adapter

1. Read the spec doc's § "Layer 2 — Project-Type Adapters" for the contract
2. Read this adapter's existing README (the stub) for the per-type intent
3. Populate the 6 required artifacts
4. Write tests against a mock core engine (the core's interface to adapters is in `core/adapter-loader.py` — pending)
5. Wire into the relevant consuming project's `attached-adapters.json` (Hub or SDE_Extraction) — change `status` from `"intended; not yet implemented"` to a real version pin

## Status overall (2026-05-31 / 2026-06-01)

- Spec doc: PR #55 (open) — codifies the three-layer model + adapter contract
- Adapter stubs: this directory (this PR)
- Core engine in `core/`: NOT yet — current code at `platform/api/`; MVP migration is a separate plan (Liz-driven)
- Real implementations: blocked on the MVP migration + core engine landing
