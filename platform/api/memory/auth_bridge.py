"""
TokenVerifier bridge for the memory MCP's hosted HTTP transport.

The MCP SDK's streamable HTTP transport uses the TokenVerifier protocol
(from mcp.server.auth.provider) to validate bearer tokens. We delegate
the actual HS256 JWT decode to the same logic api.auth uses for the
rest of the FastAPI app, then set tenant_ctx_var so the 6 tool handlers
in mcp_server.py see the per-request tenant.

Self-host mode never instantiates this — it uses the stdio server,
which never sets the ContextVar, so _resolve_tenant() falls back to
"default" (the Phase 1 convention preserved in PR 1).
"""
from __future__ import annotations

import os
from typing import Optional

from jose import JWTError, jwt
from mcp.server.auth.provider import AccessToken, TokenVerifier

from .mcp_server import tenant_ctx_var


class MakeSkillsTokenVerifier(TokenVerifier):
    """Verify HS256 JWTs issued by the Next.js Auth.js app on Vercel.

    Mirrors api.auth._hosted_tenant's decode path but exposes the result
    as an AccessToken so the MCP SDK can use it. Also sets the per-request
    tenant_ctx_var as a side effect so tool handlers downstream see it.
    """

    def __init__(self) -> None:
        self._secret = os.environ.get("AUTH_SECRET")
        if not self._secret:
            raise RuntimeError(
                "AUTH_SECRET unset. Required for PLATFORM_MODE=hosted memory MCP."
            )

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        try:
            claims = jwt.decode(
                token,
                self._secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        except JWTError:
            return None

        user_id = claims.get("sub")
        tenant_id = claims.get("tenant_id")
        if not user_id or not tenant_id:
            return None

        # Set the contextvar for downstream tool handlers.
        tenant_ctx_var.set(tenant_id)

        return AccessToken(
            token=token,
            client_id=user_id,
            scopes=[],
            expires_at=claims.get("exp"),
        )
