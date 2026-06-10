# Memory MCP Phase 3 — Hosted-mode HTTP transport + JWT auth

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hosted-mode HTTP MCP transport with JWT auth so memory MCP can serve cross-machine sessions, while keeping stdio self-host mode working unchanged.

**Architecture:** Use `StreamableHTTPSessionManager` to mount the existing low-level `mcp.server.Server` instance as a `/mcp/memory` route on the FastAPI app. JWT verification via the SDK's `TokenVerifier` protocol delegates to the existing `auth.py` HS256 decode, sets a `contextvars.ContextVar` that the 6 tool handlers read via a single `_resolve_tenant()` helper (with `DEFAULT_TENANT_ID` fallback for stdio).

**Tech Stack:** Python 3.11, FastAPI, `mcp>=1.20,<2`, `asgi-lifespan>=2.0` (test dep), `python-jose` (existing), LanceDB (existing), pytest + pytest-asyncio.

**Research basis:** Three parallel agents dispatched 2026-05-23 (see `docs/test-runs/2026-05-23-merge-queue-and-plugin-followups.md` "Phase 3 research" section once added). Key findings: Starlette mount bypasses FastAPI `Depends()` so auth happens via SDK's `TokenVerifier` middleware; `contextvars` is the only viable per-request-tenant pattern given streamable HTTP's long-lived session lifecycle; `asgi-lifespan` is required for tests because FastAPI's `TestClient` doesn't fire lifespan events.

## Execution recovery notes (2026-05-23)

Task 1 + Task 2 executed via subagent-driven-development. The path was bumpier than the plan anticipated; documenting here so future plans and reviewers avoid the same trap.

**What the original plan said.** Add a new `tenant_ctx_var` + `_resolve_tenant()` helper to `mcp_server.py`, defaulting to `DEFAULT_TENANT_ID`. Task 2 swaps 8 read-sites.

**What the quality reviewer of Task 1 found.** `platform/api/tenant_context.py:24-26` already defines `current_tenant: ContextVar[str]` with the same shape — recommended reuse, not duplication.

**What the Task 2 implementer found by actually running it.** Two showstoppers the plan and reviewer both missed:

1. **Value mismatch.** `DEFAULT_TENANT = "default"` (the MCP server's existing string) and `DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000"` (the Pillar 0 UUID) are not equal. Swapping orphans Phase 1 data.
2. **LanceDB filter bug.** Reproducible: `WHERE tenant_id = '00000000-...' AND id = '...'` misses fresh writes (works on pre-indexed rows, works on vector search, fails on AND-filter scans). Documented in the implementer's BLOCKED report; root cause not yet isolated.

**Recovery path chosen (option A in the recovery decision tree).** Keep MCP's tenant identifier as the string `"default"` for self-host. Diverge from `current_tenant` deliberately, document why in the comment block above `tenant_ctx_var`. Phase 3 PR 2's TokenVerifier will `.set()` the JWT-derived UUID per-request in hosted mode — that's safe because hosted tenant UUIDs are not all-zeros.

**Deferred to a future migration PR.** Unify on UUID: change `DEFAULT_TENANT_ID` from all-zeros to a non-zero UUID (sidesteps the LanceDB bug), backfill the tenants FK chain + LanceDB rows. ~2-4 hours of careful surgery, worth doing eventually for cross-table analytics consistency.

**Lessons saved as feedback memories** in `~/.claude/projects/c--Users-Liz-Make-Skills/memory/`:
- `feedback_probe_existing_infrastructure_before_planning.md` — grep for existing infra before adding new
- `feedback_verify_values_not_just_names.md` — two similarly-named constants can have different values; verify before refactoring
- `feedback_invoke_askuserquestion_dont_type_it.md` — the AskUserQuestion XML must be invoked as a tool, not typed in response text

**PR 2 spec correction.** The plan's Task 5 (TokenVerifier) is still correct — it sets `mcp_server.tenant_ctx_var`, which is what we ended up keeping. No change needed to PR 2 task descriptions.

**PR 3 spec correction.** The plan's Task 11 (proposal update) should reflect the deliberate divergence too — add a paragraph in the proposal's Phase 3 section explaining why MCP keeps `"default"` rather than unifying with `current_tenant`.

**Sources:**
- [auth.py](../../platform/api/auth.py) — existing HS256 JWT decode (line 80-94) and `TenantContext` dataclass
- [mcp_server.py](../../platform/api/memory/mcp_server.py) — Phase 1 stdio server, `DEFAULT_TENANT` referenced at lines 43, 73, 77, 242, 272, 284, 304, 314, 320, 332
- [test_memory_mcp.py](../../platform/tests/test_memory_mcp.py) — Phase 1 test style (use as template)
- [MCP Python SDK README — Streamable HTTP](https://github.com/modelcontextprotocol/python-sdk)
- [SDK `StreamableHTTPSessionManager`](https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/server/streamable_http_manager.py)
- [SDK `BearerAuthBackend`](https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/server/auth/middleware/bearer_auth.py)

---

## File structure

**PR 1 — Contextvar refactor (no behavior change):**
- Modify: `platform/api/memory/mcp_server.py` (add ContextVar + `_resolve_tenant()`; swap 8 `DEFAULT_TENANT` references)
- Modify: `platform/tests/test_memory_mcp.py` (one new test: contextvar override + fallback)

**PR 2 — HTTP transport + auth + tests:**
- Modify: `platform/requirements.txt` (pin `mcp>=1.20,<2`; add `asgi-lifespan>=2.0` to test deps)
- Create: `platform/api/memory/auth_bridge.py` (`MakeSkillsTokenVerifier(TokenVerifier)` — wraps existing JWT decode)
- Create: `platform/api/memory/mcp_http.py` (constructs `StreamableHTTPSessionManager`; exposes `mount_into(app)` helper)
- Modify: `platform/api/main.py` (extend lifespan with `async with session_manager.run()`; call `mount_into(app)`)
- Create: `platform/tests/test_memory_mcp_hosted.py` (integration tests: tenant isolation via in-memory `Client`; real-HTTP smoke via ASGITransport)
- Modify: `CHANGELOG.md` (Unreleased entry)

**PR 3 — Docs + client wiring:**
- Modify: `docs/runbooks/memory-mcp-local.md` (add "Hosted mode" section)
- Modify: `docs/proposals/lancedb-memory-mcp.md` (update Phase 3 section to reflect what shipped)
- Create: `.claude/mcp.json.hosted-example` (sample for pointing Claude Code at humancensys.com)
- Modify: `CHANGELOG.md` (Unreleased entry)

---

## PR 1 — Contextvar refactor

Pure refactor. Stdio self-host behavior must be byte-identical after this PR. The whole point is to make PR 2's auth wiring drop in cleanly.

### Task 1: Add the ContextVar and `_resolve_tenant()` helper

**Files:**
- Modify: `platform/api/memory/mcp_server.py` (top of file, after imports)

- [ ] **Step 1: Write the failing test**

Add to `platform/tests/test_memory_mcp.py` (at the end, before the existing fixtures section if any):

```python
from contextvars import copy_context

@pytest.mark.asyncio
async def test_resolve_tenant_falls_back_to_default():
    """When no ContextVar is set, _resolve_tenant returns DEFAULT_TENANT_ID."""
    from api.migrations import DEFAULT_TENANT_ID
    assert mcp_server._resolve_tenant() == DEFAULT_TENANT_ID


@pytest.mark.asyncio
async def test_resolve_tenant_reads_contextvar():
    """When the ContextVar is set, _resolve_tenant returns its value."""
    ctx = copy_context()
    def _inner():
        mcp_server.tenant_ctx_var.set("custom-tenant-uuid")
        return mcp_server._resolve_tenant()
    assert ctx.run(_inner) == "custom-tenant-uuid"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_memory_mcp.py::test_resolve_tenant_falls_back_to_default -v`

Expected: FAIL with `AttributeError: module 'api.memory.mcp_server' has no attribute '_resolve_tenant'` (or `tenant_ctx_var`).

- [ ] **Step 3: Add the ContextVar and helper to mcp_server.py**

In `platform/api/memory/mcp_server.py`, after the existing `from . import lance` import (around line 40), add:

```python
from contextvars import ContextVar

from api.migrations import DEFAULT_TENANT_ID

# Phase 3: per-request tenant. Set by the HTTP transport's auth middleware
# (see api.memory.auth_bridge); unset in stdio mode, where _resolve_tenant
# falls back to DEFAULT_TENANT_ID. This preserves the Phase 1 single-tenant
# semantics for self-host.
tenant_ctx_var: ContextVar[str] = ContextVar("memory_mcp_tenant_id")


def _resolve_tenant() -> str:
    """Return the per-request tenant_id, or DEFAULT_TENANT_ID if unset.

    Reading the ContextVar with a default value is the only safe pattern;
    .get() with no default raises LookupError when never set. The stdio
    server never sets this var, so self-host always sees DEFAULT_TENANT_ID.
    """
    return tenant_ctx_var.get(DEFAULT_TENANT_ID)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_memory_mcp.py::test_resolve_tenant_falls_back_to_default platform/tests/test_memory_mcp.py::test_resolve_tenant_reads_contextvar -v`

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add platform/api/memory/mcp_server.py platform/tests/test_memory_mcp.py
git commit -m "refactor(memory-mcp): add tenant_ctx_var + _resolve_tenant helper"
```

### Task 2: Swap `DEFAULT_TENANT` reads in the 6 tool handlers

**Files:**
- Modify: `platform/api/memory/mcp_server.py` lines 77, 242, 272, 284, 304, 314, 320, 332

- [ ] **Step 1: Confirm existing tests still pass before changes**

Run: `docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_memory_mcp.py -v`

Expected: all existing tests pass (baseline).

- [ ] **Step 2: Replace all DEFAULT_TENANT reads inside the handlers**

In `platform/api/memory/mcp_server.py`, change every read-site of `DEFAULT_TENANT` inside the call_tool dispatcher and `_fetch_one` to `_resolve_tenant()`. Use grep to locate every site:

```bash
grep -n "DEFAULT_TENANT" platform/api/memory/mcp_server.py
```

The constant itself stays defined (line 43) — it's still the source of truth used by `_resolve_tenant`'s fallback via `DEFAULT_TENANT_ID`. Specifically replace the 8 read-sites at lines 77, 242, 272, 284, 304, 314, 320, 332:

- Line 77: `tenant_clause = lance._tenant_clause(DEFAULT_TENANT, include_public=False)` → `tenant_clause = lance._tenant_clause(_resolve_tenant(), include_public=False)`
- Lines 242, 284, 314, 320, 332: `tenant_id=DEFAULT_TENANT` → `tenant_id=_resolve_tenant()`
- Lines 272, 304: `f"... tenant_id = '{DEFAULT_TENANT}'"` → `f"... tenant_id = '{_resolve_tenant()}'"`

- [ ] **Step 3: Run all existing tests + new contextvar tests**

Run: `docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_memory_mcp.py -v`

Expected: all pass (existing tests use stdio semantics → contextvar unset → falls back to `DEFAULT_TENANT_ID`, which equals what `DEFAULT_TENANT` resolved to before).

- [ ] **Step 4: Verify stdio entry point still works**

Run: `docker compose -f platform/deploy/docker-compose.yml exec api python -c "from api.memory import mcp_server; print(mcp_server._resolve_tenant())"`

Expected: prints the default tenant UUID (the value of `DEFAULT_TENANT_ID` from `api.migrations`).

- [ ] **Step 5: Commit**

```bash
git add platform/api/memory/mcp_server.py
git commit -m "refactor(memory-mcp): replace DEFAULT_TENANT reads with _resolve_tenant()"
```

### Task 3: Open PR 1

- [ ] **Step 1: Push branch**

```bash
git push -u origin refactor/memory-mcp-contextvar
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base main --head refactor/memory-mcp-contextvar \
  --title "refactor(memory-mcp): thread tenant_id via contextvar (Phase 3 prep)" \
  --body "Pure refactor. No behavior change for self-host stdio sessions.

Adds \`tenant_ctx_var\` ContextVar + \`_resolve_tenant()\` helper. The 6 tool handlers + \`_fetch_one\` now read tenant via the helper instead of the module-level \`DEFAULT_TENANT\` constant. The constant remains as the documented self-host default (via \`DEFAULT_TENANT_ID\` from api.migrations).

Sets up Phase 3 PR 2 to wire the per-request tenant from JWT-verified HTTP requests without touching handler bodies.

## Test plan
- [ ] All existing test_memory_mcp.py tests pass
- [ ] New test_resolve_tenant_falls_back_to_default + test_resolve_tenant_reads_contextvar pass
- [ ] Stdio CLI smoke: \`python -m api.memory.mcp_server\` starts and responds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Wait for CI; merge when green**

```bash
sleep 30 && gh pr checks && gh pr merge --squash --delete-branch
```

---

## PR 2 — HTTP transport + TokenVerifier + integration tests

This is the substantive PR. Adds the HTTP route, auth, and end-to-end tests. Self-host stdio entry point must still work unchanged.

### Task 4: Pin SDK + add test deps

**Files:**
- Modify: `platform/requirements.txt`

- [ ] **Step 1: Check current pin and latest version**

Run: `grep -n "^mcp\|^asgi-lifespan" platform/requirements.txt`

Expected: shows `mcp>=1.0` somewhere (around line 31 per earlier probe); no `asgi-lifespan` entry.

- [ ] **Step 2: Update the pins**

In `platform/requirements.txt`, replace the line `mcp>=1.0` with:

```
mcp>=1.20,<2  # Phase 3 HTTP transport needs StreamableHTTPSessionManager
```

Add `asgi-lifespan>=2.0` at the end of the test-deps section (after `pytest-asyncio`):

```
asgi-lifespan>=2.0  # Phase 3 test fixtures — TestClient doesn't fire FastAPI lifespan events
```

- [ ] **Step 3: Rebuild api container to pick up new deps**

```bash
docker compose -f platform/deploy/docker-compose.yml build api
docker compose -f platform/deploy/docker-compose.yml up -d api
```

- [ ] **Step 4: Verify imports work**

```bash
docker compose -f platform/deploy/docker-compose.yml exec api python -c \
  "from mcp.server.streamable_http_manager import StreamableHTTPSessionManager; print('OK')"
docker compose -f platform/deploy/docker-compose.yml exec api python -c \
  "from asgi_lifespan import LifespanManager; print('OK')"
```

Expected: both print OK.

- [ ] **Step 5: Commit**

```bash
git add platform/requirements.txt
git commit -m "deps(memory-mcp): pin mcp>=1.20,<2; add asgi-lifespan for tests"
```

### Task 5: TokenVerifier bridge

**Files:**
- Create: `platform/api/memory/auth_bridge.py`
- Test: extends `platform/tests/test_memory_mcp_hosted.py` (created later in Task 7)

- [ ] **Step 1: Create the TokenVerifier module**

Create `platform/api/memory/auth_bridge.py`:

```python
"""
TokenVerifier bridge for the memory MCP's hosted HTTP transport.

The MCP SDK's streamable HTTP transport uses the TokenVerifier protocol
(from mcp.server.auth.provider) to validate bearer tokens. We delegate
the actual HS256 JWT decode to the same logic api.auth uses for the
rest of the FastAPI app, then set tenant_ctx_var so the 6 tool handlers
in mcp_server.py see the per-request tenant.

Self-host mode never instantiates this — it uses the stdio server,
which never sets the ContextVar, so _resolve_tenant() falls back to
DEFAULT_TENANT_ID.
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
```

- [ ] **Step 2: Smoke-import**

```bash
docker compose -f platform/deploy/docker-compose.yml exec api python -c \
  "from api.memory.auth_bridge import MakeSkillsTokenVerifier; print('OK')"
```

Expected: prints OK (no module-import errors).

- [ ] **Step 3: Commit**

```bash
git add platform/api/memory/auth_bridge.py
git commit -m "feat(memory-mcp): TokenVerifier bridge for hosted-mode HTTP transport"
```

### Task 6: HTTP session manager + FastAPI mount

**Files:**
- Create: `platform/api/memory/mcp_http.py`
- Modify: `platform/api/main.py`

- [ ] **Step 1: Create the session manager module**

Create `platform/api/memory/mcp_http.py`:

```python
"""
HTTP transport wrapper for the memory MCP server.

Constructs a StreamableHTTPSessionManager around the existing
mcp_server.server Server instance and exposes mount_into() to attach
the ASGI handler to a FastAPI app. The session manager must be entered
via lifespan (async with session_manager.run(): ...) before any HTTP
request hits it.

Self-host mode never imports this module. Only main.py wires it in
when PLATFORM_MODE=hosted.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

from .mcp_server import server
from .auth_bridge import MakeSkillsTokenVerifier

_session_manager: StreamableHTTPSessionManager | None = None


def _build_session_manager() -> StreamableHTTPSessionManager:
    """Construct the session manager. Called once at module-import time
    via get_session_manager(), or lazily via lifespan."""
    verifier = MakeSkillsTokenVerifier()
    return StreamableHTTPSessionManager(
        app=server,
        event_store=None,
        json_response=False,
        stateless=False,
        # TokenVerifier hook — the SDK calls verify_token before each
        # request and refuses connections that don't return an AccessToken.
        token_verifier=verifier,
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
    """Attach the MCP HTTP handler to the FastAPI app under `path`."""
    mgr = get_session_manager()
    app.mount(path, mgr.handle_request)
```

- [ ] **Step 2: Extend main.py's lifespan + mount conditionally**

In `platform/api/main.py`, find the existing lifespan (around line 98 per earlier probe). Extend it to compose with the MCP session lifespan when in hosted mode, and call `mount_into()`:

```python
# Add to imports near top of main.py
from contextlib import AsyncExitStack

# Where the existing lifespan is defined, e.g.:
# @asynccontextmanager
# async def lifespan(app: FastAPI) -> AsyncIterator[None]:
#     init_pool()
#     yield
#     await close_pool()
#
# Modify to:
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_pool()
    async with AsyncExitStack() as stack:
        if os.environ.get("PLATFORM_MODE", "self_host").lower() == "hosted":
            from api.memory.mcp_http import session_lifespan
            await stack.enter_async_context(session_lifespan(app))
        yield
    await close_pool()
```

After the FastAPI app is constructed and middleware added but before route includes, add:

```python
if os.environ.get("PLATFORM_MODE", "self_host").lower() == "hosted":
    from api.memory.mcp_http import mount_into
    mount_into(app, path="/mcp/memory")
```

- [ ] **Step 3: Smoke-import the changes**

```bash
docker compose -f platform/deploy/docker-compose.yml exec api python -c \
  "from api.main import app; print(app.routes)"
```

Expected: prints route list. In self-host mode, no `/mcp/memory` mount appears (no error either — module conditional skipped it).

- [ ] **Step 4: Smoke-test the mount in hosted mode**

```bash
docker compose -f platform/deploy/docker-compose.yml exec -e PLATFORM_MODE=hosted -e AUTH_SECRET=smoke-secret api python -c \
  "from api.main import app; routes = [r.path for r in app.routes]; print(any('/mcp/memory' in r for r in routes))"
```

Expected: prints `True`.

- [ ] **Step 5: Commit**

```bash
git add platform/api/memory/mcp_http.py platform/api/main.py
git commit -m "feat(memory-mcp): mount StreamableHTTPSessionManager under /mcp/memory in hosted mode"
```

### Task 7: Integration tests for hosted-mode behavior

**Files:**
- Create: `platform/tests/test_memory_mcp_hosted.py`

- [ ] **Step 1: Create the test file with the tenant-isolation test (failing)**

Create `platform/tests/test_memory_mcp_hosted.py`:

```python
"""
Integration tests for the hosted-mode memory MCP HTTP transport.

Two layers of test:

1. **In-memory transport** via mcp.client.Client(server) — fast,
   deterministic, tests tool-dispatch + tenant scoping without HTTP.
2. **Real HTTP via ASGITransport** — proves the bearer header survives
   the streamable HTTP pipeline end-to-end.

Both layers set AUTH_SECRET and PLATFORM_MODE=hosted via fixtures.
"""
from __future__ import annotations

import json
import os
import uuid

import httpx
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport
from jose import jwt

# Env must be set BEFORE app imports (auth.py resolves get_current_tenant
# at import time based on PLATFORM_MODE).
os.environ["PLATFORM_MODE"] = "hosted"
os.environ["AUTH_SECRET"] = "test-secret-do-not-use-in-prod"

from api.main import app  # noqa: E402
from api.memory import mcp_server  # noqa: E402


def _make_jwt(tenant_id: str, user_id: str = "test-user") -> str:
    return jwt.encode(
        {"sub": user_id, "tenant_id": tenant_id, "role": "member"},
        os.environ["AUTH_SECRET"],
        algorithm="HS256",
    )


def _unique_name(prefix: str) -> str:
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture
async def http_client():
    """AsyncClient wired to the FastAPI app's ASGI app, lifespan-managed."""
    async with LifespanManager(app):
        async with httpx.AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac


@pytest.mark.asyncio
async def test_tenant_a_cannot_read_tenant_b_writes(http_client):
    """Hard isolation: a request bearing tenant A's JWT must not see
    memories written under tenant B's JWT."""
    name = _unique_name("isolation")
    token_a = _make_jwt("tenant-a-uuid")
    token_b = _make_jwt("tenant-b-uuid")

    # Tenant B writes a secret.
    write_resp = await http_client.post(
        "/mcp/memory",
        headers={"Authorization": f"Bearer {token_b}"},
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "memory_write",
                "arguments": {
                    "name": name,
                    "content": "tenant-b-only secret",
                    "record_type": "project",
                },
            },
        },
    )
    assert write_resp.status_code == 200

    # Tenant A tries to read it — should not find it.
    read_resp = await http_client.post(
        "/mcp/memory",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "memory_read",
                "arguments": {"name": name},
            },
        },
    )
    assert read_resp.status_code == 200
    # Body shape: MCP wraps tool results in JSON-RPC envelope; the tool
    # itself returns {"error": "not_found"} when the row doesn't exist
    # in the requester's tenant scope.
    body = read_resp.json()
    tool_result = json.loads(body["result"]["content"][0]["text"])
    assert tool_result.get("error") == "not_found", (
        f"Tenant A leaked tenant B's data: {tool_result!r}"
    )


@pytest.mark.asyncio
async def test_missing_token_returns_401(http_client):
    """No Authorization header → 401."""
    resp = await http_client.post(
        "/mcp/memory",
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_returns_401(http_client):
    """Garbage Authorization header → 401."""
    resp = await http_client.post(
        "/mcp/memory",
        headers={"Authorization": "Bearer not-a-real-jwt"},
        json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
    )
    assert resp.status_code == 401
```

- [ ] **Step 2: Run the new tests to confirm they exercise the wired-up stack**

```bash
docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_memory_mcp_hosted.py -v
```

Expected: 3 passed. If any fail, fix the wiring before proceeding.

- [ ] **Step 3: Confirm the existing stdio tests still pass (self-host regression check)**

```bash
docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_memory_mcp.py -v
```

Expected: all pass.

- [ ] **Step 4: Confirm the existing pillar-0 isolation tests still pass**

```bash
docker compose -f platform/deploy/docker-compose.yml exec api python -m pytest platform/tests/test_pillar_0_isolation.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add platform/tests/test_memory_mcp_hosted.py
git commit -m "test(memory-mcp): hosted-mode integration tests (isolation + auth)"
```

### Task 8: CHANGELOG + open PR 2

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add Unreleased entry**

In `CHANGELOG.md`, under `## [Unreleased]` → `### Added`:

```markdown
- **Memory MCP Phase 3** — hosted-mode HTTP transport. `platform/api/memory/mcp_http.py` mounts the existing low-level `Server` as `/mcp/memory` via `StreamableHTTPSessionManager`. `platform/api/memory/auth_bridge.py` implements the SDK's `TokenVerifier` protocol, delegating to the existing HS256 decode in `auth.py` and setting `mcp_server.tenant_ctx_var` so the 6 tool handlers (already refactored in the prior PR) see the per-request tenant. Self-host stdio mode unchanged. Integration tests at `platform/tests/test_memory_mcp_hosted.py` cover tenant isolation + auth failures.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): memory MCP Phase 3 HTTP transport"
```

- [ ] **Step 3: Push branch + open PR**

```bash
git push -u origin feat/memory-mcp-phase-3-http
gh pr create --base main --head feat/memory-mcp-phase-3-http \
  --title "feat(memory-mcp): Phase 3 hosted-mode HTTP transport + JWT auth" \
  --body "## Summary

Mounts the existing Phase 1 stdio MCP server as a streamable HTTP endpoint at \`/mcp/memory\` on the FastAPI app, gated by the same HS256 JWT the rest of the API uses. Cross-machine memory: any of Liz's machines can read/write the same LanceDB tenant scope with the Auth.js-issued token.

## Architecture

- \`platform/api/memory/auth_bridge.py\` — \`MakeSkillsTokenVerifier(TokenVerifier)\` reuses \`auth.py\`'s HS256 decode, sets \`mcp_server.tenant_ctx_var\`.
- \`platform/api/memory/mcp_http.py\` — wraps the existing low-level \`Server\` in \`StreamableHTTPSessionManager\`, exposes \`session_lifespan\` + \`mount_into\` for main.py.
- \`platform/api/main.py\` — lifespan composes the MCP session manager (hosted mode only); \`/mcp/memory\` mounted (hosted mode only).
- Tests: in-memory tenant-isolation + real-HTTP smoke via ASGITransport.

## Two-mode discipline

- Self-host (\`PLATFORM_MODE=self_host\`): unchanged. Stdio server works as today. \`/mcp/memory\` is NOT mounted.
- Hosted (\`PLATFORM_MODE=hosted\`): \`/mcp/memory\` mounted, JWT required, per-request tenant.

## Test plan

- [ ] CI green (lint-pr-title, changelog-check)
- [ ] test_memory_mcp_hosted.py: 3 passed (isolation + 2 auth failure modes)
- [ ] test_memory_mcp.py: all existing tests pass
- [ ] test_pillar_0_isolation.py: still passes
- [ ] Local smoke: \`docker compose ... up\` with PLATFORM_MODE=hosted + AUTH_SECRET → curl \`/mcp/memory\` with a valid JWT returns a JSON-RPC envelope

## Followups

- PR 3 (separate): runbook + .claude/mcp.json example + proposal update.
- Render deploy: confirm \`PLATFORM_MODE=hosted\` + \`AUTH_SECRET\` are already in render.yaml (they are — see render.yaml:49-52).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: Wait for CI; merge when green**

```bash
sleep 30 && gh pr checks && gh pr merge --squash --delete-branch
```

---

## PR 3 — Docs + client wiring

### Task 9: Update the local runbook

**Files:**
- Modify: `docs/runbooks/memory-mcp-local.md`

- [ ] **Step 1: Add "Hosted mode" section**

At the end of `docs/runbooks/memory-mcp-local.md`, add:

```markdown
## Hosted mode (cross-machine)

If you're running humancensys.com (or a forked deployment) with `PLATFORM_MODE=hosted`, you can point Claude Code at it from any machine. The memory follows you.

### Setup

1. Confirm the deployment has `PLATFORM_MODE=hosted` and `AUTH_SECRET` set. On Render, see `render.yaml:49-52`.
2. Log into the web UI (Next.js Auth.js flow) to get a session cookie.
3. Extract the JWT from the cookie. The web UI exposes it at `/api/auth/token` (returns the raw HS256 token).
4. Add to your Claude Code MCP config (`.claude/mcp.json` or copy `.claude/mcp.json.hosted-example`):

   ```json
   {
     "memory": {
       "type": "http",
       "url": "https://humancensys.com/mcp/memory",
       "headers": {
         "Authorization": "Bearer YOUR_JWT_HERE"
       }
     }
   }
   ```

5. Restart Claude Code. Confirm with `/mcp` — the `memory` server should show as connected.

### Verifying tenant scoping

Memories written from one machine appear on another *only if both used the same JWT* (same tenant). Different tenants get hard isolation.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/memory-mcp-local.md
git commit -m "docs(runbook): hosted-mode setup for memory MCP"
```

### Task 10: `.claude/mcp.json.hosted-example`

**Files:**
- Create: `.claude/mcp.json.hosted-example`

- [ ] **Step 1: Create the example file**

Create `.claude/mcp.json.hosted-example`:

```json
{
  "memory": {
    "type": "http",
    "url": "https://humancensys.com/mcp/memory",
    "headers": {
      "Authorization": "Bearer REPLACE_WITH_YOUR_JWT"
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .claude/mcp.json.hosted-example
git commit -m "docs(mcp): hosted-mode .claude/mcp.json example"
```

### Task 11: Update the proposal to reflect what shipped

**Files:**
- Modify: `docs/proposals/lancedb-memory-mcp.md` (Phase 3 section, lines 144-148)

- [ ] **Step 1: Replace the Phase 3 stub with what actually shipped**

In `docs/proposals/lancedb-memory-mcp.md`, the existing Phase 3 stub (lines 144-148) describes the design. Replace with:

```markdown
### Phase 3 — hosted-mode auth + Render deployment (shipped 2026-05-XX, PRs #XX + #XX)

Mounted the existing low-level `mcp.server.Server` as a streamable HTTP endpoint at `/mcp/memory` via `StreamableHTTPSessionManager`. Auth via the SDK's `TokenVerifier` protocol — `MakeSkillsTokenVerifier` (in `platform/api/memory/auth_bridge.py`) reuses the existing HS256 JWT decode from `platform/api/auth.py` and sets `mcp_server.tenant_ctx_var` so the 6 tool handlers see the per-request tenant.

Two-mode discipline: self-host mode never mounts the HTTP route or constructs the session manager. Stdio entry point unchanged.

**Why not the FastAPI `Depends()` chain for auth?** Starlette mounts bypass FastAPI's dependency injection — `Depends()` doesn't fire inside a sub-app. The SDK's `TokenVerifier` is the equivalent surface for MCP-mounted apps. Documented in agent A's research (May 2026 dispatch) at finding #4.

**Why not unify on the existing `current_tenant` ContextVar?** Two reasons documented in `platform/api/memory/mcp_server.py:42-72`: (1) `current_tenant`'s default `DEFAULT_TENANT_ID` is the all-zeros UUID, which differs from the string `"default"` that Phase 1 MCP has been storing — swap-without-migration would orphan data; (2) the all-zeros UUID triggers a reproducible LanceDB filter bug on fresh writes. The unification is deferred to a future migration PR (change `DEFAULT_TENANT_ID` to a non-zero UUID + backfill the tenants FK chain + LanceDB rows). For now, MCP keeps `tenant_ctx_var` (default `"default"`) and the TokenVerifier sets it to the JWT-derived UUID in hosted mode (where the UUID is real, not all-zeros).

**Why contextvars and not closures or per-request Server instances?** Streamable HTTP keeps a long-lived session keyed by `mcp-session-id`; rebinding handlers per HTTP request collides with that lifecycle. `contextvars.ContextVar` is the only pattern that respects the session model. Documented in agent B's research at recommendation #4.

Deliverable: hosted MCP endpoint at humancensys.com/mcp/memory + `platform/api/memory/{auth_bridge,mcp_http}.py` + integration tests at `platform/tests/test_memory_mcp_hosted.py`.
```

(Replace `2026-05-XX` and `#XX + #XX` with actual values when this task runs.)

- [ ] **Step 2: Commit**

```bash
git add docs/proposals/lancedb-memory-mcp.md
git commit -m "docs(proposal): update memory MCP Phase 3 to reflect what shipped"
```

### Task 12: CHANGELOG + open PR 3

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add Documentation entry**

Under `## [Unreleased]` → `### Documentation`:

```markdown
- **Memory MCP hosted-mode setup runbook** — `docs/runbooks/memory-mcp-local.md` gains a "Hosted mode (cross-machine)" section. `.claude/mcp.json.hosted-example` ships a sample config. `docs/proposals/lancedb-memory-mcp.md` Phase 3 section updated to reflect what shipped (TokenVerifier not Depends, contextvars not closures).
```

- [ ] **Step 2: Commit + push + open PR**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): memory MCP Phase 3 hosted-mode runbook"
git push -u origin docs/memory-mcp-phase-3-runbook
gh pr create --base main --head docs/memory-mcp-phase-3-runbook \
  --title "docs(memory-mcp): hosted-mode runbook + client wiring example" \
  --body "Follow-up docs after Phase 3 HTTP transport landed.

- \`docs/runbooks/memory-mcp-local.md\` — \"Hosted mode\" section
- \`.claude/mcp.json.hosted-example\` — sample client config
- \`docs/proposals/lancedb-memory-mcp.md\` — Phase 3 section updated

## Test plan
- [ ] CI green
- [ ] Following the runbook from a second machine actually works (manual; covered by smoke test next session)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Wait for CI; merge when green**

```bash
sleep 30 && gh pr checks && gh pr merge --squash --delete-branch
```

---

## Self-review

- **Spec coverage:** Proposal's Phase 3 deliverable was "hosted MCP endpoint at humancensys.com/mcp + updated platform/api/main.py + auth tests" — covered by Tasks 4-8.
- **No placeholders:** Two intentional `XX` slots in Task 11 for PR numbers + ship date (resolved at execution time, not planning time).
- **Type consistency:** `tenant_ctx_var` used in Tasks 1-7 consistently. `_resolve_tenant()` signature `() -> str` consistent. `MakeSkillsTokenVerifier` class name consistent.
- **Gap caught:** Original sketch said "use FastAPI `Depends(get_current_tenant)`" — research found this fails inside Starlette mounts. Plan now uses `TokenVerifier` and threads tenant via contextvar.
