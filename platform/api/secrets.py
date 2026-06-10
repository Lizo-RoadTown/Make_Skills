"""DEPRECATED shim. The real module lives at `core/auth/secrets.py`.

Kept here so existing imports (`from api.secrets import ...`) keep working
during the staged MVP migration. Update callers to
`from core.auth.secrets import ...` and remove this file in a later phase.
Plan: `docs/plans/2026-06-01-mvp-migration.md`.
"""
from core.auth.secrets import (  # noqa: F401
    delete_secret,
    get_secret,
    list_providers_with_keys,
    set_secret,
)
