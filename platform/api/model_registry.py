"""DEPRECATED shim. The real module lives at `core/providers/model_registry.py`.

Kept here so existing imports (`from api.model_registry import ...`) keep
working during the staged MVP migration. Update callers to
`from core.providers.model_registry import ...` and remove this file in a
later phase. Plan: `docs/plans/2026-06-01-mvp-migration.md`.
"""
from core.providers.model_registry import (  # noqa: F401
    RECOMMENDED_STARTERS,
    resolve_model,
    supported_providers,
)
