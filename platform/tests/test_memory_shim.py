"""
Smoke tests for the memory sync shim (Phase 2).

The shim has three responsibilities tested here:

1. Frontmatter parsing — typed memory files round-trip cleanly.
2. Disk → LanceDB push — file edits propagate to the store.
3. LanceDB → disk pull — store changes hydrate the file directory.

Watchdog-driven filesystem events are NOT tested here; we exercise the
shim's methods directly. Filesystem-event plumbing is library code
(watchdog itself) — the value in testing it is low compared to the cost.

Run inside the api container:

    docker compose -f platform/deploy/docker-compose.yml exec api \\
        python -m pytest platform/tests/test_memory_shim.py -v
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest

# Make scripts/ importable.
_REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_REPO_ROOT / "scripts"))

from api.memory import lance, mcp_server
import memory_shim  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _unique_name(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _hard_delete(name: str) -> None:
    table, _ = lance.get_table()
    rid = lance._sql_escape(name)
    table.delete(f"id = '{rid}' AND tenant_id = '{mcp_server.DEFAULT_TENANT}'")


# ---------------------------------------------------------------------------
# Frontmatter
# ---------------------------------------------------------------------------


def test_parse_well_formed_file(tmp_path: Path):
    path = tmp_path / "feedback_test.md"
    path.write_text(
        "---\n"
        "name: feedback-test\n"
        "description: A test memory.\n"
        "metadata:\n"
        "  type: feedback\n"
        "why: because tests need bodies\n"
        "---\n"
        "Body content goes here.\n",
        encoding="utf-8",
    )
    parsed = memory_shim.parse_memory_file(path)
    assert parsed is not None
    assert parsed.name == "feedback-test"
    assert parsed.record_type == "feedback"
    assert parsed.description == "A test memory."
    assert parsed.why == "because tests need bodies"
    assert "Body content goes here." in parsed.content


def test_parse_missing_frontmatter_infers_from_filename(tmp_path: Path):
    """Files with no frontmatter still parse — type inferred from filename prefix."""
    path = tmp_path / "user_no_frontmatter.md"
    path.write_text("Just a body, no fm.\n", encoding="utf-8")
    parsed = memory_shim.parse_memory_file(path)
    assert parsed is not None
    assert parsed.record_type == "user"
    assert parsed.name == "user_no_frontmatter"
    assert "Just a body" in parsed.content


def test_parse_unknown_type_defaults_to_project(tmp_path: Path):
    path = tmp_path / "feedback_weird.md"
    path.write_text(
        "---\n"
        "name: weird\n"
        "metadata:\n"
        "  type: nonexistent-type\n"
        "---\n"
        "body\n",
        encoding="utf-8",
    )
    parsed = memory_shim.parse_memory_file(path)
    assert parsed is not None
    assert parsed.record_type == "project"


def test_serialize_round_trips(tmp_path: Path):
    """parse → serialize → parse yields the same fields."""
    original = memory_shim.ParsedMemory(
        name="rt-test",
        record_type="project",
        content="Body line 1.\nBody line 2.",
        description="Round-trip test.",
        why="for serialization verification",
    )
    serialized = memory_shim.serialize_memory(original)
    path = tmp_path / "project_rt_test.md"
    path.write_text(serialized, encoding="utf-8")
    reparsed = memory_shim.parse_memory_file(path)
    assert reparsed is not None
    assert reparsed.name == original.name
    assert reparsed.record_type == original.record_type
    assert reparsed.description == original.description
    assert reparsed.why == original.why
    assert reparsed.content.strip() == original.content.strip()


# ---------------------------------------------------------------------------
# Disk → LanceDB push
# ---------------------------------------------------------------------------


def test_push_file_inserts_row(tmp_path: Path):
    name = _unique_name("project_push")
    path = tmp_path / f"{name}.md"
    path.write_text(
        f"---\nname: {name}\ndescription: pushed by test\nmetadata:\n  type: project\n---\nBody.\n",
        encoding="utf-8",
    )
    try:
        shim = memory_shim.Shim(tmp_path)
        assert shim.push_file(path) is True
        row = mcp_server._fetch_one(name)
        assert row is not None
        assert row["type"] == "project"
        assert "Body." in row["content"]
    finally:
        _hard_delete(name)


def test_push_file_with_invalid_filename_skipped(tmp_path: Path):
    """Files that don't match the typed-name pattern are ignored."""
    path = tmp_path / "random.md"
    path.write_text("---\nname: r\n---\nbody\n", encoding="utf-8")
    shim = memory_shim.Shim(tmp_path)
    assert shim.push_file(path) is False


def test_push_then_delete_soft_deletes(tmp_path: Path):
    name = _unique_name("project_delete")
    path = tmp_path / f"{name}.md"
    path.write_text(
        f"---\nname: {name}\nmetadata:\n  type: project\n---\nbody\n",
        encoding="utf-8",
    )
    try:
        shim = memory_shim.Shim(tmp_path)
        shim.push_file(path)
        path.unlink()
        assert shim.delete_on_disk_path(path) is True
        # Row exists but is soft-deleted; memory_read excludes it.
        assert mcp_server._fetch_one(name) is None
        with_deleted = mcp_server._fetch_one(name, include_deleted=True)
        assert with_deleted is not None
        assert with_deleted["visibility"] == mcp_server.VISIBILITY_DELETED
    finally:
        _hard_delete(name)


def test_dry_run_does_not_write(tmp_path: Path):
    name = _unique_name("project_dryrun")
    path = tmp_path / f"{name}.md"
    path.write_text(
        f"---\nname: {name}\nmetadata:\n  type: project\n---\nbody\n",
        encoding="utf-8",
    )
    shim = memory_shim.Shim(tmp_path, dry_run=True)
    shim.push_file(path)
    assert mcp_server._fetch_one(name) is None  # not in the store


# ---------------------------------------------------------------------------
# LanceDB → disk pull
# ---------------------------------------------------------------------------


def test_pull_creates_missing_files(tmp_path: Path):
    """A row in LanceDB with no disk file should be written to disk on pull."""
    name = _unique_name("project_pull")
    # Insert directly via the lance module (simulating a write from another machine).
    try:
        import time
        record = {
            "id": name,
            "type": "project",
            "content": "Description line.\n\nBody content.",
            "project_tags": [],
            "source_thread_id": "",
            "ts": time.time(),
            "why": "",
        }
        lance.insert_records([record], tenant_id=mcp_server.DEFAULT_TENANT, visibility="private")

        shim = memory_shim.Shim(tmp_path)
        written = shim.pull_all()
        assert written >= 1

        target = tmp_path / f"{name}.md"
        assert target.exists()
        body = target.read_text(encoding="utf-8")
        assert "Body content." in body
        assert "type: project" in body
    finally:
        _hard_delete(name)


def test_pull_skips_when_disk_is_newer(tmp_path: Path):
    """If the file on disk is newer than the LanceDB row, the file wins."""
    import os
    import time

    name = _unique_name("project_diskwins")
    try:
        # Old row in LanceDB.
        record = {
            "id": name,
            "type": "project",
            "content": "old content",
            "project_tags": [],
            "source_thread_id": "",
            "ts": time.time() - 3600,  # one hour ago
            "why": "",
        }
        lance.insert_records([record], tenant_id=mcp_server.DEFAULT_TENANT, visibility="private")

        # Newer file on disk.
        target = tmp_path / f"{name}.md"
        target.write_text(
            f"---\nname: {name}\nmetadata:\n  type: project\n---\nnew content\n",
            encoding="utf-8",
        )
        now = time.time()
        os.utime(target, (now, now))

        shim = memory_shim.Shim(tmp_path)
        shim.pull_all()

        body = target.read_text(encoding="utf-8")
        assert "new content" in body
        assert "old content" not in body
    finally:
        _hard_delete(name)


def test_pull_skips_deleted_rows(tmp_path: Path):
    """Soft-deleted rows should not be written to disk during pull."""
    import time

    name = _unique_name("project_pulldel")
    try:
        record = {
            "id": name,
            "type": "project",
            "content": "should not appear",
            "project_tags": [],
            "source_thread_id": "",
            "ts": time.time(),
            "why": "",
        }
        lance.insert_records(
            [record], tenant_id=mcp_server.DEFAULT_TENANT, visibility=mcp_server.VISIBILITY_DELETED
        )

        shim = memory_shim.Shim(tmp_path)
        shim.pull_all()

        assert not (tmp_path / f"{name}.md").exists()
    finally:
        _hard_delete(name)
