"""
Sessions inspector — list past chat sessions for a tenant + show the
full message trace for one session. A "session" here is one row in
the conversations table (thread_id ↔ tenant_id mapping) plus the
LangGraph checkpoint chain for that thread_id.

The dashboard's /sessions page calls these endpoints. Tenant scoping
happens at the SQL level via app.tenant_id GUC + RLS on conversations.
"""
from __future__ import annotations

import json
import os
from typing import Any

import psycopg


def _db_url() -> str:
    return os.environ["DATABASE_URL"]


def list_sessions(tenant_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Conversations the calling tenant owns, newest first, with
    checkpoint counts so the UI can show 'how active was this session'.
    """
    try:
        with psycopg.connect(_db_url(), connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (tenant_id,)
                )
                cur.execute(
                    """
                    SELECT
                        c.thread_id,
                        c.title,
                        c.created_at,
                        COALESCE(cc.checkpoint_count, 0) AS checkpoint_count,
                        cc.last_checkpoint_id
                    FROM conversations c
                    LEFT JOIN (
                        SELECT
                            thread_id,
                            COUNT(*) AS checkpoint_count,
                            MAX(checkpoint_id) AS last_checkpoint_id
                        FROM checkpoints
                        GROUP BY thread_id
                    ) cc ON cc.thread_id = c.thread_id
                    WHERE c.tenant_id = %s::uuid
                    ORDER BY c.created_at DESC
                    LIMIT %s
                    """,
                    (tenant_id, limit),
                )
                rows = cur.fetchall()
        return [
            {
                "thread_id": r[0],
                "title": r[1],
                "created_at": r[2].isoformat() if r[2] else None,
                "checkpoint_count": int(r[3]),
                "last_checkpoint_id": r[4],
            }
            for r in rows
        ]
    except Exception:
        return []


def get_session_metadata(tenant_id: str, thread_id: str) -> dict[str, Any]:
    """Conversation-row metadata + checkpoint timeline for one session.
    Verifies tenant ownership via conversations table — leaked-thread-id-
    replay defense. Returns metadata only; messages come from
    agent.aget_state() in the calling endpoint (proper LangGraph
    deserialization vs raw JSONB parse).
    """
    with psycopg.connect(_db_url(), connect_timeout=10) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT set_config('app.tenant_id', %s, true)", (tenant_id,)
            )
            cur.execute(
                "SELECT thread_id, title, created_at FROM conversations "
                "WHERE thread_id = %s",
                (thread_id,),
            )
            conv = cur.fetchone()
            if not conv:
                raise PermissionError(
                    f"thread {thread_id} not visible to this tenant"
                )

            cur.execute(
                """
                SELECT checkpoint_id, parent_checkpoint_id,
                       checkpoint_ns, type, metadata
                FROM checkpoints
                WHERE thread_id = %s
                ORDER BY checkpoint_id ASC
                """,
                (thread_id,),
            )
            checkpoint_rows = cur.fetchall()

    return {
        "thread_id": conv[0],
        "title": conv[1],
        "created_at": conv[2].isoformat() if conv[2] else None,
        "checkpoint_count": len(checkpoint_rows),
        "checkpoints": [
            {
                "checkpoint_id": r[0],
                "parent_checkpoint_id": r[1],
                "checkpoint_ns": r[2],
                "type": r[3],
                "metadata": r[4],
            }
            for r in checkpoint_rows
        ],
    }


def messages_from_state(values: Any) -> list[dict[str, Any]]:
    """Extract messages from a LangGraph state snapshot's `values` dict.
    `values` is what `agent.aget_state(config).values` returns — already
    deserialized. Each entry is an AnyMessage-shaped object."""
    raw_messages = values.get("messages") if isinstance(values, dict) else None
    if not isinstance(raw_messages, list):
        return []

    out: list[dict[str, Any]] = []
    for m in raw_messages:
        # LangChain message classes (HumanMessage, AIMessage, ToolMessage, etc.)
        # expose .type, .content, .tool_calls, .name attributes.
        msg_type = getattr(m, "type", None) or (
            m.get("type") if isinstance(m, dict) else None
        )
        content = (
            getattr(m, "content", None)
            if not isinstance(m, dict)
            else m.get("content")
        )
        tool_calls = (
            getattr(m, "tool_calls", None)
            if not isinstance(m, dict)
            else m.get("tool_calls")
        ) or []
        name = (
            getattr(m, "name", None)
            if not isinstance(m, dict)
            else m.get("name")
        )

        out.append(
            {
                "type": msg_type,
                "content": _extract_text(content),
                "tool_calls": _serialize_tool_calls(tool_calls),
                "name": name,
            }
        )
    return out


def _serialize_tool_calls(calls: Any) -> list[dict[str, Any]]:
    """Tool call objects (ToolCall typed dicts in LangGraph) are JSON-
    serializable but may contain nested non-serializable types. Best-
    effort coerce to plain dicts."""
    if not isinstance(calls, list):
        return []
    out: list[dict[str, Any]] = []
    for c in calls:
        if isinstance(c, dict):
            out.append(
                {
                    "name": c.get("name"),
                    "args": c.get("args"),
                    "id": c.get("id"),
                }
            )
        else:
            out.append({"name": str(c)})
    return out


def _extract_text(content: Any) -> str:
    """LangGraph messages have content as either a string OR a list of
    content blocks ({type:'text', text:'...'}, {type:'tool_use', ...}).
    Extract a readable string."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_use":
                    parts.append(
                        f"[tool_use: {block.get('name', '?')}({json.dumps(block.get('input', {}), default=str)[:200]})]"
                    )
                elif block.get("type") == "tool_result":
                    parts.append(f"[tool_result: {str(block.get('content', ''))[:300]}]")
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return str(content)
