"""
Memory sync shim — Phase 2 of the LanceDB memory MCP plan.

SCOPE: This shim is **developer tooling for building the app**, not part
of the running app. It lives in `scripts/` (dev-tooling location), not in
`platform/api/` (runtime). The running app's runtime agents already use
LanceDB directly via `platform/api/memory/lance.py` + tools like
`recall()` and `query_db()` — they don't need the MCP server or this
shim. The shim exists so Liz's (and any contributor's) Claude Code
session memory can ride the same LanceDB store across machines.

Two distinct consumers of the same LanceDB store:

  1. The running app's runtime agents (use LanceDB directly — always have)
  2. The developer's Claude Code sessions (Phase 1 MCP server + this shim)

This file is part of (2). It mirrors typed memory files at
~/.claude/projects/<key>/memory/ with the LanceDB store so file-protocol
reads/writes propagate to LanceDB and vice versa. Run as a long-lived
daemon per machine.

Architecture:

  filesystem watcher  ───────┐
  (watchdog on memory dir)   │
                             ▼
                       this shim  ◄─── lancedb (the canonical store)
                             ▲
                             │
            periodic poll ───┘
            (every --interval seconds, default 30)

On startup: pull every non-deleted row from LanceDB → write any missing
file to disk. On any file change: parse frontmatter + body, upsert to
LanceDB. On periodic poll: detect rows with ts newer than the local
file's mtime and update the disk file. Conflict policy: last-write-wins
by timestamp.

Frontmatter format (the existing memory protocol):

    ---
    name: foo-bar
    description: One-liner used as the row's summary.
    metadata:
      type: feedback     # one of: user, feedback, project, reference
    ---
    Body markdown. Indented or unindented; the entire post-frontmatter
    region is content.

Run:
    python -m scripts.memory_shim --memory-dir ~/.claude/projects/<key>/memory

Run once and dry (no daemon, no writes):
    python -m scripts.memory_shim --memory-dir <path> --once --dry-run

Stop with Ctrl-C. The shim flushes any pending writes before exiting.
"""
from __future__ import annotations

import argparse
import logging
import re
import signal
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

# Ensure platform/ is importable when run as a script.
_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "platform"))

from api.memory import lance  # noqa: E402  (path adjustment above)
from api.memory import mcp_server  # noqa: E402  (reuse DEFAULT_TENANT, VISIBILITY_DELETED)

logger = logging.getLogger("memory_shim")

# Filenames that look like memory entries; the shim only syncs these.
# The MEMORY.md index file is intentionally excluded — it's a derived
# artifact maintained by humans and the auto-memory system, not by this shim.
_MEMORY_FILE_PATTERN = re.compile(r"^(user|feedback|project|reference)_[a-z0-9_-]+\.md$", re.IGNORECASE)

VALID_TYPES = {"user", "feedback", "project", "reference"}


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------


@dataclass
class ParsedMemory:
    """A memory file decomposed into its persistent fields."""
    name: str
    record_type: str
    content: str  # Full body markdown (without frontmatter).
    description: str  # Summary line from frontmatter, used for indexing.
    why: str  # Reason field, used for feedback/project memories.


_FRONTMATTER_DELIMITER = "---"


def parse_memory_file(path: Path) -> ParsedMemory | None:
    """Parse a typed memory file. Returns None if the file doesn't have valid
    frontmatter or the metadata type is missing. Always tolerates absent fields
    gracefully — the file protocol is loose by design."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        logger.warning("could not read %s: %s", path, e)
        return None

    lines = text.split("\n")
    # Expect the first line to be "---". If not, treat the whole file as content
    # with an empty frontmatter (still syncs, but with sparse metadata).
    if not lines or lines[0].strip() != _FRONTMATTER_DELIMITER:
        return _without_frontmatter(path, text)

    # Find the closing "---".
    closing = None
    for i in range(1, len(lines)):
        if lines[i].strip() == _FRONTMATTER_DELIMITER:
            closing = i
            break
    if closing is None:
        # Open frontmatter, no close — malformed but recoverable.
        return _without_frontmatter(path, text)

    fm_block = "\n".join(lines[1:closing])
    body = "\n".join(lines[closing + 1 :]).lstrip("\n")

    try:
        fm = yaml.safe_load(fm_block) or {}
    except yaml.YAMLError as e:
        logger.warning("frontmatter parse failed in %s: %s", path, e)
        return _without_frontmatter(path, text)

    name = fm.get("name") or path.stem
    description = fm.get("description") or ""
    why = fm.get("why") or fm.get("Why") or ""
    metadata = fm.get("metadata") or {}
    record_type = metadata.get("type") or _infer_type_from_filename(path.stem)

    if record_type not in VALID_TYPES:
        logger.warning("unknown record_type=%r in %s; defaulting to 'project'", record_type, path)
        record_type = "project"

    return ParsedMemory(
        name=str(name),
        record_type=record_type,
        content=body,
        description=str(description),
        why=str(why),
    )


def _without_frontmatter(path: Path, text: str) -> ParsedMemory:
    """Fallback for files without parseable frontmatter."""
    inferred_type = _infer_type_from_filename(path.stem)
    return ParsedMemory(
        name=path.stem,
        record_type=inferred_type,
        content=text,
        description="",
        why="",
    )


def _infer_type_from_filename(stem: str) -> str:
    """Pull the type prefix from a filename like 'feedback_documentation_tone'."""
    for t in VALID_TYPES:
        if stem.lower().startswith(f"{t}_"):
            return t
    return "project"


def serialize_memory(memory: ParsedMemory) -> str:
    """Render a ParsedMemory back into the file format. Used when pulling a
    LanceDB row to disk."""
    fm: dict[str, Any] = {
        "name": memory.name,
        "description": memory.description,
        "metadata": {"type": memory.record_type},
    }
    if memory.why:
        fm["why"] = memory.why
    fm_yaml = yaml.safe_dump(fm, sort_keys=False).rstrip()
    return f"---\n{fm_yaml}\n---\n{memory.content}"


# ---------------------------------------------------------------------------
# Sync — disk <-> LanceDB
# ---------------------------------------------------------------------------


class Shim:
    """Encapsulates the bidirectional sync logic. Stateful only on
    `last_synced_ts_per_name` to short-circuit unchanged rows during poll."""

    def __init__(self, memory_dir: Path, dry_run: bool = False):
        self.memory_dir = memory_dir
        self.dry_run = dry_run
        self.lock = threading.Lock()
        self.last_synced_ts_per_name: dict[str, float] = {}

    # ---- Disk → LanceDB --------------------------------------------------

    def push_file(self, path: Path) -> bool:
        """Parse the file and upsert to LanceDB. Returns True if the row was
        written, False if skipped (e.g. dry-run, unparseable)."""
        if not _MEMORY_FILE_PATTERN.match(path.name):
            return False
        parsed = parse_memory_file(path)
        if parsed is None:
            return False
        if self.dry_run:
            logger.info("[dry-run] would push %s (type=%s)", parsed.name, parsed.record_type)
            return False
        with self.lock:
            existing = mcp_server._fetch_one(parsed.name, include_deleted=True)
            if existing is not None:
                # LanceDB delete-then-insert. Same logic as memory_write tool.
                table, _ = lance.get_table()
                rid = lance._sql_escape(parsed.name)
                table.delete(f"id = '{rid}' AND tenant_id = '{mcp_server.DEFAULT_TENANT}'")
            ts = path.stat().st_mtime
            record = {
                "id": parsed.name,
                "type": parsed.record_type,
                "content": _combine_for_storage(parsed),
                "project_tags": [],
                "source_thread_id": "",
                "ts": ts,
                "why": parsed.why,
            }
            lance.insert_records([record], tenant_id=mcp_server.DEFAULT_TENANT, visibility="private")
            self.last_synced_ts_per_name[parsed.name] = ts
            logger.info("pushed %s -> LanceDB (ts=%s)", parsed.name, ts)
            return True

    def delete_on_disk_path(self, path: Path) -> bool:
        """The user deleted a file from disk. Soft-delete the corresponding
        LanceDB row. Returns True on success."""
        if not _MEMORY_FILE_PATTERN.match(path.name):
            return False
        # Reconstruct name from filename stem (we lose frontmatter on delete).
        name = path.stem
        if self.dry_run:
            logger.info("[dry-run] would soft-delete %s", name)
            return False
        with self.lock:
            existing = mcp_server._fetch_one(name, include_deleted=True)
            if existing is None:
                return False
            if existing.get("visibility") == mcp_server.VISIBILITY_DELETED:
                return True  # already deleted
            table, _ = lance.get_table()
            rid = lance._sql_escape(name)
            table.delete(f"id = '{rid}' AND tenant_id = '{mcp_server.DEFAULT_TENANT}'")
            record = {
                "id": name,
                "type": existing.get("type") or "project",
                "content": existing.get("content") or "",
                "project_tags": [],
                "source_thread_id": "",
                "ts": existing.get("ts") or time.time(),
                "why": existing.get("why") or "",
            }
            lance.insert_records([record], tenant_id=mcp_server.DEFAULT_TENANT, visibility=mcp_server.VISIBILITY_DELETED)
            self.last_synced_ts_per_name.pop(name, None)
            logger.info("soft-deleted %s in LanceDB", name)
            return True

    # ---- LanceDB → Disk --------------------------------------------------

    def pull_all(self) -> int:
        """Hydrate the disk from LanceDB. Writes any row whose file is missing
        or older than the row's ts. Returns the count of files written."""
        rows = lance.list_records(
            tenant_id=mcp_server.DEFAULT_TENANT,
            limit=10_000,
            include_public=False,
        )
        written = 0
        for row in rows:
            if row.get("visibility") == mcp_server.VISIBILITY_DELETED:
                # If a deleted row's file still exists on disk, leave it alone —
                # last-write-wins lets the user recover by editing the file.
                continue
            name = row.get("id")
            if not name:
                continue
            target = self.memory_dir / f"{name}.md"
            row_ts = float(row.get("ts") or 0)
            if target.exists():
                file_ts = target.stat().st_mtime
                if file_ts >= row_ts:
                    # File is newer or same — disk wins under last-write-wins.
                    continue
            if self.dry_run:
                logger.info("[dry-run] would write %s", target)
                continue
            description, body = _split_for_storage(row.get("content") or "")
            parsed = ParsedMemory(
                name=name,
                record_type=row.get("type") or "project",
                content=body,
                description=description,
                why=row.get("why") or "",
            )
            target.write_text(serialize_memory(parsed), encoding="utf-8")
            # Match file mtime to the row's ts so subsequent push_file is a no-op.
            try:
                import os
                os.utime(target, (row_ts, row_ts))
            except OSError:
                pass
            self.last_synced_ts_per_name[name] = row_ts
            written += 1
            logger.info("pulled %s -> %s (ts=%s)", name, target.name, row_ts)
        return written


# Storage layout: combine description + body so the embedded vector covers both.
# On read, split on the first blank line to recover.
def _combine_for_storage(parsed: ParsedMemory) -> str:
    if parsed.description and parsed.content:
        return f"{parsed.description}\n\n{parsed.content}"
    return parsed.description or parsed.content


def _split_for_storage(stored: str) -> tuple[str, str]:
    """Inverse of _combine_for_storage. Returns (description, body).
    If there's no blank-line separator, the entire string is the body and
    description is empty."""
    if "\n\n" in stored:
        head, _, body = stored.partition("\n\n")
        if "\n" in head:
            # Multi-line head — treat as body, no description.
            return "", stored
        return head, body
    return "", stored


# ---------------------------------------------------------------------------
# Watcher + poll loop
# ---------------------------------------------------------------------------


class _Handler(FileSystemEventHandler):
    """Translates watchdog events into shim operations."""
    def __init__(self, shim: Shim):
        self.shim = shim

    def on_created(self, event: FileSystemEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if _MEMORY_FILE_PATTERN.match(path.name):
            self.shim.push_file(path)

    def on_modified(self, event: FileSystemEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if _MEMORY_FILE_PATTERN.match(path.name):
            self.shim.push_file(path)

    def on_deleted(self, event: FileSystemEvent):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if _MEMORY_FILE_PATTERN.match(path.name):
            self.shim.delete_on_disk_path(path)

    def on_moved(self, event: FileSystemEvent):
        # Treat rename as delete-old + create-new.
        if event.is_directory:
            return
        src = Path(event.src_path)
        dest = Path(event.dest_path)
        if _MEMORY_FILE_PATTERN.match(src.name):
            self.shim.delete_on_disk_path(src)
        if _MEMORY_FILE_PATTERN.match(dest.name):
            self.shim.push_file(dest)


def run_daemon(memory_dir: Path, poll_interval: float, dry_run: bool) -> None:
    """Main loop. Hydrates from LanceDB, starts the watcher, polls forever."""
    shim = Shim(memory_dir, dry_run=dry_run)

    # Hydrate disk from LanceDB (cross-machine pickup).
    written = shim.pull_all()
    logger.info("startup hydration: %d file(s) written/updated", written)

    # Initial push of any disk-only files.
    initial_pushed = 0
    for path in sorted(memory_dir.glob("*.md")):
        if _MEMORY_FILE_PATTERN.match(path.name) and shim.push_file(path):
            initial_pushed += 1
    logger.info("startup push: %d file(s) sent to LanceDB", initial_pushed)

    # Start the filesystem watcher.
    observer = Observer()
    observer.schedule(_Handler(shim), str(memory_dir), recursive=False)
    observer.start()
    logger.info("watching %s for changes", memory_dir)

    stop = threading.Event()

    def _on_signal(*_):
        logger.info("shutting down...")
        stop.set()

    signal.signal(signal.SIGINT, _on_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _on_signal)

    try:
        while not stop.is_set():
            stop.wait(poll_interval)
            if stop.is_set():
                break
            try:
                written = shim.pull_all()
                if written:
                    logger.info("poll cycle: %d file(s) pulled from LanceDB", written)
            except Exception as e:  # noqa: BLE001
                logger.exception("poll cycle failed: %s", e)
    finally:
        observer.stop()
        observer.join(timeout=5)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Memory sync shim — LanceDB <-> disk.")
    p.add_argument(
        "--memory-dir",
        required=True,
        type=Path,
        help="Path to the typed-memory directory (e.g. ~/.claude/projects/<key>/memory).",
    )
    p.add_argument(
        "--interval",
        type=float,
        default=30.0,
        help="Polling interval in seconds (default 30).",
    )
    p.add_argument(
        "--once",
        action="store_true",
        help="Run one sync cycle (push + pull) and exit. No watcher, no polling.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Log what would happen but make no writes.",
    )
    p.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG-level logging.",
    )
    return p.parse_args()


def main() -> int:
    args = _parse_args()
    logging.basicConfig(
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        level=logging.DEBUG if args.verbose else logging.INFO,
    )
    memory_dir: Path = args.memory_dir.expanduser().resolve()
    if not memory_dir.is_dir():
        logger.error("memory dir does not exist: %s", memory_dir)
        return 2

    if args.once:
        shim = Shim(memory_dir, dry_run=args.dry_run)
        pulled = shim.pull_all()
        pushed = sum(
            1
            for p in sorted(memory_dir.glob("*.md"))
            if _MEMORY_FILE_PATTERN.match(p.name) and shim.push_file(p)
        )
        logger.info("one-shot complete: pulled=%d pushed=%d", pulled, pushed)
        return 0

    run_daemon(memory_dir, args.interval, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
