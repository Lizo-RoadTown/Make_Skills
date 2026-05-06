"""
Pillar 0 — tenant resolution.

A single FastAPI dependency `get_current_tenant` returns a `TenantContext`
that downstream code uses to scope every read and write.

Two implementations chosen at import time by `PLATFORM_MODE`:

  - self_host  (default) — no auth, single-tenant, returns the default-tenant UUID.
  - hosted               — verifies the bearer token (HS256, signed by the
                           Next.js Auth.js app on Vercel using the shared
                           AUTH_SECRET), pulls tenant_id and sub claims.

Routes that touch tenant data declare:

    ctx: TenantContext = Depends(get_current_tenant)

…and pass `ctx.tenant_id` to every query helper. The recorder and other
background tasks must accept `tenant_id` as an explicit argument — never
read from ambient context (FastAPI background tasks lose request scope).

The Next.js side overrides Auth.js's default JWE encoding to use HS256
with the shared AUTH_SECRET, so this verifier just needs python-jose +
the secret. See web/auth.ts.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Annotated

from fastapi import Header, HTTPException, status

from api.migrations import DEFAULT_TENANT_ID

PLATFORM_MODE = os.environ.get("PLATFORM_MODE", "self_host").lower()
AUTH_SECRET = os.environ.get("AUTH_SECRET")  # required when PLATFORM_MODE=hosted


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str | None = None
    role: str | None = None  # "admin" | "member" | None (self-host)


async def _self_host_tenant() -> TenantContext:
    """No auth, deterministic context. The whole stack runs as one tenant.
    Self-host has no concept of admin vs member — the local user is everything."""
    return TenantContext(tenant_id=DEFAULT_TENANT_ID, user_id="local", role="admin")


async def _hosted_tenant(
    authorization: Annotated[str | None, Header()] = None,
) -> TenantContext:
    """Verify HS256 JWT issued by the Next.js Auth.js app, extract tenant_id.

    The Next.js side overrides Auth.js's default JWE encoding (see
    web/auth.ts `jwt.encode`/`jwt.decode`) so the token is a plain HS256
    JWT signable/verifiable by any JWT library with the shared secret.
    """
    if not AUTH_SECRET:
        raise HTTPException(
            status_code=500,
            detail=(
                "AUTH_SECRET not set on the api side. Required for "
                "PLATFORM_MODE=hosted; must match web/.env.local."
            ),
        )

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()

    # Imported here so self-host doesn't pay the import cost.
    from jose import JWTError, jwt

    try:
        claims = jwt.decode(
            token,
            AUTH_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = claims.get("sub")
    tenant_id = claims.get("tenant_id")
    role = claims.get("role")  # "admin" | "member" | None
    if not user_id or not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing required claims (sub, tenant_id)",
        )

    return TenantContext(tenant_id=tenant_id, user_id=user_id, role=role)


# Dispatch at import time. FastAPI introspects this function's signature
# directly, so swapping the implementation per-mode keeps each path's
# dependency wiring clean (the hosted path declares the Authorization header).
get_current_tenant = (
    _hosted_tenant if PLATFORM_MODE == "hosted" else _self_host_tenant
)
