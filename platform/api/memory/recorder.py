"""
After each chat turn, extract structured records and persist to LanceDB.

Run as a fire-and-forget background task so it doesn't block the response.
The extraction itself is a single Anthropic call to Haiku (cheap + fast)
that produces 0..N records categorized by type.

Failure is non-fatal: if extraction errors, log and move on. Memory is
best-effort enrichment, not a critical path.
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any

from anthropic import AsyncAnthropic

from api.memory.lance import insert_records

log = logging.getLogger("recorder")

EXTRACTOR_MODEL = os.environ.get("RECORDER_MODEL", "claude-haiku-4-5-20251001")

EXTRACTION_PROMPT = """You extract structured memory records from a single chat turn between a user and an agent.

Return a JSON array. Each element is an object with:
  - type: one of "decision" | "lesson" | "preference" | "skill_idea" | "topic" | "fact"
  - content: 1-3 sentences, written so a future agent reading this in isolation will understand
  - project_tags: list of short lowercase tags (e.g. ["agents", "deploy", "vercel"]). Empty list ok.
  - why: one short sentence — why is this worth remembering?

Rules:
  - Skip filler. If the turn is small talk or a status check, return [].
  - At most 3 records per turn. Be ruthless.
  - "decision": the user or the work made a choice that affects future work
  - "lesson": something failed or worked, future runs should remember
  - "preference": user said how they want things done, going forward
  - "skill_idea": a recurring task pattern that could become a reusable skill
  - "topic": a subject area discussed at length, useful for cross-session linking
  - "fact": durable info about the user, project, or environment

Output ONLY the JSON array, no prose, no markdown fences."""


async def record_turn(
    thread_id: str,
    user_message: str,
    agent_response: str,
) -> int:
    """Extract records from one (user, agent) pair and insert them.

    Returns count inserted. Errors are logged and swallowed.
    """
    try:
        records = await _extract(user_message, agent_response)
    except Exception as e:
        log.warning("recorder extraction failed: %s", e)
        return 0

    if not records:
        return 0

    rows = []
    now = time.time()
    for r in records:
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "type": _clamp_type(r.get("type", "topic")),
                "content": str(r.get("content", "")).strip(),
                "project_tags": [
                    str(t).lower().strip() for t in r.get("project_tags", []) if t
                ][:8],
                "source_thread_id": thread_id,
                "ts": now,
                "why": str(r.get("why", "")).strip()[:300],
            }
        )

    rows = [r for r in rows if r["content"]]
    if not rows:
        return 0

    try:
        return insert_records(rows)
    except Exception as e:
        log.warning("recorder insert failed: %s", e)
        return 0


_VALID_TYPES = {"decision", "lesson", "preference", "skill_idea", "topic", "fact"}


def _clamp_type(t: str) -> str:
    t = (t or "").strip().lower()
    return t if t in _VALID_TYPES else "topic"


_client: AsyncAnthropic | None = None


def _client_singleton() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic()
    return _client


async def _extract(user_message: str, agent_response: str) -> list[dict[str, Any]]:
    client = _client_singleton()
    msg = await client.messages.create(
        model=EXTRACTOR_MODEL,
        max_tokens=800,
        system=EXTRACTION_PROMPT,
        messages=[
            {
                "role": "user",
                "content": (
                    f"USER MESSAGE:\n{user_message}\n\n"
                    f"AGENT RESPONSE:\n{agent_response}"
                ),
            }
        ],
    )
    text = "".join(
        block.text for block in msg.content if getattr(block, "type", None) == "text"
    ).strip()
    if not text:
        return []

    # Strip accidental markdown fences if the model added them.
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text.rsplit("\n", 1)[0]
    text = text.strip()

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        log.warning("recorder: model returned non-JSON: %r", text[:200])
        return []

    if not isinstance(parsed, list):
        return []
    return [r for r in parsed if isinstance(r, dict)]
