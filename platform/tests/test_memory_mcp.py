"""
Smoke tests for the LanceDB memory MCP server (Phase 1).

Tests the tool-dispatch logic in mcp_server.call_tool directly. The stdio
transport layer is not under test here — we trust the MCP SDK to plumb
JSON over stdin/stdout. What we test is that each of the six tools does
the right LanceDB operation and returns a JSON-parseable response.

Run inside the api container:

    docker compose -f platform/deploy/docker-compose.yml exec api \\
        python -m pytest platform/tests/test_memory_mcp.py -v

Tests use the DEFAULT tenant (Phase 1 is single-tenant). Each test seeds
its own memory names with a uuid suffix to avoid colliding with real
data on the same disk. Cleanup soft-deletes the test rows on exit.
"""
from __future__ import annotations

import json
import uuid

import pytest

from api.memory import lance, mcp_server


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _unique_name(prefix: str) -> str:
    """Generate a name unlikely to collide with real session memory."""
    return f"test_{prefix}_{uuid.uuid4().hex[:8]}"


async def _call(name: str, **arguments) -> dict | list:
    """Invoke a tool by name and parse the JSON response."""
    blocks = await mcp_server.call_tool(name, arguments)
    assert len(blocks) == 1, f"expected 1 content block, got {len(blocks)}"
    return json.loads(blocks[0].text)


def _hard_delete(name: str) -> None:
    """Test cleanup. Bypasses soft-delete and removes the row entirely."""
    table, _ = lance.get_table()
    rid = lance._sql_escape(mcp_server._id_from_name(name))
    table.delete(f"id = '{rid}' AND tenant_id = '{mcp_server.DEFAULT_TENANT}'")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_write_then_read_roundtrip():
    """Write a memory, read it back, content should match."""
    name = _unique_name("write_read")
    try:
        write_result = await _call(
            "memory_write",
            name=name,
            content="The first memory body.",
            record_type="feedback",
            why="for testing the write path",
        )
        assert write_result["ok"] is True
        assert write_result["name"] == name
        assert write_result["replaced_existing"] is False

        read_result = await _call("memory_read", name=name)
        assert read_result is not None
        assert read_result["name"] == name
        assert read_result["type"] == "feedback"
        assert read_result["content"] == "The first memory body."
        assert read_result["why"] == "for testing the write path"
    finally:
        _hard_delete(name)


@pytest.mark.asyncio
async def test_write_is_idempotent_upsert():
    """Writing the same name twice should replace, not duplicate."""
    name = _unique_name("upsert")
    try:
        await _call("memory_write", name=name, content="v1", record_type="project")
        second = await _call("memory_write", name=name, content="v2", record_type="project")
        assert second["ok"] is True
        assert second["replaced_existing"] is True

        read_result = await _call("memory_read", name=name)
        assert read_result["content"] == "v2"
    finally:
        _hard_delete(name)


@pytest.mark.asyncio
async def test_read_missing_returns_null():
    """Read of a name that doesn't exist returns null (None in Python)."""
    result = await _call("memory_read", name=_unique_name("missing"))
    assert result is None


@pytest.mark.asyncio
async def test_list_filters_by_record_type():
    """memory_list with record_type=feedback should only return feedback memories."""
    names = {
        "feedback": _unique_name("list_fb"),
        "project": _unique_name("list_pj"),
    }
    try:
        await _call("memory_write", name=names["feedback"], content="f", record_type="feedback")
        await _call("memory_write", name=names["project"], content="p", record_type="project")

        entries = await _call("memory_list", record_type="feedback")
        listed_names = {e["name"] for e in entries}
        assert names["feedback"] in listed_names
        assert names["project"] not in listed_names
    finally:
        for n in names.values():
            _hard_delete(n)


@pytest.mark.asyncio
async def test_delete_soft_deletes_and_excludes_from_reads():
    """Soft-delete should make memory_read return null and memory_list skip it."""
    name = _unique_name("delete")
    try:
        await _call("memory_write", name=name, content="to be deleted", record_type="project")
        await _call("memory_delete", name=name)

        read_result = await _call("memory_read", name=name)
        assert read_result is None, "soft-deleted memories should not be returned by read"

        entries = await _call("memory_list")
        listed_names = {e["name"] for e in entries}
        assert name not in listed_names, "soft-deleted memories should not appear in list"
    finally:
        _hard_delete(name)


@pytest.mark.asyncio
async def test_delete_missing_returns_not_found():
    result = await _call("memory_delete", name=_unique_name("never_existed"))
    assert result["ok"] is False
    assert result["reason"] == "not_found"


@pytest.mark.asyncio
async def test_search_returns_semantic_matches():
    """Write two memories with distinct topics; search for one topic returns it first."""
    a = _unique_name("search_a")
    b = _unique_name("search_b")
    try:
        await _call(
            "memory_write",
            name=a,
            content="Python asyncio coroutines and event loops",
            record_type="reference",
        )
        await _call(
            "memory_write",
            name=b,
            content="React component lifecycle and hooks",
            record_type="reference",
        )
        results = await _call("memory_search", query="async event loop concurrency", limit=2)
        assert len(results) >= 1
        # The async/event-loop query should rank `a` ahead of `b`.
        names_in_order = [r["name"] for r in results]
        assert a in names_in_order
        # If both are returned, `a` should come first.
        if b in names_in_order:
            assert names_in_order.index(a) < names_in_order.index(b)
    finally:
        _hard_delete(a)
        _hard_delete(b)


@pytest.mark.asyncio
async def test_recall_returns_top_n_relevant():
    """memory_recall is semantic search aliased for session-start use."""
    name = _unique_name("recall")
    try:
        await _call(
            "memory_write",
            name=name,
            content="Liz uses PowerShell on Windows, not bash",
            record_type="user",
        )
        results = await _call("memory_recall", context="terminal shell preferences", n=3)
        names = [r["name"] for r in results]
        assert name in names
    finally:
        _hard_delete(name)


@pytest.mark.asyncio
async def test_write_with_invalid_record_type_returns_error():
    name = _unique_name("invalid_type")
    result = await _call(
        "memory_write",
        name=name,
        content="x",
        record_type="not_a_real_type",
    )
    assert "error" in result


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
