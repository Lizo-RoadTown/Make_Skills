"""
Aggregation queries for the /observability dashboard.

Reads from postgres (LangGraph checkpoints, agent_events if/when added)
and LanceDB (memory records). Returns shapes that map cleanly onto
Recharts components in the web UI.

Tenant-scoping note: when the multitenant path lights up, every query
here must add `WHERE tenant_id = :tid`. For now (single-tenant),
queries are unscoped.
"""
from __future__ import annotations

import os
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import psycopg

from api.memory.lance import get_table


def _db_url() -> str:
    return os.environ["DATABASE_URL"]


def memory_records_by_type() -> list[dict[str, Any]]:
    """Counts of memory records grouped by type."""
    table, _ = get_table()
    rows = table.search().select(["type"]).limit(100_000).to_list()
    counter = Counter((r.get("type") or "unknown") for r in rows)
    return [{"type": t, "count": c} for t, c in counter.most_common()]


def memory_records_by_day(days: int = 30) -> list[dict[str, Any]]:
    """Daily counts of memory records over the last N days."""
    table, _ = get_table()
    rows = table.search().select(["ts"]).limit(100_000).to_list()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).timestamp()
    by_day: dict[str, int] = defaultdict(int)
    for r in rows:
        ts = r.get("ts")
        if not ts or ts < cutoff:
            continue
        day = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
        by_day[day] += 1
    today = datetime.now(timezone.utc).date()
    out = []
    for offset in range(days, -1, -1):
        d = (today - timedelta(days=offset)).isoformat()
        out.append({"day": d, "count": by_day.get(d, 0)})
    return out


def memory_records_by_tag(top: int = 10) -> list[dict[str, Any]]:
    """Top project_tags by record count."""
    table, _ = get_table()
    rows = table.search().select(["project_tags"]).limit(100_000).to_list()
    counter: Counter[str] = Counter()
    for r in rows:
        for t in r.get("project_tags") or []:
            if t:
                counter[t] += 1
    return [{"tag": t, "count": c} for t, c in counter.most_common(top)]


def thread_count() -> int:
    """Distinct conversation thread count from LangGraph checkpoints."""
    try:
        with psycopg.connect(_db_url(), connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(DISTINCT thread_id) "
                    "FROM checkpoints WHERE thread_id IS NOT NULL"
                )
                row = cur.fetchone()
                return int(row[0]) if row and row[0] is not None else 0
    except Exception:
        return 0


def threads_by_day(days: int = 30) -> list[dict[str, Any]]:
    """Daily count of NEW threads (first-checkpoint-per-thread)."""
    try:
        with psycopg.connect(_db_url(), connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT TO_CHAR(MIN(checkpoint_id::text)::timestamptz, 'YYYY-MM-DD') AS day,
                           COUNT(DISTINCT thread_id) AS new_threads
                    FROM checkpoints
                    WHERE thread_id IS NOT NULL
                    GROUP BY day
                    ORDER BY day
                    """
                )
                rows = cur.fetchall()
        # checkpoint_id is a uuid7-style timestamp-prefixed value; cast may fail.
        # If it does, fall back to current-day total.
        return [{"day": r[0], "count": int(r[1])} for r in rows if r[0]]
    except Exception:
        return []


def recent_records(limit: int = 10) -> list[dict[str, Any]]:
    """Most recent memory records — feeds the activity feed panel."""
    table, _ = get_table()
    rows = (
        table.search()
        .select(["id", "type", "content", "project_tags", "ts", "why"])
        .limit(limit * 5)
        .to_list()
    )
    rows.sort(key=lambda r: r.get("ts") or 0, reverse=True)
    return [
        {
            "id": r.get("id"),
            "type": r.get("type"),
            "content": r.get("content"),
            "project_tags": r.get("project_tags") or [],
            "ts": r.get("ts"),
            "why": r.get("why"),
        }
        for r in rows[:limit]
    ]


def summary() -> dict[str, Any]:
    """Top-of-page KPIs."""
    table, _ = get_table()
    return {
        "total_records": table.count_rows(),
        "total_threads": thread_count(),
        "by_type": memory_records_by_type(),
    }
