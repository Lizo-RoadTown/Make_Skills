"""
LanceDB-backed semantic memory store.

Single source of truth for "what we've talked about" across sessions.
The agent does NOT carry conversation history in context — it queries
this store on demand via the recall() tool.

Storage is a directory on disk (mounted as a volume in docker-compose).
Embeddings are computed locally via fastembed (ONNX, no external API).
"""
from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any

import lancedb
import pyarrow as pa
from fastembed import TextEmbedding

# Small, fast, high-quality default. 384-dim, ~80MB ONNX model.
DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"
DEFAULT_NDIMS = 384

TABLE_NAME = "records"

_lock = threading.Lock()
_db: lancedb.DBConnection | None = None
_table: Any = None
_embedder: TextEmbedding | None = None


def _data_dir() -> Path:
    return Path(os.environ.get("MEMORY_DATA_DIR", "/data/memory"))


def _schema() -> pa.Schema:
    return pa.schema(
        [
            ("id", pa.string()),
            ("type", pa.string()),
            ("content", pa.string()),
            ("vector", pa.list_(pa.float32(), DEFAULT_NDIMS)),
            ("project_tags", pa.list_(pa.string())),
            ("source_thread_id", pa.string()),
            ("ts", pa.float64()),
            ("why", pa.string()),
            # Pillar 0 — tenant_id is the scope key, visibility is the
            # publish flag for the future public commons (3c). Both are
            # BTREE-indexed in api/migrations.py for prefilter pushdown.
            ("tenant_id", pa.string()),
            ("visibility", pa.string()),
        ]
    )


def get_table():
    """Lazily initialize and cache the LanceDB connection + table + embedder.

    Open-then-create rather than `create_table(..., exist_ok=True)`: LanceDB
    does strict schema comparison on exist_ok and the migration's
    `add_columns` evolution can introduce field-metadata differences (e.g.
    nullability) that make exact-match fail even when the columns are right.
    """
    global _db, _table, _embedder
    with _lock:
        if _table is not None:
            return _table, _embedder
        data_dir = _data_dir()
        data_dir.mkdir(parents=True, exist_ok=True)
        _db = lancedb.connect(str(data_dir))
        # Always try open first. Some LanceDB versions return stale data from
        # list_tables() right after a process restart, so neither
        # `if name in list_tables()` nor `create_table(..., exist_ok=True)`
        # is reliable. Open succeeds when the table is on disk; on absence we
        # fall through to create.
        try:
            _table = _db.open_table(TABLE_NAME)
        except Exception:
            _table = _db.create_table(TABLE_NAME, schema=_schema())
        _embedder = TextEmbedding(model_name=DEFAULT_MODEL)
        return _table, _embedder


def embed(text: str) -> list[float]:
    """Embed a single string. fastembed returns a numpy array; convert to list."""
    _, embedder = get_table()
    vec = next(embedder.embed([text]))
    return vec.tolist()


def insert_records(
    records: list[dict[str, Any]],
    tenant_id: str,
    visibility: str = "private",
) -> int:
    """Insert records scoped to `tenant_id`. visibility defaults to 'private';
    pass 'public' to mark a record as part of the future Pillar 3c commons.

    Each dict must have id, type, content, project_tags, source_thread_id,
    ts, why. The vector field is computed here from `content`.
    """
    if not records:
        return 0
    table, _ = get_table()
    rows = []
    for r in records:
        rows.append(
            {
                "id": r["id"],
                "type": r["type"],
                "content": r["content"],
                "vector": embed(r["content"]),
                "project_tags": r.get("project_tags", []),
                "source_thread_id": r.get("source_thread_id", ""),
                "ts": float(r.get("ts", 0)),
                "why": r.get("why", ""),
                "tenant_id": tenant_id,
                "visibility": visibility,
            }
        )
    table.add(rows)
    return len(rows)


def _tenant_clause(tenant_id: str, include_public: bool) -> str:
    """Build the SQL fragment that scopes a query to one tenant, optionally
    plus the public commons. Always returned wrapped in parens so it can be
    AND-ed with caller filters."""
    me = _sql_escape(tenant_id)
    if include_public:
        return f"(visibility = 'public' OR tenant_id = '{me}')"
    return f"tenant_id = '{me}'"


def search(
    query: str,
    tenant_id: str,
    limit: int = 5,
    record_type: str | None = None,
    project_tags: list[str] | None = None,
    include_public: bool = True,
) -> list[dict[str, Any]]:
    """Semantic search scoped to `tenant_id`. Returns top-N by vector similarity.

    Optional filters: record type, project_tags (any-overlap). When
    `include_public=True` (the default), records with visibility='public'
    from any tenant are also eligible — this is the Pillar 3c commons path.
    """
    table, _ = get_table()
    qvec = embed(query)
    q = table.search(qvec).limit(limit)
    where_parts = [_tenant_clause(tenant_id, include_public)]
    if record_type:
        where_parts.append(f"type = '{_sql_escape(record_type)}'")
    if project_tags:
        tag_filters = [
            f"array_contains(project_tags, '{_sql_escape(t)}')"
            for t in project_tags
        ]
        where_parts.append("(" + " OR ".join(tag_filters) + ")")
    q = q.where(" AND ".join(where_parts), prefilter=True)
    return [_strip(row) for row in q.to_list()]


def list_records(
    tenant_id: str,
    limit: int = 50,
    offset: int = 0,
    record_type: str | None = None,
    project_tag: str | None = None,
    include_public: bool = True,
) -> list[dict[str, Any]]:
    """Non-semantic listing scoped to `tenant_id`. Newest first."""
    table, _ = get_table()
    q = table.search().select(
        ["id", "type", "content", "project_tags", "source_thread_id", "ts", "why",
         "tenant_id", "visibility"]
    )
    where_parts = [_tenant_clause(tenant_id, include_public)]
    if record_type:
        where_parts.append(f"type = '{_sql_escape(record_type)}'")
    if project_tag:
        where_parts.append(f"array_contains(project_tags, '{_sql_escape(project_tag)}')")
    q = q.where(" AND ".join(where_parts))
    rows = q.limit(limit + offset).to_list()
    rows = sorted(rows, key=lambda r: r.get("ts", 0), reverse=True)
    return [_strip(r) for r in rows[offset : offset + limit]]


def count(tenant_id: str, include_public: bool = False) -> int:
    """Row count scoped to `tenant_id`. include_public=False by default so
    KPI cards show 'your records', not 'your records + the commons'."""
    table, _ = get_table()
    where = _tenant_clause(tenant_id, include_public)
    # LanceDB count_rows accepts a filter expression in current versions.
    try:
        return table.count_rows(filter=where)
    except TypeError:
        # Fallback for older LanceDB versions: scan-and-count via search().
        rows = table.search().where(where).limit(10**9).to_list()
        return len(rows)


def _sql_escape(s: str) -> str:
    return s.replace("'", "''")


def _strip(row: dict[str, Any]) -> dict[str, Any]:
    """Drop the vector field from API responses — it's noise to clients."""
    return {k: v for k, v in row.items() if k != "vector" and k != "_distance"}
