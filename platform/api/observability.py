"""
Aggregation queries for the /observability dashboard.

Reads from postgres (LangGraph checkpoints, conversations sidecar) and
LanceDB (memory records). Tenant-scoped via the `tenant_id` argument
threaded through every public function — the FastAPI endpoints in
main.py pass `ctx.tenant_id` from `Depends(get_current_tenant)`.

Memory records are filtered by tenant_id at the LanceDB layer (BTREE
index for prefilter pushdown). Thread counts join through the
conversations table so RLS scopes them by `app.tenant_id` automatically.
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


def _tenant_filter(tenant_id: str) -> str:
    """LanceDB SQL filter: caller's records only (commons excluded from
    observability — these are 'your stats', not 'community stats')."""
    safe = tenant_id.replace("'", "''")
    return f"tenant_id = '{safe}'"


def memory_records_by_type(tenant_id: str) -> list[dict[str, Any]]:
    """Counts of memory records grouped by type, scoped to tenant_id."""
    table, _ = get_table()
    rows = (
        table.search()
        .where(_tenant_filter(tenant_id))
        .select(["type"])
        .limit(100_000)
        .to_list()
    )
    counter = Counter((r.get("type") or "unknown") for r in rows)
    return [{"type": t, "count": c} for t, c in counter.most_common()]


def memory_records_by_day(tenant_id: str, days: int = 30) -> list[dict[str, Any]]:
    """Daily counts of memory records over the last N days, scoped to tenant_id."""
    table, _ = get_table()
    rows = (
        table.search()
        .where(_tenant_filter(tenant_id))
        .select(["ts"])
        .limit(100_000)
        .to_list()
    )
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


def memory_records_by_tag(tenant_id: str, top: int = 10) -> list[dict[str, Any]]:
    """Top project_tags by record count, scoped to tenant_id."""
    table, _ = get_table()
    rows = (
        table.search()
        .where(_tenant_filter(tenant_id))
        .select(["project_tags"])
        .limit(100_000)
        .to_list()
    )
    counter: Counter[str] = Counter()
    for r in rows:
        for t in r.get("project_tags") or []:
            if t:
                counter[t] += 1
    return [{"tag": t, "count": c} for t, c in counter.most_common(top)]


def thread_count(tenant_id: str) -> int:
    """Count of distinct threads belonging to this tenant.

    Joins through `conversations` which carries the tenant_id mapping.
    Sets app.tenant_id locally so RLS on conversations applies. The
    checkpoints table itself has no tenant column today (defense-in-depth
    item deferred per the proposal).
    """
    try:
        with psycopg.connect(_db_url(), connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (tenant_id,)
                )
                cur.execute(
                    """
                    SELECT COUNT(DISTINCT c.thread_id)
                    FROM conversations c
                    WHERE c.tenant_id = %s::uuid
                    """,
                    (tenant_id,),
                )
                row = cur.fetchone()
                return int(row[0]) if row and row[0] is not None else 0
    except Exception:
        return 0


def threads_by_day(tenant_id: str, days: int = 30) -> list[dict[str, Any]]:
    """Daily count of NEW threads for this tenant, by created_at on
    `conversations`."""
    try:
        with psycopg.connect(_db_url(), connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT set_config('app.tenant_id', %s, true)", (tenant_id,)
                )
                cur.execute(
                    """
                    SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
                           COUNT(*) AS new_threads
                    FROM conversations
                    WHERE tenant_id = %s::uuid
                      AND created_at >= now() - INTERVAL '%s days'
                    GROUP BY day
                    ORDER BY day
                    """,
                    (tenant_id, days),
                )
                rows = cur.fetchall()
        return [{"day": r[0], "count": int(r[1])} for r in rows if r[0]]
    except Exception:
        return []


def recent_records(tenant_id: str, limit: int = 10) -> list[dict[str, Any]]:
    """Most recent memory records for this tenant — feeds the activity feed."""
    table, _ = get_table()
    rows = (
        table.search()
        .where(_tenant_filter(tenant_id))
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


def summary(tenant_id: str) -> dict[str, Any]:
    """Top-of-page KPIs for this tenant."""
    table, _ = get_table()
    where = _tenant_filter(tenant_id)
    try:
        total = table.count_rows(filter=where)
    except TypeError:
        total = len(
            table.search().where(where).limit(10**9).to_list()
        )
    return {
        "total_records": total,
        "total_threads": thread_count(tenant_id),
        "by_type": memory_records_by_type(tenant_id),
    }
