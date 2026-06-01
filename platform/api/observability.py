"""DEPRECATED shim. The real module lives at `core/observability/observability.py`.

Kept here so existing imports (`from api.observability import ...`) keep
working during the staged MVP migration. Update callers to
`from core.observability.observability import ...` and remove this file in
a later phase. Plan: `docs/plans/2026-06-01-mvp-migration.md`.

Note: `core/observability/` is the emission-side helpers ONLY. The Project
Observatory surface itself lives in the-loom, not here.
"""
from core.observability.observability import (  # noqa: F401
    memory_records_by_day,
    memory_records_by_tag,
    memory_records_by_type,
    recent_records,
    summary,
    thread_count,
    threads_by_day,
)
