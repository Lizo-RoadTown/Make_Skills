#!/usr/bin/env python3
"""
Architecture snapshot — deterministic extractor.

Reads source files (render.yaml, web/package.json, platform/requirements.txt,
.mcp.json, web/auth.ts) and produces TWO artifacts:

  1. <timestamp>-snapshot.json — machine-readable structured state for diff
  2. <timestamp>-snapshot.md   — human-readable with a Mermaid diagram

This is DEV-TOOLING (scripts/, NOT runtime). Pure static parsing — no LLM, no
network calls, no token cost. Deterministic: same inputs always produce same
outputs. Used as the foundation layer for the architecture-snapshot system
(see docs/proposals/architecture-snapshot-system.md for the full design).

Usage:
    python scripts/architecture_snapshot.py
    python scripts/architecture_snapshot.py --output-dir docs/architecture-snapshots
    python scripts/architecture_snapshot.py --json-only   # skip the .md
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    print("missing dependency: PyYAML. install via 'pip install PyYAML'", file=sys.stderr)
    sys.exit(1)

REPO_ROOT = Path(__file__).resolve().parent.parent


def _read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def _git_sha() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (subprocess.SubprocessError, FileNotFoundError):
        return "unknown"


def parse_render_yaml() -> dict:
    """Extract services, env vars (keys only — never values), disks, databases."""
    path = REPO_ROOT / "render.yaml"
    raw = _read_text(path)
    if raw is None:
        return {"present": False}
    try:
        data = yaml.safe_load(raw) or {}
    except yaml.YAMLError as e:
        return {"present": True, "parse_error": str(e)}

    services = []
    for svc in data.get("services") or []:
        env_keys = sorted([e.get("key") for e in svc.get("envVars") or [] if e.get("key")])
        disk = svc.get("disk") or {}
        services.append({
            "name": svc.get("name"),
            "type": svc.get("type"),
            "runtime": svc.get("runtime"),
            "plan": svc.get("plan"),
            "region": svc.get("region"),
            "auto_deploy": svc.get("autoDeploy"),
            "previews": (svc.get("previews") or {}).get("generation"),
            "health_check": svc.get("healthCheckPath"),
            "env_var_keys": env_keys,
            "disk": {
                "name": disk.get("name"),
                "mount_path": disk.get("mountPath"),
                "size_gb": disk.get("sizeGB"),
            } if disk else None,
        })

    databases = []
    for db in data.get("databases") or []:
        databases.append({
            "name": db.get("name"),
            "plan": db.get("plan"),
            "database_name": db.get("databaseName"),
            "region": db.get("region"),
        })

    return {"present": True, "services": services, "databases": databases}


def parse_web_package_json() -> dict:
    """Extract framework + auth + key deps + scripts."""
    path = REPO_ROOT / "web" / "package.json"
    raw = _read_text(path)
    if raw is None:
        return {"present": False}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        return {"present": True, "parse_error": str(e)}

    deps = data.get("dependencies") or {}
    interesting_keys = [
        # Framework
        "next", "react", "react-dom",
        # Auth
        "next-auth", "@auth/drizzle-adapter", "@auth/prisma-adapter", "@supabase/supabase-js",
        # DB / ORM
        "drizzle-orm", "pg", "@prisma/client",
        # UI
        "tailwindcss", "@tailwindcss/postcss",
        # State / motion
        "xstate", "@xstate/react", "motion",
        # Docs
        "fumadocs-core", "fumadocs-ui",
    ]
    pinned = {k: v for k, v in deps.items() if k in interesting_keys}
    return {
        "present": True,
        "name": data.get("name"),
        "version": data.get("version"),
        "scripts": list((data.get("scripts") or {}).keys()),
        "key_dependencies": pinned,
        "total_dependency_count": len(deps),
    }


def parse_platform_requirements() -> dict:
    """Extract pinned backend packages."""
    path = REPO_ROOT / "platform" / "requirements.txt"
    raw = _read_text(path)
    if raw is None:
        return {"present": False}
    packages = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r"([a-zA-Z0-9_.\-\[\]]+)\s*([><=!~]+\s*[\d.]+.*)?", line)
        if m:
            packages.append({"name": m.group(1).lower(), "constraint": (m.group(2) or "").strip()})
    return {"present": True, "package_count": len(packages), "packages": packages}


def parse_mcp_config() -> dict:
    """Extract MCP servers and their command/url shapes."""
    path = REPO_ROOT / ".mcp.json"
    raw = _read_text(path)
    if raw is None:
        return {"present": False}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        return {"present": True, "parse_error": str(e)}

    servers = []
    for name, cfg in (data.get("mcpServers") or {}).items():
        servers.append({
            "name": name,
            "shape": "command" if cfg.get("command") else ("url" if cfg.get("url") else "unknown"),
            "command": cfg.get("command"),
            "args_count": len(cfg.get("args") or []),
            "url": cfg.get("url"),
        })
    return {"present": True, "servers": servers}


def parse_auth_setup() -> dict:
    """Grep web/auth.ts for adapter + providers — actual auth wiring."""
    path = REPO_ROOT / "web" / "auth.ts"
    raw = _read_text(path)
    if raw is None:
        return {"present": False}

    adapters = re.findall(r"from\s+[\"']@auth/([a-zA-Z\-]+)-adapter[\"']", raw)
    providers = re.findall(r"import\s+(\w+)\s+from\s+[\"']next-auth/providers/(\w+)[\"']", raw)
    db_imports = re.findall(r"from\s+[\"']([^\"']*db[^\"']*)[\"']", raw)
    uses_drizzle = "DrizzleAdapter" in raw
    uses_supabase = "@supabase" in raw or "createServerClient" in raw
    uses_prisma = "PrismaAdapter" in raw

    return {
        "present": True,
        "adapters": adapters,
        "providers": [p[1] for p in providers],
        "uses_drizzle": uses_drizzle,
        "uses_supabase": uses_supabase,
        "uses_prisma": uses_prisma,
        "db_imports": db_imports,
    }


def render_mermaid(snapshot: dict) -> str:
    """Build a Mermaid diagram from the snapshot dict."""
    render_block = snapshot.get("render") or {}
    web_block = snapshot.get("web") or {}
    auth_block = snapshot.get("auth") or {}
    mcp_block = snapshot.get("mcp") or {}

    lines = ["```mermaid", "graph TB", "    Browser[\"User browser\"]", ""]

    # Frontend (Vercel)
    if web_block.get("present"):
        frontend_label = "web/<br/>"
        deps = web_block.get("key_dependencies") or {}
        if deps.get("next"):
            frontend_label += f"Next.js {deps['next']} · React {deps.get('react','?')}"
        if auth_block.get("uses_drizzle"):
            frontend_label += "<br/>Auth.js + DrizzleAdapter"
        elif auth_block.get("uses_supabase"):
            frontend_label += "<br/>Supabase Auth"
        lines.append(f"    subgraph Vercel[\"Vercel — humancensys.com\"]")
        lines.append(f"        Web[\"{frontend_label}\"]")
        lines.append(f"    end")
        lines.append("")

    # Backend (Render)
    if render_block.get("present"):
        services = render_block.get("services") or []
        databases = render_block.get("databases") or []
        if services or databases:
            lines.append(f"    subgraph Render[\"Render\"]")
            for svc in services:
                label = f"{svc.get('name','?')}<br/>{svc.get('runtime','?')} · plan: {svc.get('plan','?')}"
                if svc.get("disk"):
                    disk = svc["disk"]
                    label += f"<br/>disk: {disk.get('mount_path')} ({disk.get('size_gb')}GB)"
                key = svc.get("name", "svc").replace("-", "_")
                lines.append(f"        {key}[\"{label}\"]")
            for db in databases:
                label = f"{db.get('name','?')}<br/>Postgres · {db.get('plan','?')}"
                key = "db_" + db.get("name", "db").replace("-", "_")
                lines.append(f"        {key}[({label})]")
            lines.append(f"    end")
            lines.append("")
            # Wire frontend -> backend if both exist
            if web_block.get("present") and services:
                lines.append(f"    Browser -->|HTTPS| Web")
                first_svc_key = services[0].get("name", "svc").replace("-", "_")
                lines.append(f"    Web -->|HTTPS + JWT| {first_svc_key}")
                for db in databases:
                    db_key = "db_" + db.get("name", "db").replace("-", "_")
                    lines.append(f"    {first_svc_key} --> {db_key}")

    # MCP layer (dev-tooling, separate subgraph)
    servers = mcp_block.get("servers") or []
    if servers:
        lines.append("")
        lines.append(f"    subgraph DevTooling[\"Dev tooling · MCP servers\"]")
        for s in servers:
            shape = s.get("shape", "?")
            cmd = s.get("command") or s.get("url") or "?"
            label = f"{s.get('name')}<br/>{shape}: {cmd[:40]}"
            key = "mcp_" + (s.get("name") or "x").replace("-", "_").replace(".", "_")
            lines.append(f"        {key}[\"{label}\"]")
        lines.append(f"    end")

    lines.append("```")
    return "\n".join(lines)


def render_markdown(snapshot: dict) -> str:
    """Build the human-readable snapshot.md."""
    ts = snapshot["timestamp"]
    sha = snapshot["git_sha"]

    out = [f"# Architecture snapshot — {ts}", ""]
    out.append(f"**Git SHA:** `{sha}`  ")
    out.append(f"**Generated by:** `scripts/architecture_snapshot.py`  ")
    out.append("")
    out.append("This snapshot is deterministic and machine-generated. For prose narrative")
    out.append("and diagnosis, see the matching `-narrative.md` (produced by the")
    out.append("architecture-analyst agent).")
    out.append("")

    out.append("## Diagram")
    out.append("")
    out.append(render_mermaid(snapshot))
    out.append("")

    # Render
    render_block = snapshot.get("render") or {}
    if render_block.get("present"):
        out.append("## Render (backend hosting)")
        out.append("")
        for svc in render_block.get("services") or []:
            out.append(f"### Service: `{svc.get('name')}`")
            out.append(f"- Runtime: {svc.get('runtime')}, plan: {svc.get('plan')}, region: {svc.get('region')}")
            if svc.get("disk"):
                d = svc["disk"]
                out.append(f"- Persistent disk: `{d.get('mount_path')}` ({d.get('size_gb')} GB, name `{d.get('name')}`)")
            out.append(f"- Auto-deploy: {svc.get('auto_deploy')}, previews: {svc.get('previews')}, health check: `{svc.get('health_check')}`")
            out.append(f"- Env var keys ({len(svc.get('env_var_keys') or [])}): " + ", ".join(f"`{k}`" for k in svc.get("env_var_keys") or []))
            out.append("")
        for db in render_block.get("databases") or []:
            out.append(f"### Database: `{db.get('name')}`")
            out.append(f"- Plan: {db.get('plan')}, database name: `{db.get('database_name')}`, region: {db.get('region')}")
            out.append("")

    # Web
    web_block = snapshot.get("web") or {}
    if web_block.get("present"):
        out.append("## Web (Next.js frontend)")
        out.append("")
        out.append(f"- Package: `{web_block.get('name')}` v{web_block.get('version')}")
        out.append(f"- Scripts: " + ", ".join(f"`{s}`" for s in web_block.get("scripts") or []))
        out.append(f"- Total dependencies: {web_block.get('total_dependency_count')}")
        out.append(f"- Key pinned versions:")
        for k, v in (web_block.get("key_dependencies") or {}).items():
            out.append(f"  - `{k}`: `{v}`")
        out.append("")

    # Platform
    plat_block = snapshot.get("platform") or {}
    if plat_block.get("present"):
        out.append("## Platform API (FastAPI backend)")
        out.append("")
        out.append(f"- Total packages in `requirements.txt`: {plat_block.get('package_count')}")
        names = [p["name"] for p in plat_block.get("packages") or []]
        # show a few highlights only
        highlights = [n for n in names if n in (
            "fastapi", "uvicorn", "deepagents", "langchain", "langgraph", "psycopg",
            "lancedb", "fastembed", "mcp", "watchdog", "pyyaml", "pyarrow",
            "python-jose", "pytest",
        )]
        out.append(f"- Highlights: " + ", ".join(f"`{n}`" for n in highlights))
        out.append("")

    # Auth
    auth_block = snapshot.get("auth") or {}
    if auth_block.get("present"):
        out.append("## Auth wiring (`web/auth.ts`)")
        out.append("")
        if auth_block.get("uses_drizzle"):
            out.append("- **Adapter:** Drizzle (`@auth/drizzle-adapter`)")
        if auth_block.get("uses_supabase"):
            out.append("- **Adapter:** Supabase")
        if auth_block.get("uses_prisma"):
            out.append("- **Adapter:** Prisma")
        if auth_block.get("providers"):
            out.append(f"- **Providers:** " + ", ".join(f"`{p}`" for p in auth_block["providers"]))
        if auth_block.get("db_imports"):
            out.append(f"- **DB imports:** " + ", ".join(f"`{p}`" for p in auth_block["db_imports"]))
        out.append("")

    # MCP
    mcp_block = snapshot.get("mcp") or {}
    if mcp_block.get("present"):
        out.append("## MCP servers (`.mcp.json`)")
        out.append("")
        for s in mcp_block.get("servers") or []:
            label = s.get("name")
            if s.get("shape") == "command":
                out.append(f"- `{label}` — command: `{s.get('command')}` (args: {s.get('args_count')})")
            elif s.get("shape") == "url":
                out.append(f"- `{label}` — url: `{s.get('url')}`")
            else:
                out.append(f"- `{label}` — shape: {s.get('shape')}")
        out.append("")

    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate an architecture snapshot.")
    parser.add_argument("--output-dir", default="docs/architecture-snapshots", type=Path)
    parser.add_argument("--json-only", action="store_true", help="Skip the .md output.")
    args = parser.parse_args()

    out_dir = (REPO_ROOT / args.output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    timestamp = now.strftime("%Y-%m-%d-%H%M")

    snapshot = {
        "timestamp": now.isoformat(),
        "git_sha": _git_sha(),
        "render": parse_render_yaml(),
        "web": parse_web_package_json(),
        "platform": parse_platform_requirements(),
        "mcp": parse_mcp_config(),
        "auth": parse_auth_setup(),
    }

    json_path = out_dir / f"{timestamp}-snapshot.json"
    json_path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {json_path.relative_to(REPO_ROOT)}")

    if not args.json_only:
        md_path = out_dir / f"{timestamp}-snapshot.md"
        md_path.write_text(render_markdown(snapshot), encoding="utf-8")
        print(f"wrote {md_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
