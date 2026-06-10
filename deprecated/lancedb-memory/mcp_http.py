"""
HTTP transport wrapper for the memory MCP server.

Constructs a StreamableHTTPSessionManager around the existing
mcp_server.server Server instance and exposes mount_into() to attach
the ASGI handler to a FastAPI app. The session manager must be entered
via lifespan (async with session_manager.run(): ...) before any HTTP
request hits it.

Self-host mode never imports this module. Only main.py wires it in
when PLATFORM_MODE=hosted.

Implementation note (SDK signature divergence from the plan):
    StreamableHTTPSessionManager.__init__ does NOT accept a
    `token_verifier` kwarg (probed 2026-05-23, sdk signature is
    (app, event_store, json_response, stateless, security_settings,
    retry_interval, session_idle_timeout)). The MCP SDK applies token
    verification by wrapping the session manager's ASGI handler with
    Starlette's AuthenticationMiddleware (using BearerAuthBackend) +
    the SDK's AuthContextMiddleware + RequireAuthMiddleware — the
    pattern FastMCP itself uses in
    mcp/server/fastmcp/server.py:978-1000. We mirror that pattern
    here so the mount under /mcp/memory is auth-gated by our
    MakeSkillsTokenVerifier.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from mcp.server.auth.middleware.auth_context import AuthContextMiddleware
from mcp.server.auth.middleware.bearer_auth import (
    BearerAuthBackend,
    RequireAuthMiddleware,
)
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.middleware.authentication import AuthenticationMiddleware

from .auth_bridge import MakeSkillsTokenVerifier
from .mcp_server import server

_session_manager: StreamableHTTPSessionManager | None = None
_verifier: MakeSkillsTokenVerifier | None = None


def _build_session_manager() -> StreamableHTTPSessionManager:
    """Construct the session manager and the verifier together. The
    verifier is held module-level so mount_into() can reuse it when
    building the auth-middleware stack around the ASGI handler."""
    global _verifier
    _verifier = MakeSkillsTokenVerifier()
    return StreamableHTTPSessionManager(
        app=server,
        event_store=None,
        json_response=False,
        stateless=False,
    )


def get_session_manager() -> StreamableHTTPSessionManager:
    global _session_manager
    if _session_manager is None:
        _session_manager = _build_session_manager()
    return _session_manager


@asynccontextmanager
async def session_lifespan(app: FastAPI) -> AsyncIterator[None]:
    """FastAPI lifespan that enters/exits the MCP session manager.
    main.py composes this with any other lifespan logic."""
    mgr = get_session_manager()
    async with mgr.run():
        yield


def mount_into(app: FastAPI, path: str = "/mcp/memory") -> None:
    """Attach the MCP HTTP handler to the FastAPI app under `path`,
    wrapped in the SDK's bearer-auth middleware stack so every request
    is gated by MakeSkillsTokenVerifier (which also sets
    tenant_ctx_var as a side effect, consumed by the 6 tool handlers)."""
    mgr = get_session_manager()
    # _verifier was populated by _build_session_manager() above.
    assert _verifier is not None, "session manager built without verifier"

    # Build the same middleware sandwich FastMCP uses:
    #   RequireAuthMiddleware(  -- 401 if no AuthenticatedUser in scope
    #     AuthContextMiddleware(  -- copies auth into the contextvar
    #       AuthenticationMiddleware(  -- runs BearerAuthBackend
    #         handle_request,            -- the actual MCP ASGI handler
    #         backend=BearerAuthBackend(verifier),
    #       )
    #     ),
    #     required_scopes=[],
    #   )
    asgi = mgr.handle_request
    asgi = RequireAuthMiddleware(asgi, required_scopes=[])
    asgi = AuthContextMiddleware(asgi)
    asgi = AuthenticationMiddleware(asgi, backend=BearerAuthBackend(_verifier))
    app.mount(path, asgi)
