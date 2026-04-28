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
        ]
    )


def get_table():
    """Lazily initialize and cache the LanceDB connection + table + embedder."""
    global _db, _table, _embedder
    with _lock:
        if _table is not None:
            return _table, _embedder
        data_dir = _data_dir()
        data_dir.mkdir(parents=True, exist_ok=True)
        _db = lancedb.connect(str(data_dir))
        _table = _db.create_table(TABLE_NAME, schema=_schema(), exist_ok=True)
        _embedder = TextEmbedding(model_name=DEFAULT_MODEL)
        return _table, _embedder


def embed(text: str) -> list[float]:
    """Embed a single string. fastembed returns a numpy array; convert to list."""
    _, embedder = get_table()
    vec = next(embedder.embed([text]))
    return vec.tolist()


def insert_records(records: list[dict[str, Any]]) -> int:
    """Insert records. Each dict must have id, type, content, project_tags,
    source_thread_id, ts, why. The vector field is computed here from `content`.
    Returns the count inserted.
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
            }
        )
    table.add(rows)
    return len(rows)


def search(
    query: str,
    limit: int = 5,
    record_type: str | None = None,
    project_tags: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Semantic search. Returns top-N records by vector similarity, optionally
    filtered by type and/or project_tags (any-overlap)."""
    table, _ = get_table()
    qvec = embed(query)
    q = table.search(qvec).limit(limit)
    where_parts = []
    if record_type:
        # LanceDB SQL string filter
        where_parts.append(f"type = '{_sql_escape(record_type)}'")
    if project_tags:
        # Any-overlap on the array column
        tag_filters = [
            f"array_contains(project_tags, '{_sql_escape(t)}')"
            for t in project_tags
        ]
        where_parts.append("(" + " OR ".join(tag_filters) + ")")
    if where_parts:
        q = q.where(" AND ".join(where_parts), prefilter=True)
    return [_strip(row) for row in q.to_list()]


def list_records(
    limit: int = 50,
    offset: int = 0,
    record_type: str | None = None,
    project_tag: str | None = None,
) -> list[dict[str, Any]]:
    """Non-semantic listing. Newest first."""
    table, _ = get_table()
    q = table.search().select(
        ["id", "type", "content", "project_tags", "source_thread_id", "ts", "why"]
    )
    where_parts = []
    if record_type:
        where_parts.append(f"type = '{_sql_escape(record_type)}'")
    if project_tag:
        where_parts.append(f"array_contains(project_tags, '{_sql_escape(project_tag)}')")
    if where_parts:
        q = q.where(" AND ".join(where_parts))
    rows = q.limit(limit + offset).to_list()
    rows = sorted(rows, key=lambda r: r.get("ts", 0), reverse=True)
    return [_strip(r) for r in rows[offset : offset + limit]]


def count() -> int:
    table, _ = get_table()
    return table.count_rows()


def _sql_escape(s: str) -> str:
    return s.replace("'", "''")


def _strip(row: dict[str, Any]) -> dict[str, Any]:
    """Drop the vector field from API responses — it's noise to clients."""
    return {k: v for k, v in row.items() if k != "vector" and k != "_distance"}
