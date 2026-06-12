# `.project-intelligence/` — Layer 3 instance state for {{project-display-name}}

This folder is the **project-local instance** layer of the three-layer engine model. It lives in this repo, not in any platform-side repo. It's what makes this project legible to the loom platform (registry, observatory, candidate generation) without coupling the platform code to this project's specifics.

## Contents

| Path | Purpose |
|---|---|
| `instances.json` | Canonical manifest of every project-local instance running on the shared core engine |
| `agent-profile.json` (top-level) | Agent kinds configured for this project |
| `project-context.json` (top-level) | The Project Registry's view of this project — slug, hostname, registration metadata |
| `observatory-config.json` (top-level) | Telemetry destination (Grafana Cloud OTLP via `.env`) |
| `{{instance-slug}}/` | The first instance for this project |
| `lessons-learned/` | Friction memories from sessions, scoped to the project. Phase 2's local observer reads from here. |
| `local-skills/` | Skill candidates this project is drafting that haven't been promoted yet |
| `promotion-candidates/` | Skills observed 3+ times stable, awaiting promotion to platform |
| `workflow-candidates/` | Observed multi-step workflow patterns awaiting promotion |

## Boundary

This folder is the **only** place this project owns its own instance state. The shared core engine (Make_Skills) and the platform substrate (the-loom) read from / write to this folder; they don't mirror it elsewhere. If a future surface gets its own instance, it gets its own subdirectory and its own memory boundary — instances **must not** share memory or context with each other.

## Source

This seed was materialized from `Make_Skills/adapters/development/default-seed/` by the scaffolder at project-spawn time. The canonical shape is upstream; this folder's structure can be re-seeded if the canonical evolves.
