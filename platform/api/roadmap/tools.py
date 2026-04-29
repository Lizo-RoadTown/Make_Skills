"""
Agent tools for maintaining ROADMAP.md.

Use these when the agent has shipped a roadmap item, identified a new
one, or learned something that should change an item's status. Don't
use them speculatively — only when there's concrete evidence.
"""
from __future__ import annotations

from typing import Optional

from langchain_core.tools import tool

from api.roadmap.file import (
    VALID_STATUSES,
    append_under_section,
    apply_status_update,
    read_roadmap,
)


@tool
def update_roadmap_status(
    item_title: str,
    new_status: str,
    why: Optional[str] = None,
) -> str:
    """Update the status of a roadmap item in ROADMAP.md by editing the
    markdown table row whose first column matches `item_title`.

    Use this when:
    - You've actually shipped something tracked in the roadmap
      (status: "shipped")
    - Partial progress that's worth surfacing (status: "partial")
    - You've learned the item is blocked or rethought (status: "needs_discussion")
    - You started something previously not_started (status: "partial")

    Don't use this:
    - Speculatively, before the work is real
    - To downgrade items the user marked manually (respect human edits)
    - To rename items — only updates status and the third column

    Args:
        item_title: The first-column text of the row to update. Substring
            match works ("LanceDB embedded" finds "LanceDB embedded
            semantic memory store, no separate service"). Use enough to
            be unambiguous.
        new_status: One of "shipped" | "partial" | "not_started" |
            "needs_discussion".
        why: Optional. Updates the row's third column (notes) with this
            short rationale. Keep under one sentence.

    Returns:
        Result string: success message with the line number changed, or
        an error if the row wasn't found / status invalid.
    """
    if new_status not in VALID_STATUSES:
        return f"ERROR: invalid status {new_status!r}; must be one of {sorted(VALID_STATUSES)}"
    res = apply_status_update(item_title, new_status, why)
    if not res["ok"]:
        return f"ERROR: {res['error']}"
    return (
        f"updated row at line {res['line']}: {res['item']!r} "
        f"({res['old_status']} → {res['new_status']})"
    )


@tool
def add_roadmap_item(
    section_heading: str,
    item_title: str,
    status: str,
    why: Optional[str] = None,
) -> str:
    """Append a new row to a roadmap section's table. Use this when a NEW
    capability becomes worth tracking (user asked for it, you discovered
    it, etc.) and no existing row covers it.

    Args:
        section_heading: Exact heading text without the leading hashes,
            e.g. "Pillar 1 — Build agents" or "3a. Agent comms observability".
        item_title: Short title for the new item (first column).
        status: One of "shipped" | "partial" | "not_started" | "needs_discussion".
        why: Optional one-line context.

    Returns:
        Success message or error. Note: this APPENDS at the top of the
        section after the heading, NOT inside an existing table. Most
        sections have a table — for now, append-after-heading is the
        coarse approach; user can move the row into the table by hand.
    """
    if status not in VALID_STATUSES:
        return f"ERROR: invalid status {status!r}; must be one of {sorted(VALID_STATUSES)}"
    from api.roadmap.file import STATUS_EMOJI

    emoji = STATUS_EMOJI[status]
    why_text = why or ""
    block = f"| {item_title} | {emoji} | {why_text} |"
    res = append_under_section(section_heading, block)
    if not res["ok"]:
        return f"ERROR: {res['error']}"
    return f"appended new item to section {res['section']!r}"


@tool
def roadmap_overview() -> str:
    """Return the full current contents of ROADMAP.md. Use this to check
    the current state before deciding whether to update.
    """
    text = read_roadmap()
    if not text:
        return "(ROADMAP.md is empty or not found)"
    return text
