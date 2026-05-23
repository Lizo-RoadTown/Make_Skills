#!/usr/bin/env python3
"""
Architecture diff — compares two snapshots, surfaces deltas, pulls git log.

Reads the two most-recent .json snapshots from docs/architecture-snapshots/
(or paths supplied via --prev / --current), computes structured diffs,
appends git log between their SHAs, and outputs a markdown report.

This is DEV-TOOLING. No LLM, no network. Same inputs → same output.

Output: docs/architecture-snapshots/<current-timestamp>-diff.md plus the
matching -diff.json that the architecture-analyst agent reads.

Usage:
    python scripts/architecture_diff.py
    python scripts/architecture_diff.py --prev <path> --current <path>
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _git_log(prev_sha: str, current_sha: str, paths: list[str]) -> list[dict]:
    """Return list of {sha, subject, files_touched} for commits between two SHAs
    that touched any of the given paths."""
    if not prev_sha or prev_sha == "unknown" or not current_sha or current_sha == "unknown":
        return []
    if prev_sha == current_sha:
        return []
    try:
        result = subprocess.run(
            ["git", "log", "--pretty=format:%H|||%s", f"{prev_sha}..{current_sha}", "--", *paths],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.SubprocessError, FileNotFoundError):
        return []
    out = []
    for line in result.stdout.splitlines():
        if "|||" not in line:
            continue
        sha, subject = line.split("|||", 1)
        # Files touched by this commit
        files_result = subprocess.run(
            ["git", "show", "--name-only", "--pretty=format:", sha],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
        )
        files = [f.strip() for f in files_result.stdout.splitlines() if f.strip()]
        out.append({"sha": sha[:8], "subject": subject, "files": files})
    return out


def diff_render(prev: dict, current: dict) -> list[str]:
    if not (prev.get("present") and current.get("present")):
        return []
    changes = []
    prev_svcs = {s["name"]: s for s in prev.get("services") or []}
    curr_svcs = {s["name"]: s for s in current.get("services") or []}
    for name in set(prev_svcs) | set(curr_svcs):
        if name not in prev_svcs:
            changes.append(f"NEW service: `{name}`")
        elif name not in curr_svcs:
            changes.append(f"REMOVED service: `{name}`")
        else:
            p, c = prev_svcs[name], curr_svcs[name]
            if p.get("plan") != c.get("plan"):
                changes.append(f"`{name}` plan changed: {p.get('plan')} → {c.get('plan')}")
            if p.get("env_var_keys") != c.get("env_var_keys"):
                added = set(c.get("env_var_keys") or []) - set(p.get("env_var_keys") or [])
                removed = set(p.get("env_var_keys") or []) - set(c.get("env_var_keys") or [])
                if added:
                    changes.append(f"`{name}` env vars added: " + ", ".join(f"`{k}`" for k in sorted(added)))
                if removed:
                    changes.append(f"`{name}` env vars removed: " + ", ".join(f"`{k}`" for k in sorted(removed)))
            if (p.get("disk") or {}) != (c.get("disk") or {}):
                changes.append(f"`{name}` disk changed: {p.get('disk')} → {c.get('disk')}")
    prev_dbs = {d["name"]: d for d in prev.get("databases") or []}
    curr_dbs = {d["name"]: d for d in current.get("databases") or []}
    for name in set(prev_dbs) | set(curr_dbs):
        if name not in prev_dbs:
            changes.append(f"NEW database: `{name}`")
        elif name not in curr_dbs:
            changes.append(f"REMOVED database: `{name}`")
    return changes


def diff_web(prev: dict, current: dict) -> list[str]:
    if not (prev.get("present") and current.get("present")):
        return []
    changes = []
    prev_deps = prev.get("key_dependencies") or {}
    curr_deps = current.get("key_dependencies") or {}
    for k in set(prev_deps) | set(curr_deps):
        if k not in prev_deps:
            changes.append(f"NEW key dep: `{k}` = `{curr_deps[k]}`")
        elif k not in curr_deps:
            changes.append(f"REMOVED key dep: `{k}` (was `{prev_deps[k]}`)")
        elif prev_deps[k] != curr_deps[k]:
            changes.append(f"`{k}` bumped: `{prev_deps[k]}` → `{curr_deps[k]}`")
    if prev.get("total_dependency_count") != current.get("total_dependency_count"):
        changes.append(
            f"Total dependency count: {prev.get('total_dependency_count')} → {current.get('total_dependency_count')}"
        )
    return changes


def diff_platform(prev: dict, current: dict) -> list[str]:
    if not (prev.get("present") and current.get("present")):
        return []
    changes = []
    prev_pkgs = {p["name"]: p["constraint"] for p in prev.get("packages") or []}
    curr_pkgs = {p["name"]: p["constraint"] for p in current.get("packages") or []}
    for name in set(prev_pkgs) | set(curr_pkgs):
        if name not in prev_pkgs:
            changes.append(f"NEW Python package: `{name}` `{curr_pkgs[name]}`")
        elif name not in curr_pkgs:
            changes.append(f"REMOVED Python package: `{name}` (was `{prev_pkgs[name]}`)")
        elif prev_pkgs[name] != curr_pkgs[name]:
            changes.append(f"`{name}` constraint: `{prev_pkgs[name]}` → `{curr_pkgs[name]}`")
    return changes


def diff_mcp(prev: dict, current: dict) -> list[str]:
    if not (prev.get("present") and current.get("present")):
        return []
    changes = []
    prev_servers = {s["name"]: s for s in prev.get("servers") or []}
    curr_servers = {s["name"]: s for s in current.get("servers") or []}
    for name in set(prev_servers) | set(curr_servers):
        if name not in prev_servers:
            changes.append(f"NEW MCP server: `{name}`")
        elif name not in curr_servers:
            changes.append(f"REMOVED MCP server: `{name}`")
    return changes


def diff_auth(prev: dict, current: dict) -> list[str]:
    if not (prev.get("present") and current.get("present")):
        return []
    changes = []
    if prev.get("uses_drizzle") != current.get("uses_drizzle"):
        changes.append(f"DrizzleAdapter usage changed: {prev.get('uses_drizzle')} → {current.get('uses_drizzle')}")
    if prev.get("uses_supabase") != current.get("uses_supabase"):
        changes.append(f"Supabase auth usage changed: {prev.get('uses_supabase')} → {current.get('uses_supabase')}")
    if prev.get("uses_prisma") != current.get("uses_prisma"):
        changes.append(f"Prisma adapter usage changed: {prev.get('uses_prisma')} → {current.get('uses_prisma')}")
    if set(prev.get("providers") or []) != set(current.get("providers") or []):
        added = set(current.get("providers") or []) - set(prev.get("providers") or [])
        removed = set(prev.get("providers") or []) - set(current.get("providers") or [])
        if added:
            changes.append(f"auth providers added: " + ", ".join(f"`{p}`" for p in sorted(added)))
        if removed:
            changes.append(f"auth providers removed: " + ", ".join(f"`{p}`" for p in sorted(removed)))
    return changes


def find_two_latest(snapshot_dir: Path) -> tuple[Path | None, Path | None]:
    files = sorted(snapshot_dir.glob("*-snapshot.json"))
    if len(files) >= 2:
        return files[-2], files[-1]
    if len(files) == 1:
        return None, files[-1]
    return None, None


def render_markdown(diff: dict) -> str:
    lines = [f"# Architecture diff — {diff['current_timestamp']}", ""]
    if diff.get("prev_timestamp"):
        lines.append(f"**Comparing:** `{diff['prev_timestamp']}` → `{diff['current_timestamp']}`  ")
    else:
        lines.append(f"**First snapshot — no prior to compare against.**  ")
        lines.append("")
        return "\n".join(lines)

    lines.append(f"**Git range:** `{diff['prev_sha']}..{diff['current_sha']}`  ")
    lines.append("")

    sections = [
        ("Render (backend hosting)", diff["changes"]["render"]),
        ("Web (Next.js frontend)", diff["changes"]["web"]),
        ("Platform API (Python packages)", diff["changes"]["platform"]),
        ("MCP servers", diff["changes"]["mcp"]),
        ("Auth wiring", diff["changes"]["auth"]),
    ]
    any_changes = False
    for title, changes in sections:
        if changes:
            any_changes = True
            lines.append(f"## {title}")
            lines.append("")
            for c in changes:
                lines.append(f"- {c}")
            lines.append("")

    if not any_changes:
        lines.append("**No structural changes detected between snapshots.**")
        lines.append("")

    commits = diff.get("commits") or []
    if commits:
        lines.append(f"## Commits in range ({len(commits)})")
        lines.append("")
        for c in commits:
            lines.append(f"- `{c['sha']}` — {c['subject']}")
            if c["files"]:
                shown = ", ".join(f"`{f}`" for f in c["files"][:5])
                more = f" (+{len(c['files'])-5} more)" if len(c["files"]) > 5 else ""
                lines.append(f"  - files: {shown}{more}")
        lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Diff two architecture snapshots.")
    parser.add_argument("--snapshot-dir", default="docs/architecture-snapshots", type=Path)
    parser.add_argument("--prev", type=Path, help="Path to previous snapshot.json")
    parser.add_argument("--current", type=Path, help="Path to current snapshot.json")
    args = parser.parse_args()

    snapshot_dir = (REPO_ROOT / args.snapshot_dir).resolve()
    snapshot_dir.mkdir(parents=True, exist_ok=True)

    if args.prev or args.current:
        prev_path = args.prev
        curr_path = args.current
    else:
        prev_path, curr_path = find_two_latest(snapshot_dir)

    if not curr_path:
        print("no snapshots found in", snapshot_dir, file=sys.stderr)
        return 2

    current = json.loads(curr_path.read_text(encoding="utf-8"))
    prev = json.loads(prev_path.read_text(encoding="utf-8")) if prev_path else {}

    current_ts = current.get("timestamp", "unknown")
    prev_ts = prev.get("timestamp") if prev else None
    current_sha = current.get("git_sha", "unknown")
    prev_sha = prev.get("git_sha") if prev else None

    changes = {
        "render": diff_render(prev.get("render", {}), current.get("render", {})) if prev else [],
        "web": diff_web(prev.get("web", {}), current.get("web", {})) if prev else [],
        "platform": diff_platform(prev.get("platform", {}), current.get("platform", {})) if prev else [],
        "mcp": diff_mcp(prev.get("mcp", {}), current.get("mcp", {})) if prev else [],
        "auth": diff_auth(prev.get("auth", {}), current.get("auth", {})) if prev else [],
    }

    commits = _git_log(
        prev_sha,
        current_sha,
        ["render.yaml", "web/", "platform/", ".mcp.json"],
    ) if prev_sha else []

    diff = {
        "current_timestamp": current_ts,
        "prev_timestamp": prev_ts,
        "current_sha": current_sha,
        "prev_sha": prev_sha,
        "changes": changes,
        "commits": commits,
    }

    base_name = curr_path.stem.replace("-snapshot", "-diff")
    json_path = snapshot_dir / f"{base_name}.json"
    md_path = snapshot_dir / f"{base_name}.md"

    json_path.write_text(json.dumps(diff, indent=2) + "\n", encoding="utf-8")
    md_path.write_text(render_markdown(diff), encoding="utf-8")
    print(f"wrote {json_path.relative_to(REPO_ROOT)}")
    print(f"wrote {md_path.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
