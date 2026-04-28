"""
Build the deepagents agent from the repo's deepagents.toml.

This module is the single integration point with the deepagents library —
keeping it isolated means we can adapt to API changes in deepagents without
touching the FastAPI service code.

EXPECT TO ITERATE: deepagents is moving fast and the exact signature of
create_deep_agent + the PostgresSaver wiring may need adjustment when this
first runs. Verify against the version pinned in platform/requirements.txt.
"""
from __future__ import annotations

import os
import tomllib
from pathlib import Path
from typing import Any


def load_config(config_path: str | Path) -> dict[str, Any]:
    """Read deepagents.toml into a dict."""
    with open(config_path, "rb") as f:
        return tomllib.load(f)


def build_agent(config_path: str | Path | None = None, repo_root: str | Path | None = None):
    """
    Build the deepagents agent with a Postgres-backed checkpointer.

    Returns the compiled agent — call .invoke() / .ainvoke() / .astream()
    on it. Each call should pass a thread_id in the config so the
    PostgresSaver can persist state per conversation.
    """
    from deepagents import create_deep_agent
    from langgraph.checkpoint.postgres import PostgresSaver

    config_path = Path(config_path or os.environ["AGENT_CONFIG_PATH"])
    repo_root = Path(repo_root or os.environ.get("AGENT_REPO_ROOT", config_path.parent))
    cfg = load_config(config_path)

    agent_cfg = cfg.get("agent", {})
    model_cfg = cfg.get("model", {})

    # Resolve relative paths in config against the repo root.
    def abspath(p: str) -> str:
        return str((repo_root / p).resolve())

    skills = [abspath(p) for p in agent_cfg.get("skills", [])]
    memory = [abspath(p) for p in agent_cfg.get("memory", [])]
    subagents_dir = agent_cfg.get("subagents_dir")
    subagents_dir = abspath(subagents_dir) if subagents_dir else None

    # Postgres checkpointer — gives us per-thread conversation persistence.
    db_url = os.environ["DATABASE_URL"]
    checkpointer = PostgresSaver.from_conn_string(db_url)
    checkpointer.setup()  # idempotent — creates the checkpoint tables on first run

    # Build the agent. The exact kwarg names here (skills=, memory=, subagents_dir=)
    # follow the deepagents canonical pattern documented in
    # langchain-ai/deepagents/examples/deploy-gtm-agent. If the live API differs,
    # this is the single place to fix it.
    agent = create_deep_agent(
        model=_resolve_model(model_cfg),
        memory=memory,
        skills=skills,
        subagents_dir=subagents_dir,
        checkpointer=checkpointer,
    )
    return agent


def _resolve_model(model_cfg: dict[str, Any]):
    """Translate the [model] block in deepagents.toml into a LangChain chat model."""
    provider = model_cfg.get("provider", "anthropic")
    name = model_cfg.get("name", "claude-opus-4-7")
    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(model=name)
    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=name)
    raise ValueError(f"Unsupported provider in deepagents.toml: {provider!r}")
