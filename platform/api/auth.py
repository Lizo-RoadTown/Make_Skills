"""
Pillar 0 — tenant resolution.

A single FastAPI dependency `get_current_tenant` returns a `TenantContext`
that downstream code uses to scope every read and write.

Two implementations chosen at import time by `PLATFORM_MODE`:

  - self_host  (default) — no auth, single-tenant, returns the default-tenant UUID.
  - hosted               — verifies the bearer token, pulls tenant_id + sub claims.
                           Stub for now; raises 501 until a JWT verifier is wired
                           (depends on the auth-provider decision).

Routes that touch tenant data declare:

    ctx: TenantContext = Depends(get_current_tenant)

…and pass `ctx.tenant_id` to every query helper. The recorder and other
background tasks must accept `tenant_id` as an explicit argument — never
read from ambient context (FastAPI background tasks lose request scope).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Annotated

from fastapi import Header, HTTPException

from api.migrations import DEFAULT_TENANT_ID

PLATFORM_MODE = os.environ.get("PLATFORM_MODE", "self_host").lower()


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str | None = None


async def _self_host_tenant() -> TenantContext:
    """No auth, deterministic context. The whole stack runs as one tenant."""
    return TenantContext(tenant_id=DEFAULT_TENANT_ID, user_id="local")


async def _hosted_tenant(
    authorization: Annotated[str | None, Header()] = None,
) -> TenantContext:
    """Stub. Wiring lands when the auth provider is chosen.

    Fails loudly so a misconfigured PLATFORM_MODE=hosted deploy is obvious
    instead of silently single-tenant.
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "JWT auth is not wired yet. Set PLATFORM_MODE=self_host or "
            "implement the JWT verifier (see Pillar 0 proposal)."
        ),
    )


# Dispatch at import time. FastAPI introspects this function's signature
# directly, so swapping the implementation per-mode keeps each path's
# dependency wiring clean (the hosted path declares the Authorization header).
get_current_tenant = (
    _hosted_tenant if PLATFORM_MODE == "hosted" else _self_host_tenant
)
