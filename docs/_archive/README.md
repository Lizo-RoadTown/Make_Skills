# `docs/_archive/` — historical design artifacts, preserved for transparency

## What lives here

This directory holds design exploration artifacts from Make_Skills' **pre-public-release** development. They describe a product that was prototyped but **never shipped publicly** (see `feedback_internal_memory_usage_is_the_old_platform` / skeleton-never-shipped framing in the project's working memory).

These documents:

- Are **not** the current architecture. Read [`docs/proposals/2026-05-31-three-layer-engine-spec.md`](../proposals/2026-05-31-three-layer-engine-spec.md) and the [README.md](../../README.md) for what Make_Skills is today.
- **Were** load-bearing during development. They drove the prototype's design and informed what eventually became the three-layer engine + the-loom platform.
- Are preserved so the reasoning behind the current architecture is auditable. If you want to know *why* Make_Skills looks the way it does, the answers are in here.

## Subdirectories

| Path | Contents |
|---|---|
| `proposals/` | Pre-public-release design docs for the never-shipped student-facing product (Pillar 0 multi-tenant, Pillar 1 agent builder, agent creatures, quest system, identity, sidebar, etc.) |
| `plans/` | Time-bounded plans from the prototype era (Apr–May 2026). Each captures what was being worked on that week. |
| `test-runs/` | Friction logs from end-to-end runs of the prototype. Useful as evidence of what worked / what didn't. |
| `architecture-snapshots/` | Auto-generated snapshots from the discipline plugin's architecture tracker. Snapshots of prototype state. |
| `_pdfs/` | External research references that were sources during the design exploration. |
| `inspiration/` | Skill drafts and design references that informed pre-public-release thinking but don't fit the current architecture. |
| `scripts/` | Maintenance + backfill scripts that were specific to the prototype era. |

## Why keep instead of delete

Per the deprecate-before-delete policy in [`deprecated/README.md`](../../deprecated/README.md), historical artifacts are preserved until they're proven irrelevant. The documents in this directory are part of Make_Skills' provenance — even if their content is superseded, deleting them would erase the reasoning trail that justifies current architectural decisions.
