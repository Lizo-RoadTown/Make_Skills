"""
MCP server exposing the LanceDB memory store.

Phase 1 of the cross-machine session memory plan (see
docs/proposals/lancedb-memory-mcp.md). Local-only, stdio transport, no auth.
Tenant is hardcoded to "default" — multi-tenant + JWT auth land in Phase 3.

Six tools, matching the Claude Code session memory protocol's operations:

  memory_read(name)              — fetch one memory by name
  memory_list(record_type?)      — index entries (no body)
  memory_write(name, content,
               record_type, why?)— upsert a memory row
  memory_delete(name)            — soft-delete (visibility="deleted")
  memory_search(query, ...)      — semantic search over content
  memory_recall(context, n=5)    — top-N relevant for a conversation start

Run locally:
    python -m platform.api.memory.mcp_server

Wire into Claude Code (`.claude/mcp.json`):
    {
      "memory": {
        "command": "python",
        "args": ["-m", "platform.api.memory.mcp_server"],
        "cwd": "/path/to/Make_Skills"
      }
    }
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from . import lance

from contextvars import ContextVar

# Phase 3: per-request tenant for the MCP server.
#
# Intentionally separate from `api.tenant_context.current_tenant`, which
# defaults to `DEFAULT_TENANT_ID` (the canonical Pillar 0 all-zeros UUID
# used by LangGraph / checkpointer / auth.py). The MCP server has stored
# rows under tenant_id = "default" (a string) since Phase 1, and the
# all-zeros UUID triggers a reproducible LanceDB filter bug on fresh
# writes. Unifying on `current_tenant` would orphan Phase 1 data and
# hit the bug; the unification is deferred to a future migration PR
# that changes DEFAULT_TENANT_ID to a non-zero UUID and backfills the
# tenants FK chain.
#
# Self-host stdio sessions never .set() this var → stays at "default".
# Phase 3 PR 2's TokenVerifier .set()s the JWT-derived tenant_id (a
# real UUID) per HTTP request in hosted mode.
tenant_ctx_var: ContextVar[str] = ContextVar(
    "memory_mcp_tenant_id", default="default"
)


def _resolve_tenant() -> str:
    """Return the per-request tenant_id for MCP operations.

    Self-host stdio: returns "default" (the constructor default; never .set()).
    Hosted HTTP: returns the JWT-derived tenant_id set by the auth middleware.
    """
    return tenant_ctx_var.get()


# Phase 1: single-user, single-tenant. Phase 3 swaps this for JWT-derived tenant_id.
DEFAULT_TENANT = "default"

# Soft-delete marker — preserves the row but excludes it from reads/list/search.
VISIBILITY_DELETED = "deleted"


# ---------------------------------------------------------------------------
# Helpers — bridge the file-protocol's typed-file convention to LanceDB rows.
# ---------------------------------------------------------------------------


def _id_from_name(name: str) -> str:
    """Memory name (e.g. 'feedback_documentation_tone') IS the row id.
    No filesystem extension; the protocol is name-centric."""
    return name.strip()


def _row_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    """Strip internal fields and return a client-friendly shape."""
    return {
        "name": row.get("id"),
        "type": row.get("type"),
        "content": row.get("content"),
        "why": row.get("why"),
        "ts": row.get("ts"),
        "visibility": row.get("visibility"),
    }


def _fetch_one(name: str, include_deleted: bool = False) -> dict[str, Any] | None:
    """Read a single memory by name, scoped to ``_resolve_tenant()``. Returns None if absent."""
    table, _ = lance.get_table()
    # LanceDB doesn't have a direct primary-key lookup; do a filtered scan.
    rid = lance._sql_escape(_id_from_name(name))
    tenant_clause = lance._tenant_clause(_resolve_tenant(), include_public=False)
    where = f"{tenant_clause} AND id = '{rid}'"
    if not include_deleted:
        where += f" AND visibility != '{VISIBILITY_DELETED}'"
    rows = (
        table.search()
        .select(["id", "type", "content", "why", "ts", "visibility", "tenant_id"])
        .where(where)
        .limit(1)
        .to_list()
    )
    if not rows:
        return None
    return _row_to_dict(rows[0])


# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------

server: Server = Server("make-skills-memory")


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="memory_read",
            description=(
                "Read a single memory by name. Returns the typed memory's "
                "type, content, why, and timestamp. Returns null if absent."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": (
                            "Memory name (matches the file-protocol's filename "
                            "without extension, e.g. 'feedback_documentation_tone')."
                        ),
                    },
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="memory_list",
            description=(
                "List memories as index entries (no body). Returns an "
                "array of {name, type, ts, summary} entries. Optionally "
                "filter by record_type (user / feedback / project / reference)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "record_type": {
                        "type": "string",
                        "enum": ["user", "feedback", "project", "reference"],
                    },
                    "limit": {"type": "integer", "default": 100},
                },
            },
        ),
        Tool(
            name="memory_write",
            description=(
                "Upsert a memory. Creates a new row or replaces an existing "
                "one with the same name. The record_type follows the file "
                "protocol (user / feedback / project / reference). 'why' is "
                "the reason field used for feedback and project memories."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "content": {
                        "type": "string",
                        "description": "Full body markdown. Frontmatter is optional and treated as content.",
                    },
                    "record_type": {
                        "type": "string",
                        "enum": ["user", "feedback", "project", "reference"],
                    },
                    "why": {
                        "type": "string",
                        "description": "Optional. Reason / motivation for feedback and project memories.",
                    },
                },
                "required": ["name", "content", "record_type"],
            },
        ),
        Tool(
            name="memory_delete",
            description=(
                "Soft-delete a memory. The row is preserved with visibility='deleted' "
                "so recovery is possible; reads / list / search exclude it."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                },
                "required": ["name"],
            },
        ),
        Tool(
            name="memory_search",
            description=(
                "Semantic search over memory content. Returns top-N by vector "
                "similarity. Optionally filter by record_type."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "record_type": {
                        "type": "string",
                        "enum": ["user", "feedback", "project", "reference"],
                    },
                    "limit": {"type": "integer", "default": 5},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="memory_recall",
            description=(
                "Load top-N memories relevant to a conversation context. "
                "Use at session start to surface accumulated knowledge without "
                "reading every memory file. Returns full memory bodies."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "context": {
                        "type": "string",
                        "description": (
                            "A short description of what the conversation is about "
                            "(e.g. 'starting work on the auth flow'). Used as the "
                            "semantic search anchor."
                        ),
                    },
                    "n": {"type": "integer", "default": 5},
                },
                "required": ["context"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Single dispatch entry. Each branch maps to one tool and returns a JSON-ish
    response wrapped in a TextContent block (MCP's content envelope)."""
    import json

    if name == "memory_read":
        result = _fetch_one(arguments["name"])
        return [TextContent(type="text", text=json.dumps(result))]

    if name == "memory_list":
        record_type = arguments.get("record_type")
        limit = int(arguments.get("limit", 100))
        rows = lance.list_records(
            tenant_id=_resolve_tenant(),
            limit=limit,
            record_type=record_type,
            include_public=False,
        )
        # Drop deleted, project the index-entry shape.
        entries = [
            {
                "name": r.get("id"),
                "type": r.get("type"),
                "ts": r.get("ts"),
                "summary": (r.get("content") or "").split("\n", 1)[0][:200],
            }
            for r in rows
            if r.get("visibility") != VISIBILITY_DELETED
        ]
        return [TextContent(type="text", text=json.dumps(entries))]

    if name == "memory_write":
        record_type = arguments["record_type"]
        if record_type not in {"user", "feedback", "project", "reference"}:
            return [TextContent(type="text", text=json.dumps({
                "error": f"invalid record_type: {record_type}"
            }))]
        # Upsert: delete-then-insert (LanceDB lacks a native upsert with the
        # filter shape we need; this is correct under single-writer Phase 1).
        existing = _fetch_one(arguments["name"], include_deleted=True)
        if existing is not None:
            table, _ = lance.get_table()
            rid = lance._sql_escape(_id_from_name(arguments["name"]))
            table.delete(f"id = '{rid}' AND tenant_id = '{_resolve_tenant()}'")
        record = {
            "id": _id_from_name(arguments["name"]),
            "type": record_type,
            "content": arguments["content"],
            "project_tags": [],
            "source_thread_id": "",
            "ts": time.time(),
            "why": arguments.get("why", ""),
        }
        inserted = lance.insert_records(
            [record],
            tenant_id=_resolve_tenant(),
            visibility="private",
        )
        return [TextContent(type="text", text=json.dumps({
            "ok": True,
            "name": record["id"],
            "inserted": inserted,
            "replaced_existing": existing is not None,
        }))]

    if name == "memory_delete":
        # Soft-delete: rewrite the row with visibility=deleted. Preserves content
        # so a future memory_recover() can undelete.
        existing = _fetch_one(arguments["name"], include_deleted=True)
        if existing is None:
            return [TextContent(type="text", text=json.dumps({"ok": False, "reason": "not_found"}))]
        if existing.get("visibility") == VISIBILITY_DELETED:
            return [TextContent(type="text", text=json.dumps({"ok": True, "already_deleted": True}))]
        table, _ = lance.get_table()
        rid = lance._sql_escape(_id_from_name(arguments["name"]))
        table.delete(f"id = '{rid}' AND tenant_id = '{_resolve_tenant()}'")
        record = {
            "id": _id_from_name(arguments["name"]),
            "type": existing.get("type") or "project",
            "content": existing.get("content") or "",
            "project_tags": [],
            "source_thread_id": "",
            "ts": existing.get("ts") or time.time(),
            "why": existing.get("why") or "",
        }
        lance.insert_records([record], tenant_id=_resolve_tenant(), visibility=VISIBILITY_DELETED)
        return [TextContent(type="text", text=json.dumps({"ok": True}))]

    if name == "memory_search":
        rows = lance.search(
            query=arguments["query"],
            tenant_id=_resolve_tenant(),
            limit=int(arguments.get("limit", 5)),
            record_type=arguments.get("record_type"),
            include_public=False,
        )
        # Search results may include soft-deleted; filter them out.
        results = [_row_to_dict(r) for r in rows if r.get("visibility") != VISIBILITY_DELETED]
        return [TextContent(type="text", text=json.dumps(results))]

    if name == "memory_recall":
        rows = lance.search(
            query=arguments["context"],
            tenant_id=_resolve_tenant(),
            limit=int(arguments.get("n", 5)),
            include_public=False,
        )
        results = [_row_to_dict(r) for r in rows if r.get("visibility") != VISIBILITY_DELETED]
        return [TextContent(type="text", text=json.dumps(results))]

    return [TextContent(type="text", text=json.dumps({"error": f"unknown tool: {name}"}))]


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


async def main() -> None:
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    asyncio.run(main())
