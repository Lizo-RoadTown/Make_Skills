"""
File-backed roadmap operations. ROADMAP.md at the repo root is the
single source of truth; this module reads and surgically updates it.

Why file-based: human edits in VS Code, agent edits via these helpers,
git tracks history for free, no DB schema to maintain. Locally the
container's volume mount means agent writes propagate to the host. On
Render (no mount), writes update the in-container copy only — survives
until the next deploy. For durable cloud writes, a future addition is
a git-commit-from-container path; not implemented yet.
"""
from __future__ import annotations

import os
import re
import threading
from pathlib import Path

ROADMAP_FILENAME = "ROADMAP.md"

_lock = threading.Lock()

VALID_STATUSES = {"shipped", "partial", "not_started", "needs_discussion"}
STATUS_EMOJI = {
    "shipped": "✓",
    "partial": "⚠",
    "not_started": "✗",
    "needs_discussion": "💬",
}
EMOJI_TO_STATUS = {v: k for k, v in STATUS_EMOJI.items()}


def _path() -> Path:
    root = Path(os.environ.get("AGENT_REPO_ROOT", "/repo"))
    return root / ROADMAP_FILENAME


def read_roadmap() -> str:
    p = _path()
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8")


def write_roadmap(content: str) -> None:
    p = _path()
    with _lock:
        p.write_text(content, encoding="utf-8")


def apply_status_update(item_title: str, new_status: str, why: str | None = None) -> dict:
    """Find the markdown table row whose first column starts with `item_title`,
    replace its status emoji with the one for `new_status`, and optionally
    update the third column ("notes") with `why`. Returns a result dict
    describing what changed.
    """
    if new_status not in VALID_STATUSES:
        return {"ok": False, "error": f"invalid status {new_status!r}; must be one of {sorted(VALID_STATUSES)}"}

    target_emoji = STATUS_EMOJI[new_status]
    content = read_roadmap()
    if not content:
        return {"ok": False, "error": "ROADMAP.md not found"}

    # Match a markdown table row whose first cell starts with item_title.
    # Pattern: "| <item title> | <status emoji> | <notes>"
    # We're permissive about whitespace and partial title matches.
    norm_title = item_title.strip().lower()
    lines = content.splitlines()
    hits = []
    for i, line in enumerate(lines):
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.split("|")[1:-1]]  # strip leading/trailing |
        if len(cells) < 2:
            continue
        if cells[0].lower().startswith(norm_title) or norm_title in cells[0].lower():
            hits.append((i, cells))

    if not hits:
        return {"ok": False, "error": f"no row found matching {item_title!r}"}
    if len(hits) > 1:
        # Disambiguate: prefer exact match if any
        exact = [h for h in hits if h[1][0].strip().lower() == norm_title]
        if len(exact) == 1:
            hits = exact
        else:
            return {
                "ok": False,
                "error": f"multiple rows match {item_title!r}: {[h[1][0] for h in hits]}",
            }

    idx, cells = hits[0]
    old_status_emoji = cells[1].strip()
    cells[1] = target_emoji
    if why:
        if len(cells) >= 3:
            cells[2] = why
        else:
            cells.append(why)

    new_line = "| " + " | ".join(cells) + " |"
    lines[idx] = new_line
    write_roadmap("\n".join(lines) + ("\n" if content.endswith("\n") else ""))

    return {
        "ok": True,
        "item": cells[0],
        "old_status": EMOJI_TO_STATUS.get(old_status_emoji, old_status_emoji),
        "new_status": new_status,
        "line": idx + 1,
    }


def append_under_section(section_heading: str, markdown_block: str) -> dict:
    """Append a block of markdown immediately after the given section heading
    (e.g. "## Pillar 1 — Build agents"). Used to add new items the agent
    has discovered or the user has asked for. Idempotency is the caller's
    responsibility — this always appends.
    """
    content = read_roadmap()
    if not content:
        return {"ok": False, "error": "ROADMAP.md not found"}

    # Match the heading line exactly (with leading ## etc.)
    pattern = re.compile(rf"^(#+\s+{re.escape(section_heading)}\s*)$", re.MULTILINE)
    m = pattern.search(content)
    if not m:
        return {"ok": False, "error": f"section heading not found: {section_heading!r}"}

    # Insert after the heading line (and any blank line after it).
    insert_at = m.end()
    while insert_at < len(content) and content[insert_at] == "\n":
        insert_at += 1
    new_content = content[:insert_at] + markdown_block.rstrip() + "\n\n" + content[insert_at:]
    write_roadmap(new_content)
    return {"ok": True, "section": section_heading, "appended_chars": len(markdown_block)}
