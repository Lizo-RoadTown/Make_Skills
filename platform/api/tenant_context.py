"""DEPRECATED shim. The real module lives at `core/auth/tenant_context.py`.

Kept here so existing imports (`from api.tenant_context import ...`) keep
working during the staged MVP migration. Update callers to
`from core.auth.tenant_context import ...` and remove this file in a later
phase. Plan: `docs/plans/2026-06-01-mvp-migration.md`.
"""
from core.auth.tenant_context import current_tenant  # noqa: F401
