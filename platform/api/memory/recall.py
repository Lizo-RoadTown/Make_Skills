"""
Tools and helpers for the agent to query semantic memory.

The agent gets a `recall(query, ...)` tool. It pulls relevant prior
records into context on demand instead of loading full chat history.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.tools import tool

from api.memory.lance import search


@tool
def recall(
    query: str,
    limit: int = 5,
    record_type: Optional[str] = None,
    project_tag: Optional[str] = None,
) -> str:
    """Recall prior records from semantic memory matching a natural-language
    query. Use this BEFORE answering a question that might benefit from prior
    context (decisions made earlier, lessons learned, user preferences,
    project-specific facts). The memory store accumulates over time; do not
    assume a query that returns nothing means a topic was never discussed —
    rephrase or broaden.

    Args:
        query: Natural-language description of what to recall.
        limit: Max records to return (default 5, hard max 20).
        record_type: Optional filter — one of decision, lesson, preference,
            skill_idea, topic, fact.
        project_tag: Optional filter — return only records tagged with this
            project (e.g. "agents", "deploy", "vercel").

    Returns:
        A markdown-formatted list of records with type, content, tags, and a
        "why this matters" line, or "(no matching records)".
    """
    limit = max(1, min(int(limit or 5), 20))
    rows = search(
        query=query,
        limit=limit,
        record_type=record_type,
        project_tags=[project_tag] if project_tag else None,
    )
    if not rows:
        return "(no matching records)"

    parts = []
    for i, r in enumerate(rows, 1):
        tags = ", ".join(r.get("project_tags", [])) or "—"
        parts.append(
            f"### {i}. [{r.get('type', '?')}] {r.get('content', '').strip()}\n"
            f"   - tags: {tags}\n"
            f"   - why: {r.get('why', '').strip() or '—'}"
        )
    return "\n\n".join(parts)
