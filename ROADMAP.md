# Make_Skills roadmap

What's shipped, what's next, what's deferred.

## Shipped

- **Three-layer engine model in code** — [`core/`](core/) (Layer 1: reusable engine) + [`adapters/`](adapters/) (Layer 2: project-type adapters) + Layer 3 consumed by each project's `.project-intelligence/<instance-id>/`. Spec: [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](docs/proposals/2026-05-31-three-layer-engine-spec.md).
- **MVP migration complete** (Phases 1–5, June 2026) — `platform/api/` reshaped into `core/` + `services/`. Migration plan: [`docs/plans/2026-06-01-mvp-migration.md`](docs/plans/2026-06-01-mvp-migration.md).
- **Memory layer delegated to the-loom** — Make_Skills no longer self-hosts memory. The-loom's memory MCP is canonical for both self-host and hosted modes. CLAUDE.md CORE DIRECTIVE 1 enforces this.
- **Skill compilation pipeline** — `core/skill_making/compiler.py` turns SKILL.md markdown into runnable langchain `StructuredTool` instances at agent build time.
- **Multi-provider model registry** — `core/providers/model_registry.py` resolves `provider:name` pairs into instantiated chat models. 7 providers wired: anthropic, openai, google, huggingface, together, groq, ollama.
- **Subagent orchestration** — `core/orchestration/subagents.py` + `subagents/` directory ship 4 named specialized subagents.
- **Methodology skills library** — `skills/` + `skills_private/` ship the canonical 16-skill methodology library (agentic-skill-design, lessons-learned, layered-explanation, infrastructure-mapping, deep-research-pattern, documentation, web-app-scaffold, etc.). Bundled per-project by the seed pattern.
- **Skill-making bridge spec** — wire contract between Make_Skills and the-loom's Architecture Registry. Spec: [`docs/proposals/2026-05-25-skill-making-bridge.md`](docs/proposals/2026-05-25-skill-making-bridge.md). Receiver stub: [`services/skill_making/bridge_receiver.py`](services/skill_making/bridge_receiver.py).
- **Two-mode commitment** — every change supports both `PLATFORM_MODE=self_host` and `PLATFORM_MODE=hosted`. Documented in [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Apache 2.0 license** — [`LICENSE`](LICENSE).

## In flight

- **Adapter implementations** — `adapters/classroom/`, `adapters/development/`, `adapters/research-project/` are stub-only today (READMEs defining the contract). The 6 artifacts each adapter must ship (`manifest.json`, `watches.json`, `pattern-triggers.json`, `system-prompt-fragments/`, `default-skills.json`, `observatory-events.json`) populate as consuming projects exercise them.
- **Skill-making bridge implementation** — `services/skill_making/bridge_receiver.py` is currently a stub that raises `BridgeReceiverNotImplemented`. Full implementation (HMAC verification, idempotency, dispatch to compiler, registration ack) is the next non-stub work on the bridge.

## Deferred

- **Per-tenant skill catalog persistence** — today's catalog is read from the repo's `skills/` directory at agent build time. A tenant-scoped catalog (so different tenants can have different skill sets without forking the repo) is post-Phase-5 work.

## Out of scope (by boundary rule)

These belong to other modules in the loom set:

- **Cross-project memory storage** → the-loom Memory MCP
- **Cross-project pattern observatory** → the-loom Project Observatory
- **Canonical durable structure (ratified skills, ArchitectureNodes)** → the-loom Architecture Registry
- **Promotion governance** → the-loom Policy
- **Project registration** → the-loom Project Registry

> **Anchor rule:** *Make_Skills improves local agency and produces candidates. The-loom observes across projects, governs promotion, and stores durable structure.*

## How this is maintained

This file lists capabilities and current state. Detailed design decisions live in [`docs/proposals/`](docs/proposals/). Time-bounded plans live in [`docs/plans/`](docs/plans/). Historical artifacts from the pre-public-release exploration are preserved in [`docs/_archive/`](docs/_archive/) for transparency.
