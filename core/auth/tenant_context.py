"""
Pillar 0 — ambient tenant context for code paths inside LangGraph.

The chat endpoint resolves tenant_id from the request and sets it on this
ContextVar before calling `agent.ainvoke(...)`. The wrapped PostgresSaver
reads it inside its `_cursor()` override so every checkpoint read/write
runs under `SET LOCAL app.tenant_id`.

Why a ContextVar and not just RunnableConfig: `_cursor()` is the chokepoint
for all checkpointer queries but doesn't receive the RunnableConfig as an
argument. ContextVars propagate across async boundaries within the same
request scope (PEP 567), so setting it before ainvoke makes it readable
inside every node, tool, and checkpointer call that the agent triggers.

Background tasks and worker queues do NOT inherit reliably; they take
`tenant_id` as an explicit argument (recorder convention).
"""
from __future__ import annotations

from contextvars import ContextVar

from api.migrations import DEFAULT_TENANT_ID

current_tenant: ContextVar[str] = ContextVar(
    "current_tenant", default=DEFAULT_TENANT_ID
)
