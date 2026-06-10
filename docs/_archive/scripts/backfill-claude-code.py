"""
Backfill Claude Code session transcripts into LanceDB semantic memory.

Reads the JSONL transcript Claude Code stores at
~/.claude/projects/<project>/<session-uuid>.jsonl, pairs each user message
with the assistant response that followed it, and posts each pair to the
running api's /memory/ingest endpoint. The api runs the same recorder
extraction Haiku call that fires after each live chat turn — so backfilled
records are indistinguishable from live ones.

Idempotency: each turn is recorded with source_thread_id = the session
UUID + the user's first 80 chars of message hash. If you run this twice
on the same transcript, you get duplicate records (the recorder doesn't
de-dupe). For now: don't run twice on the same file. Future: add a
"already-ingested?" check before posting.

Usage:
    # 1. The platform api must be running:
    cd platform/deploy && docker compose up -d

    # 2. Run for a specific project's transcripts (default: this repo's):
    python scripts/backfill-claude-code.py
    python scripts/backfill-claude-code.py --project c--Users-Liz-Make-Skills
    python scripts/backfill-claude-code.py --session ff5278db-f8ac-4174-bf90-ec021292f143
    python scripts/backfill-claude-code.py --limit 10
    python scripts/backfill-claude-code.py --dry-run
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path

import httpx

API_URL_DEFAULT = "http://localhost:8001"
CLAUDE_PROJECTS_DIR = Path.home() / ".claude" / "projects"
DEFAULT_PROJECT = "c--Users-Liz-Make-Skills"
CONCURRENCY = 4
PER_TURN_TIMEOUT = 60.0
USER_TURN_TRUNCATE = 4000   # don't blow context on huge user pastes
AGENT_TURN_TRUNCATE = 8000


def find_session_files(project: str, session: str | None) -> list[Path]:
    project_dir = CLAUDE_PROJECTS_DIR / project
    if not project_dir.exists():
        # Try the windows-style with backslashes / case mismatch
        for p in CLAUDE_PROJECTS_DIR.iterdir():
            if p.name.lower() == project.lower():
                project_dir = p
                break
    if not project_dir.exists():
        print(f"Project dir not found: {project_dir}", file=sys.stderr)
        return []
    if session:
        f = project_dir / f"{session}.jsonl"
        return [f] if f.exists() else []
    # Top-level session files only — skip subagents/
    return sorted(p for p in project_dir.glob("*.jsonl") if p.is_file())


def extract_text(content) -> str:
    """Pull text out of a Claude Code message.content list. Skips tool_use and
    tool_result blocks (they're noise to the recorder); keeps plain text."""
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and block.get("text"):
            parts.append(block["text"])
    return "\n\n".join(parts).strip()


def parse_turns(jsonl_path: Path) -> list[tuple[str, str]]:
    """Return list of (user_message, agent_response) pairs in order."""
    turns: list[tuple[str, str]] = []
    current_user: str | None = None
    current_agent: list[str] = []

    def flush() -> None:
        nonlocal current_user, current_agent
        if current_user and current_agent:
            agent_text = "\n\n".join(t for t in current_agent if t).strip()
            if agent_text:
                turns.append(
                    (current_user[:USER_TURN_TRUNCATE], agent_text[:AGENT_TURN_TRUNCATE])
                )
        current_user = None
        current_agent = []

    with jsonl_path.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            t = rec.get("type")
            if t == "user":
                # New user turn — flush previous turn first
                flush()
                msg = rec.get("message", {})
                current_user = extract_text(msg.get("content", ""))
            elif t == "assistant":
                msg = rec.get("message", {})
                txt = extract_text(msg.get("content", ""))
                if txt:
                    current_agent.append(txt)
            # ignore queue-operation, summary, tool-result, system, etc.

    flush()
    return turns


async def ingest_turn(
    client: httpx.AsyncClient,
    api_url: str,
    sem: asyncio.Semaphore,
    thread_id: str,
    idx: int,
    user_message: str,
    agent_response: str,
) -> dict:
    async with sem:
        try:
            r = await client.post(
                f"{api_url}/memory/ingest",
                json={
                    "user_message": user_message,
                    "agent_response": agent_response,
                    "source_thread_id": thread_id,
                },
                timeout=PER_TURN_TIMEOUT,
            )
            if r.status_code != 200:
                return {"idx": idx, "ok": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
            return {"idx": idx, "ok": True, **r.json()}
        except Exception as e:
            return {"idx": idx, "ok": False, "error": f"{type(e).__name__}: {e}"}


async def main_async(args: argparse.Namespace) -> int:
    files = find_session_files(args.project, args.session)
    if not files:
        print("No transcript files found.", file=sys.stderr)
        return 1

    all_turns: list[tuple[str, str, str, int]] = []  # (thread_id, user, agent, idx)
    for f in files:
        session_id = f.stem
        turns = parse_turns(f)
        print(f"[{session_id}] {len(turns)} turns parsed from {f.name}", file=sys.stderr)
        for i, (u, a) in enumerate(turns):
            all_turns.append((session_id, u, a, i))

    if args.limit:
        all_turns = all_turns[: args.limit]

    print(f"\nReady to ingest {len(all_turns)} turns into {args.api_url}", file=sys.stderr)

    if args.dry_run:
        for tid, u, a, i in all_turns[:5]:
            print(f"\n--- [{tid}] turn {i} ---")
            print(f"USER: {u[:200]}")
            print(f"AGENT: {a[:200]}")
        if len(all_turns) > 5:
            print(f"\n... + {len(all_turns) - 5} more turns")
        return 0

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient() as client:
        # Health check first
        try:
            h = await client.get(f"{args.api_url}/healthz", timeout=10)
            if h.status_code != 200:
                print(f"API not healthy at {args.api_url}: HTTP {h.status_code}", file=sys.stderr)
                return 1
        except Exception as e:
            print(f"API not reachable at {args.api_url}: {e}", file=sys.stderr)
            return 1

        tasks = [
            ingest_turn(client, args.api_url, sem, tid, i, u, a)
            for tid, u, a, i in all_turns
        ]
        ok = 0
        records_total = 0
        errors: list[str] = []
        for fut in asyncio.as_completed(tasks):
            res = await fut
            if res["ok"]:
                ok += 1
                records_total += res.get("ingested", 0)
            else:
                errors.append(f"  turn {res['idx']}: {res['error']}")
            if (ok + len(errors)) % 10 == 0:
                print(
                    f"  progress: {ok + len(errors)}/{len(tasks)} turns processed, {records_total} records inserted",
                    file=sys.stderr,
                )

    print(
        f"\nDone. {ok}/{len(tasks)} turns ingested, {records_total} records added to memory.",
        file=sys.stderr,
    )
    if errors:
        print(f"\n{len(errors)} errors:", file=sys.stderr)
        for e in errors[:20]:
            print(e, file=sys.stderr)
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more", file=sys.stderr)
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Backfill Claude Code transcripts → LanceDB memory")
    p.add_argument("--project", default=DEFAULT_PROJECT,
                   help=f"Claude Code project name (default: {DEFAULT_PROJECT})")
    p.add_argument("--session", default=None,
                   help="Specific session UUID (default: all sessions in project)")
    p.add_argument("--api-url", default=API_URL_DEFAULT,
                   help=f"Platform API URL (default: {API_URL_DEFAULT})")
    p.add_argument("--limit", type=int, default=None,
                   help="Cap number of turns ingested (for testing)")
    p.add_argument("--dry-run", action="store_true",
                   help="Print what would be ingested without sending")
    args = p.parse_args()
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
