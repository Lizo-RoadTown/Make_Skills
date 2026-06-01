"""DEPRECATED shim. The real module lives at `core/orchestration/subagents.py`.

Kept here so existing imports (`from api.subagents import ...`) keep
working during the staged MVP migration. Update callers to
`from core.orchestration.subagents import ...` and remove this file in a
later phase. Plan: `docs/plans/2026-06-01-mvp-migration.md`.
"""
from core.orchestration.subagents import (  # noqa: F401
    REPO_ROOT,
    get_subagent,
    list_subagents,
)
