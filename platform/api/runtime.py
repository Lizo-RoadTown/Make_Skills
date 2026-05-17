"""
Pillar 1B step 4 — AgentRuntime skeleton.

Per-(tenant, agent_id) deepagents instantiation with cached components.
Replaces the singleton built in api/agent.py for the case where the
student is chatting with one of THEIR built agents (rather than the
platform-default guide-shaped agent).

This step ships:
  - AgentConfig dataclass — the materialized view of a row in
    user_agents + its child rows in student_skills + student_integrations
    + the tenant's decrypted secret for the chosen provider.
  - StudentSkill / StudentIntegration sub-dataclasses.
  - AgentRuntime class with empty component caches (filled in over
    steps 5-8) and a working _get_config that reads from the DB.
  - chat() / stream() stubs that raise NotImplementedError.

Step 5 cuts /chat over to use this for the default-agent case.
Step 6 wires per-agent_id routing. Step 7 fills the compiled-skill
cache. Step 8 fills the MCP-client pool. Step 9 wires invalidation.

See docs/proposals/pillar-1b-agent-runtime.md for the full picture.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import AsyncIterator
from uuid import UUID

from api.auth import TenantContext
from api.db import tenant_conn

log = logging.getLogger("runtime")


@dataclass(frozen=True)
class StudentSkill:
    """One row of student_skills materialized into the runtime."""

    id: UUID
    name: str
    description: str
    body_md: str
    version: int


@dataclass(frozen=True)
class StudentIntegration:
    """One row of student_integrations materialized into the runtime."""

    id: UUID
    mcp_server_slug: str
    config: dict


@dataclass(frozen=True)
class AgentConfig:
    """Everything the runtime needs to instantiate a student-built agent.

    `api_key` is the decrypted secret for `provider`. Populated by
    _get_config from student_secrets via pgp_sym_decrypt. None means
    no key stored — caller must handle (likely fall back to provider's
    env-var key or error out with a clear message).
    """

    id: UUID
    tenant_id: UUID
    name: str
    starter: str
    provider: str
    model: str | None
    persona: str | None
    api_key: str | None
    skills: list[StudentSkill] = field(default_factory=list)
    integrations: list[StudentIntegration] = field(default_factory=list)


class AgentRuntime:
    """Per-(tenant, agent_id) deepagents instantiation.

    Built once at FastAPI startup, replaces the singleton's role for
    student-built agents. The platform-default agent (the guide's
    speech model) continues to be built by api/agent.build_agent.

    Cache layers (all gated by TTL/size eviction in later steps):

      _agent_configs   : (tenant_id, agent_id) -> AgentConfig
                         Invalidated when user_agents / student_skills /
                         student_integrations rows change for that key.

      _provider_clients: (tenant_id, provider, model) -> ChatModel
                         Filled in step 5 when chat() actually
                         instantiates models.

      _compiled_skills : (skill_id, version) -> Tool
                         Filled in step 7. Skills are immutable per
                         version, so eviction is rarely needed.

      _mcp_clients     : (tenant_id, integration_id) -> MCPClient
                         Filled in step 8 with idle keepalive + per-
                         tenant hard caps.
    """

    def __init__(self, default_agent: object | None = None) -> None:
        # The singleton deepagents instance built by api/agent.build_agent
        # at FastAPI startup. Used for the agent_id=None case (the
        # platform-default guide-shaped agent) until step 6 wires per-
        # (tenant, agent_id) instantiation.
        self._default_agent = default_agent

        # Simple dicts for the skeleton. Step 9 swaps in TTL/LRU caches
        # (cachetools or equivalent) once we have observation data for
        # sizing.
        self._agent_configs: dict[tuple[str, str], AgentConfig] = {}
        self._provider_clients: dict[tuple[str, str, str], object] = {}
        self._compiled_skills: dict[tuple[str, int], object] = {}
        self._mcp_clients: dict[tuple[str, str], object] = {}

    # ---- Config loading ----

    async def _get_config(
        self, ctx: TenantContext, agent_id: UUID
    ) -> AgentConfig | None:
        """Load an AgentConfig from the DB. Returns None if no row matches
        (deleted, wrong tenant, or unknown UUID).

        All queries run through tenant_conn so RLS enforces tenant
        scoping at the SQL layer — passing a stale tenant_id can't
        produce another tenant's data.

        api_key is the decrypted secret for the agent's chosen provider.
        Pulled via pgp_sym_decrypt(encrypted_value, current_setting('app.secrets_key')).
        When MAKE_SKILLS_SECRETS_KEY isn't set on the deployment, the
        GUC is unset and the SELECT returns NULL — caller must handle.
        """
        cache_key = (ctx.tenant_id, str(agent_id))
        cached = self._agent_configs.get(cache_key)
        if cached is not None:
            return cached

        async with tenant_conn(ctx) as conn:
            # ---- user_agents row ----
            cur = await conn.execute(
                """
                SELECT id, name, starter, provider, model, persona
                FROM user_agents
                WHERE id = %s::uuid AND deleted_at IS NULL
                """,
                (str(agent_id),),
            )
            row = await cur.fetchone()
            if not row:
                return None
            agent_id_uuid, name, starter, provider, model, persona = row

            # ---- student_skills rows ----
            cur = await conn.execute(
                """
                SELECT id, name, description, body_md, version
                FROM student_skills
                WHERE agent_id = %s::uuid
                ORDER BY created_at
                """,
                (str(agent_id),),
            )
            skill_rows = await cur.fetchall()
            skills = [
                StudentSkill(
                    id=r[0],
                    name=r[1],
                    description=r[2],
                    body_md=r[3],
                    version=r[4],
                )
                for r in skill_rows
            ]

            # ---- student_integrations rows ----
            cur = await conn.execute(
                """
                SELECT id, mcp_server_slug, config_json
                FROM student_integrations
                WHERE agent_id = %s::uuid
                ORDER BY created_at
                """,
                (str(agent_id),),
            )
            integ_rows = await cur.fetchall()
            integrations = [
                StudentIntegration(
                    id=r[0],
                    mcp_server_slug=r[1],
                    config=r[2] or {},
                )
                for r in integ_rows
            ]

            # ---- decrypted API key for the agent's provider ----
            # pgp_sym_decrypt returns NULL if app.secrets_key isn't set
            # OR if no matching row exists. Both cases produce api_key=None
            # which the runtime handles by falling back to env vars or
            # erroring out with a clear message at chat time.
            cur = await conn.execute(
                """
                SELECT pgp_sym_decrypt(
                    encrypted_value,
                    current_setting('app.secrets_key', true)
                )
                FROM student_secrets
                WHERE provider_slug = %s
                """,
                (provider,),
            )
            secret_row = await cur.fetchone()
            api_key = secret_row[0] if secret_row else None

        config = AgentConfig(
            id=agent_id_uuid,
            tenant_id=UUID(ctx.tenant_id),
            name=name,
            starter=starter,
            provider=provider,
            model=model,
            persona=persona,
            api_key=api_key,
            skills=skills,
            integrations=integrations,
        )
        self._agent_configs[cache_key] = config
        return config

    def invalidate_agent(self, tenant_id: str, agent_id: UUID) -> None:
        """Drop cached config for a (tenant, agent) pair. Wired into
        agent / skill / integration write endpoints in step 9 so cache
        stays fresh after the wizard saves an edit."""
        self._agent_configs.pop((tenant_id, str(agent_id)), None)

    # ---- Internal: resolve which deepagents instance to use ----

    async def _resolve_agent(
        self, ctx: TenantContext, agent_id: UUID | None
    ) -> object:
        """Returns the deepagents instance to invoke for this call.

        Step 5 (this): agent_id=None returns the platform-default
        singleton. Same instance every call; identical behavior to the
        pre-runtime code path.

        Step 6 (next): agent_id=<UUID> loads the AgentConfig + builds a
        per-(tenant, agent) instance from cached components.
        """
        if agent_id is None:
            if self._default_agent is None:
                raise RuntimeError(
                    "AgentRuntime has no default_agent — pass it in "
                    "during FastAPI lifespan setup."
                )
            return self._default_agent

        raise NotImplementedError(
            "Per-agent_id runtime instantiation is a step-6 deliverable. "
            f"Got agent_id={agent_id!r}; only None is supported today."
        )

    # ---- Chat surface ----

    async def chat(
        self,
        ctx: TenantContext,
        agent_id: UUID | None,
        thread_id: str,
        message: str,
    ) -> dict:
        """Single-shot chat. Returns {'response': str}.

        Caller (the FastAPI endpoint) handles thread-belongs-to-tenant
        gating, current_tenant ContextVar setting, and the fire-and-
        forget memory recorder. This method only owns agent invocation.
        """
        agent = await self._resolve_agent(ctx, agent_id)
        config = {
            "configurable": {"thread_id": thread_id, "tenant_id": ctx.tenant_id}
        }
        result = await agent.ainvoke(  # type: ignore[attr-defined]
            {"messages": [{"role": "user", "content": message}]},
            config=config,
        )
        final = (
            result["messages"][-1]
            if isinstance(result, dict) and "messages" in result
            else result
        )
        response_text = getattr(final, "content", None) or str(final)
        return {"response": response_text}

    async def stream(
        self,
        ctx: TenantContext,
        agent_id: UUID | None,
        thread_id: str,
        message: str,
    ) -> AsyncIterator[object]:
        """Streamed chat. Yields raw chunks from deepagents.astream;
        caller is responsible for serializing them into SSE."""
        agent = await self._resolve_agent(ctx, agent_id)
        config = {
            "configurable": {"thread_id": thread_id, "tenant_id": ctx.tenant_id}
        }
        async for chunk in agent.astream(  # type: ignore[attr-defined]
            {"messages": [{"role": "user", "content": message}]},
            config=config,
            stream_mode="messages",
        ):
            yield chunk
