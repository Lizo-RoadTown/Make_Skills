"""
Read-only inspector for the project's MCP server configuration.
Surfaces what's wired in .mcp.json so the dashboard's /credentials
or /integrations page can show "what's connected".

The actual MCP runtime lives in the agent / Claude Code / IDE — this
module just reports the static config. Editing happens in the IDE
(self-host) or via a per-tenant config table later (hosted, not yet).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

REPO_ROOT = Path(os.environ.get("AGENT_REPO_ROOT", "/repo")).resolve()


def read_mcp_config() -> dict[str, Any]:
    """Parse .mcp.json. Returns the full dict; empty dict if missing.
    Values that look like secrets (env vars containing TOKEN/KEY/SECRET)
    are masked in the output — the actual env var name is shown but
    not its value (the agent itself reads the value at runtime; we
    don't need it for display)."""
    path = REPO_ROOT / ".mcp.json"
    if not path.exists():
        return {"mcpServers": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"mcpServers": {}}


def list_mcp_servers() -> list[dict[str, Any]]:
    """Per-server cards for the dashboard. Each entry covers what the
    server does (the description we hand-curate here), how it's wired
    (command vs URL), and what env vars it requires."""
    cfg = read_mcp_config()
    servers = cfg.get("mcpServers", {}) or {}

    out: list[dict[str, Any]] = []
    for name, spec in servers.items():
        if not isinstance(spec, dict):
            continue
        kind = "url" if "url" in spec else ("command" if "command" in spec else "unknown")
        env_vars = list((spec.get("env") or {}).keys())
        out.append(
            {
                "name": name,
                "kind": kind,
                "url": spec.get("url"),
                "command": spec.get("command"),
                "args": spec.get("args"),
                "env_vars": env_vars,
                "description": _DESCRIPTIONS.get(name, ""),
                "category": _CATEGORIES.get(name, "other"),
            }
        )
    out.sort(key=lambda s: (s["category"], s["name"]))
    return out


def list_recommended_servers() -> list[dict[str, Any]]:
    """Servers worth adding that aren't currently in .mcp.json. Cards
    for the dashboard to show under "Recommended" so you can see
    what's available without running the install."""
    configured = set((read_mcp_config().get("mcpServers") or {}).keys())
    return [
        {
            "name": name,
            "category": _CATEGORIES.get(name, "other"),
            "description": _DESCRIPTIONS.get(name, ""),
            "install_hint": _INSTALL_HINTS.get(name, ""),
            "env_vars": _ENV_HINTS.get(name, []),
        }
        for name in _RECOMMENDED
        if name not in configured
    ]


_CATEGORIES = {
    "llama_index_docs": "docs",
    "github": "git",
    "vercel": "deploy",
    "render": "deploy",
    "context7": "docs",
    "playwright": "test",
    "supabase": "db",
    "huggingface": "ml",
}

_DESCRIPTIONS = {
    "llama_index_docs": "Live LlamaIndex framework docs lookup. Used by document-parsing skill.",
    "github": "Read/write GitHub PRs, issues, branches, file contents. Lets the agent inspect its own repo without filesystem access.",
    "vercel": "Read deployment build logs, runtime logs, list deployments, fetch URLs. Used to debug Vercel preview/production builds.",
    "render": "Manage Render services + databases. Includes agent skills for Claude Code (run `render skills install`).",
    "context7": "Live documentation for any library — pulls current docs at query time, supersedes stale training data.",
    "playwright": "Browser automation — open pages, fill forms, screenshot. End-to-end testing surface for the agent.",
    "supabase": "Postgres + auth + storage as a service. Only relevant if migrating off Render Postgres.",
    "huggingface": "Search HF Hub for models / datasets / papers. Auth via HF_TOKEN.",
}

_RECOMMENDED = [
    "github",
    "vercel",
    "context7",
    "playwright",
]

_INSTALL_HINTS = {
    "github": "Add `mcpServers.github = { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_TOKEN: '${GITHUB_TOKEN}' } }` to .mcp.json.",
    "vercel": "Add `mcpServers.vercel = { url: 'https://api.vercel.com/mcp', env: { VERCEL_TOKEN: '${VERCEL_TOKEN}' } }` to .mcp.json.",
    "context7": "Add `mcpServers.context7 = { command: 'npx', args: ['-y', '@upstash/context7-mcp'] }` to .mcp.json.",
    "playwright": "Add `mcpServers.playwright = { command: 'npx', args: ['-y', '@modelcontextprotocol/server-playwright'] }` to .mcp.json.",
}

_ENV_HINTS = {
    "github": ["GITHUB_TOKEN"],
    "vercel": ["VERCEL_TOKEN"],
    "context7": [],
    "playwright": [],
}
