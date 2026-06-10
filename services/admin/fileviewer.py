"""
Read-only file/folder viewers for docs/ and skills/. Surfaces the
markdown work to the live UI so users can SEE what's been documented.

Path-validated to prevent escape outside the configured root dirs.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

REPO_ROOT = Path(os.environ.get("AGENT_REPO_ROOT", "/repo")).resolve()


def _safe_path(root_subdir: str, requested: str) -> Path:
    """Resolve a user-supplied relative path against a root subdir,
    rejecting anything that escapes via .. or absolute paths."""
    base = (REPO_ROOT / root_subdir).resolve()
    if not base.exists():
        raise FileNotFoundError(f"base dir missing: {base}")
    full = (base / requested).resolve()
    # Must be inside base
    try:
        full.relative_to(base)
    except ValueError:
        raise PermissionError(f"path escapes base: {requested}")
    return full


def docs_tree() -> list[dict[str, Any]]:
    """Walk docs/, return a nested tree of markdown files with titles."""
    return _walk_tree(REPO_ROOT / "docs", suffixes={".md"})


def docs_file(rel_path: str) -> str:
    p = _safe_path("docs", rel_path)
    if not p.is_file():
        raise FileNotFoundError(f"not a file: {rel_path}")
    return p.read_text(encoding="utf-8", errors="replace")


def skills_tree() -> list[dict[str, Any]]:
    """List skills as cards: name + description from frontmatter."""
    base = REPO_ROOT / "skills"
    if not base.exists():
        return []
    out = []
    for sub in sorted(base.iterdir()):
        if not sub.is_dir() or sub.name.startswith("_") or sub.name.startswith("."):
            continue
        skill_md = sub / "SKILL.md"
        if not skill_md.exists():
            continue
        meta = _parse_frontmatter(skill_md.read_text(encoding="utf-8", errors="replace"))
        out.append(
            {
                "name": meta.get("name", sub.name),
                "description": meta.get("description", ""),
                "path": f"{sub.name}/SKILL.md",
            }
        )
    return out


def skills_file(rel_path: str) -> str:
    p = _safe_path("skills", rel_path)
    if not p.is_file():
        raise FileNotFoundError(f"not a file: {rel_path}")
    return p.read_text(encoding="utf-8", errors="replace")


# ---------- helpers ----------


def _walk_tree(base: Path, suffixes: set[str]) -> list[dict[str, Any]]:
    """Return a nested tree: each node is {type: 'dir'|'file', name, path, children?, title?}."""
    if not base.exists():
        return []
    nodes: list[dict[str, Any]] = []
    for p in sorted(base.iterdir()):
        if p.name.startswith(".") or p.name.startswith("_"):
            continue
        if p.is_dir():
            children = _walk_tree(p, suffixes)
            if children:
                nodes.append(
                    {
                        "type": "dir",
                        "name": p.name,
                        "path": str(p.relative_to(base.parent)).replace("\\", "/"),
                        "children": children,
                    }
                )
        elif p.is_file() and p.suffix in suffixes:
            title = _extract_title(p)
            nodes.append(
                {
                    "type": "file",
                    "name": p.name,
                    "path": str(p.relative_to(base.parent.parent)).replace("\\", "/"),
                    "title": title or p.stem.replace("-", " "),
                }
            )
    return nodes


def _extract_title(p: Path) -> str | None:
    """Pull the first H1 from a markdown file as its title."""
    try:
        for line in p.read_text(encoding="utf-8", errors="replace").splitlines()[:30]:
            line = line.strip()
            if line.startswith("# "):
                return line[2:].strip()
    except Exception:
        pass
    return None


def _parse_frontmatter(text: str) -> dict[str, str]:
    """Tiny YAML-like frontmatter parser — only handles `key: value` on single lines.
    Good enough for SKILL.md name + description fields."""
    if not text.startswith("---"):
        return {}
    lines = text.splitlines()
    out: dict[str, str] = {}
    in_block = False
    for line in lines[1:]:
        if line.strip() == "---":
            break
        in_block = True
        if ":" in line:
            k, _, v = line.partition(":")
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out if in_block else {}
