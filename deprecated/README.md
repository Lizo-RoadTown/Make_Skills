# `deprecated/` — Retired code, kept for reference until proof-of-unused stabilizes

**Status:** Phase 1 scaffold (empty). The first occupant lands in Phase 4 of the MVP migration: the LanceDB memory MCP module from `platform/api/memory/`.

## Policy

> **Deprecate before delete.**

Per [`../docs/plans/2026-06-01-mvp-migration.md`](../docs/plans/2026-06-01-mvp-migration.md), code that's been superseded but isn't yet provably unused goes here — NOT into `git rm`. The contents are retained:

- As a reference for what was being done before
- As a safety net if a consumer surfaces that we missed in the audit
- As historical context for future readers

When a deprecated module is **proven unused** (all consumers audited; no live calls; no tests depend on it for anything but historical purposes), it can be deleted in a follow-up PR. Until then: it sits here, with a `README.md` in each subdirectory explaining what it was, why it's deprecated, what replaces it, and how to confirm it's safe to delete.

## How an item gets deprecated

1. Move the module (with `git mv` to preserve history)
2. Add a `README.md` in the new location explaining: what it was, why deprecated, replacement, audit checklist
3. Mark all `import` paths in the rest of the codebase as broken (or leave a compatibility shim that warns)
4. Update tests: either move tests to `deprecated/<module>/tests/` (kept as historical record) or delete after archiving

## How an item gets deleted (only after deprecation)

1. Audit complete: zero live calls + zero non-historical test dependencies + 30+ days in deprecated/ without surfacing
2. PR deletes the directory + the audit findings go in CHANGELOG
3. Render deploy / consuming projects updated if anything was still pointing at the old path

## Currently in `deprecated/`

Empty (Phase 1 scaffold). Next inhabitant (Phase 4): `lancedb-memory/` — the old per-tenant LanceDB MCP from `platform/api/memory/`, superseded by the-loom's pgvector MCP at `https://loom-agent-context.onrender.com/mcp/memory/`.

See [`../docs/plans/2026-06-01-mvp-migration.md`](../docs/plans/2026-06-01-mvp-migration.md) Phase 4 for the audit checklist this move requires.
