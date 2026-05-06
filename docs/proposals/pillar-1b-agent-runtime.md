# Proposal: Pillar 1B — Agent Runtime Architecture

**Status:** Open — design discussion. Sibling to portable-student-identity and guide-module proposals.
**Authors:** Liz, Claude
**Date:** 2026-05-05

## Architectural framing

The portable-student-identity proposal pinned the **schema** for built agents (`user_agents`, `student_skills`, `student_integrations`, `student_secrets`). The guide-module proposal pinned the **module that runs the guide**. This proposal pins the **runtime** that turns a saved agent row into a process that can actually answer a chat call — and the seams it shares with BYO keys, the guide, and the existing FastAPI service.

Today the FastAPI service builds a single deepagents instance at startup (`platform/api/agent.py`) and uses it for every `/chat` call. That's per-deployment, not per-tenant or per-agent. To deliver Pillar 1B, the runtime must instantiate per-`(tenant, agent)` configurations — each student's stable of agents, each one with its own brain, persona, skills, integrations, secrets — without instantiation cost making `/chat` unusable.

Five questions cascade out of that requirement, and every other component (BYO keys, guide, future quests) bends to the answers:

1. **Lifecycle**: when do agent instances get built, cached, evicted?
2. **Skill compilation**: how does the markdown the student wrote become a tool the deepagents agent can call?
3. **Integration loading**: how do MCP clients attach to per-tenant agent instances?
4. **Provider key resolution**: how does an agent process get its tenant's decrypted API key at use-time?
5. **Guide-to-agent handoff**: how does the guide invoke a student-built agent?

This proposal answers each, and specifies the `AgentRuntime` API surface that codifies the answers.

## Problem

Without these decisions settled:

- BYO API key setup picks a decryption pattern in isolation; the runtime later can't read what was encrypted, or duplicates the decryption logic in the wrong place.
- The wizard's saved agents persist to `user_agents` rows but `/chat` never loads them. Students have a stable of agents that don't run.
- The guide module (per its own proposal) needs to invoke built agents during quest execution and complex chat tasks. Without a handoff protocol, the guide either becomes a monolith or the integration is bolted on later.
- Skill compilation choice (raw text vs. structured tool vs. langgraph subgraph) determines what students can DO with skills, which loops back into wizard UX.

## Decision 1: lifecycle — factory with cached components, per-request instantiation

Agent instances themselves are cheap to construct *if* their components are cached. The expensive things are: model clients (provider SDK init + auth check), MCP clients (TCP connection + handshake), and skills compilation. Cache those; instantiate the deepagents wrapper per-request from cached parts.

### Cache layers

```
ProviderModelClient cache : keyed by (tenant_id, provider, model) → ChatModel instance
                            TTL 10 minutes idle, max 200 entries

MCPClient pool             : keyed by (tenant_id, integration_id) → MCP session
                            keepalive 5 minutes idle, hard cap per tenant

CompiledSkill cache        : keyed by skill_id (UUID, immutable per version) → compiled tool
                            no eviction (skills are small + immutable per version)

AgentConfig cache          : keyed by (tenant_id, agent_id) → AgentConfig dataclass (NOT the instance)
                            invalidated on user_agents/student_skills/student_integrations writes
                            TTL 1 minute as fallback
```

Per-request `/chat` flow:

1. Resolve calling tenant (Pillar 0).
2. Look up the agent (default-agent if unspecified, otherwise from path param).
3. Pull `AgentConfig` from cache (or load + cache).
4. Get/create `ProviderModelClient` from cache using the agent's provider+model and the tenant's decrypted secret.
5. Get/create `MCPClient` instances for each integration on the agent.
6. Bind `CompiledSkill` tools.
7. Construct deepagents instance (cheap — just wires up the pre-built parts).
8. Run the chat turn.

### Why not cache the full deepagents instance

Deepagents instances hold conversation-thread state (via `LangGraph PostgresSaver`). Caching them per-`(tenant, agent)` either leaks across thread_ids or requires a `(tenant, agent, thread)` key that explodes memory. The wrapper is cheap to build from cached parts; the parts are what's worth caching.

### Why not per-session

Per-session caching means we hold `(tenant, agent, thread)` keys indefinitely or use aggressive eviction. A student running 20 chats produces 20 entries; chat-heavy users multiply that fast. Worse, multi-tab usage forks state. Per-request with cached components avoids the whole class of problem.

## Decision 2: skill compilation — skills become callable tools with sub-call execution

Each `student_skills` row becomes a tool the deepagents agent can call. Tool name = skill `name`. Tool description = skill `description`. Tool body invokes a sub-LLM call where the skill's `body_md` is prepended to the user's task.

```python
def compile_skill(skill: StudentSkill, model_client: ChatModel) -> Tool:
    @tool(name=skill.name, description=skill.description)
    async def run(task: str) -> str:
        prompt = f"""Apply the **{skill.name}** skill to the task below.
Follow the structure described in the skill body — PROBE, DECIDE, ACT, REPORT.

## Skill body
{skill.body_md}

## Task
{task}
"""
        result = await model_client.ainvoke([{"role": "user", "content": prompt}])
        return result.content
    return run
```

This matches the existing `/skills/run` endpoint pattern in `main.py` — same composition, exposed as a tool the *agent* selects (vs. the explicit endpoint the dashboard exposes for manual runs).

### Why not a langgraph subgraph per skill

Subgraphs would let skills have explicit PROBE/DECIDE/ACT/REPORT phases as graph nodes. More powerful, more complex, and pinning the structure too tightly forecloses skill shapes the student might want (a skill that's all-ACT, a skill that's a long PROBE with no DECIDE, etc.). Treating the body_md as a prompt fragment keeps the skill structure as guidance rather than enforcement.

### Versioning

Skills are mutable — the student edits, saves, the row updates. To make `CompiledSkill` cache stable, every edit produces a new `version` (or updates `updated_at`); cache key is `(skill_id, version)` or `(skill_id, updated_at)`. Old compiled tools age out by TTL.

## Decision 3: integration loading — pooled MCP clients with graceful degradation

Each `student_integrations` row binds an MCP server slug + non-secret config to an agent. The runtime maintains a per-`(tenant, integration_id)` MCP client pool with idle keepalive.

### Auth tokens

Integrations referencing OAuth-flavored MCPs (GitHub, Notion, etc.) need user-specific tokens. Stored in `student_secrets` keyed by `(tenant_id, provider_slug='mcp:github')`. Loaded at MCP client construction time, never logged, never returned through any read endpoint.

### Graceful degradation

If an integration's MCP server is unreachable at instantiation:

- Log the failure with `tenant_id`, `integration_id`.
- Build the deepagents instance WITHOUT that integration's tools.
- Mark the agent's chat response with a `warnings` field indicating which integration was skipped.
- Surface via UI as a yellow banner on the agent's stable card: "GitHub integration was unavailable in your last run."

Hard-failing on integration outages would punish students for transient backend issues. Graceful degradation matches how good agent platforms handle real-world flakiness.

### Per-tenant pool caps

A misbehaving tenant could open many MCP connections (one per integration × one per concurrent chat). Hard cap of 50 concurrent MCP clients per tenant; hitting the cap kicks the LRU client out of the pool.

## Decision 4: provider key resolution — pgcrypto with deployment-level key, KMS upgrade path

`student_secrets.encrypted_value` is encrypted via Postgres' `pgcrypto` `pgp_sym_encrypt(plaintext, deployment_key)`. The `deployment_key` is a 32-byte secret in the `MAKE_SKILLS_SECRETS_KEY` env var, set on Render (and on self-host installs by the operator).

### At runtime

```sql
SELECT pgp_sym_decrypt(encrypted_value, current_setting('app.secrets_key'))
FROM student_secrets
WHERE tenant_id = current_setting('app.tenant_id')::uuid
  AND provider_slug = 'anthropic';
```

`app.secrets_key` is set per-connection from the env var, transaction-scoped. RLS on `student_secrets` enforces tenant scope (Pillar 0 already provides this).

### Why pgcrypto, not application-level libsodium

Two reasons:
- The Pillar 0 RLS policy is already enforced at the DB layer. Putting decryption there too keeps the security boundary in one place.
- pgcrypto is built into Render's managed Postgres (no extra infra). Self-hosters can `CREATE EXTENSION pgcrypto;` once during migration.

### KMS upgrade path

For hosted scale, `MAKE_SKILLS_SECRETS_KEY` is replaced with a per-tenant DEK (data encryption key) wrapped by a KMS-managed KEK. The DB column shape stays the same; the unwrap step happens before the SQL decrypt. The upgrade is a migration, not a rewrite.

### Two-mode implications

- **Self-host**: `MAKE_SKILLS_SECRETS_KEY` set in `.env`. Operators are responsible for key rotation.
- **Hosted**: `MAKE_SKILLS_SECRETS_KEY` set as a Render secret env. Eventual KMS migration handles rotation centrally.

Both modes decrypt the same way at the SQL layer; only the key source differs.

## Decision 5: guide-to-agent handoff — tool call pattern (langgraph deferred)

The guide module needs to invoke a student-built agent during quest execution and complex chat tasks. Two patterns considered:

### A: Tool call (chosen for v1)

The guide has a `delegate_to_agent(agent_id, task) -> str` tool registered. When the guide's LLM decides to delegate, it calls this tool. The tool implementation:

1. Loads the agent via `AgentRuntime.get_or_build(tenant_id, agent_id)`.
2. Invokes the agent with `task` as the user message.
3. Returns the agent's final response as a string.

Synchronous from the guide's perspective. The guide's LLM sees the result and incorporates it into its response.

### B: Langgraph subgraph (deferred to Phase 2)

Both guide and built agents become nodes in a single langgraph; routing decisions are graph edges. More powerful (multi-agent loops, parallel execution, cross-agent state). Significantly more complex; harder to debug.

### Why A wins for v1

Tool calls are how every existing agent framework handles delegation today. Single mental model (tools are tools, whether they call APIs or other agents). Debuggable in the existing trace UI. Sufficient for the solo-loop quests (Section 2). When multiplayer / orchestration arrives (Section 3), revisit langgraph subgraphs as a Phase 2 evolution; the `delegate_to_agent` tool stays usable as the simple case.

### Auth through the handoff

When the guide calls `delegate_to_agent`, the same `tenant_id` propagates. RLS still enforces no cross-tenant calls. The student-built agent runs with the student's keys, secrets, integrations — same as if `/chat` had been called directly.

## AgentRuntime API surface

A single class instantiated once at FastAPI startup, replacing the current `app.state.agent` singleton.

```python
class AgentRuntime:
    """Per-(tenant, agent) deepagents instantiation with cached components."""

    async def chat(
        self,
        tenant_id: UUID,
        agent_id: UUID | None,  # None = default agent (the guide-with-no-personality fallback)
        thread_id: str,
        message: str,
    ) -> ChatResponse:
        config = await self._get_config(tenant_id, agent_id)
        agent = self._build_instance(tenant_id, config)
        return await agent.ainvoke(...)

    async def stream(
        self,
        tenant_id: UUID,
        agent_id: UUID | None,
        thread_id: str,
        message: str,
    ) -> AsyncIterator[ChatChunk]:
        ...

    async def invalidate_agent(self, tenant_id: UUID, agent_id: UUID) -> None:
        """Called when user_agents / student_skills / student_integrations row changes."""
        ...

    # Internal:
    async def _get_config(self, tenant_id, agent_id) -> AgentConfig: ...
    def _build_instance(self, tenant_id, config) -> DeepAgents: ...
    async def _get_model(self, tenant_id, provider, model, api_key) -> ChatModel: ...
    async def _get_mcp_client(self, tenant_id, integration_id, config) -> MCPClient: ...
    def _compile_skill(self, skill: StudentSkill, model_client: ChatModel) -> Tool: ...
```

`/chat` and `/chat/stream` endpoints become thin wrappers around `runtime.chat()` and `runtime.stream()`. `agent_id` is path-param-passed (`POST /chat/{agent_id}`); calls without `agent_id` route to the guide's default.

The `GuideRuntime` (guide-module proposal) is a sibling class, not a subclass — different lifecycle, different cache shape, different API surface. They share component caches (model clients) where they overlap.

## Migration path

Smallest-first. Each step is independently shippable.

1. **`student_secrets` table + pgcrypto setup** — migration, RLS policy, `MAKE_SKILLS_SECRETS_KEY` env var on Render. No endpoints yet. Just the encrypted-storage substrate.
2. **`POST /secrets/set` and `GET /secrets/list`** — student pastes their API key for a provider; stored encrypted. Settings page UI in `/settings/keys`. (This is what unblocks the wizard's Brain step from being decorative.)
3. **`user_agents` + `student_skills` + `student_integrations` migrations** — schema for the wizard's saved-agent loop. RLS policies. `POST /agents/create` writes from the wizard's Save scene.
4. **`AgentRuntime` skeleton** — class, component caches, `_get_config` reading from DB. No endpoint changes yet; `/chat` still uses the singleton.
5. **`AgentRuntime.chat` cutover for default agent** — `/chat` without `agent_id` now goes through `AgentRuntime.chat(tenant_id, None, ...)`. Same behavior as today, different code path. Verifies the runtime works.
6. **Per-`agent_id` routing** — `POST /chat/{agent_id}` endpoint; runtime loads the student's saved agent config. The wizard's saved agents now actually run.
7. **Skill compilation** — `_compile_skill` produces real callable tools. Agent's chat responses can invoke their own skills.
8. **Integration loading + graceful degradation** — `_get_mcp_client` pool, hard caps, warnings field on chat response.
9. **`AgentRuntime.invalidate_agent`** — wired into agent/skill/integration write endpoints so cache stays fresh.
10. **`delegate_to_agent` tool** — registered for the guide module's runtime. Synchronous call into `AgentRuntime`.

Steps 1-2 unblock BYO keys. Steps 3-6 deliver the Pillar 1B core (saved agents that run). Steps 7-9 polish. Step 10 connects to the guide module.

## Two-mode implications

- **Self-host**: AgentRuntime works the same. Pool sizes are smaller defaults; the operator can override via env. `MAKE_SKILLS_SECRETS_KEY` set locally.
- **Hosted**: Pool sizes scale with concurrent users. KMS upgrade path applies.

The runtime architecture is identical in both; only ops settings differ.

## What this proposal does NOT cover

- **Quest execution** — Section 2 territory. Quests will run an agent (or several) under specific instructions; the runtime handles "run this agent on this prompt" — quest-specific orchestration goes elsewhere.
- **Multi-agent orchestration / langgraph subgraphs** — Phase 2. The `delegate_to_agent` tool is the v1 of agent-to-agent.
- **Multiplayer agent runs** — when student A runs a quest using student B's published agent, what does the runtime do? Future proposal once a publish-mechanism exists.
- **The settings page UX for `/settings/keys`** — implementation concern; covered when step 2 lands.
- **Default-agent provisioning** — when a tenant exists but has no `user_agents` rows, what does `/chat` use? A platform-provided "default guide-shaped agent" — separate concern, lives in the guide module's territory.

## Open questions

- **Cache cap sizing** — 200 model clients across all tenants? 50 MCP per tenant? These are guesses. Real numbers come from observation; ship with conservative caps and expose them as tunable env vars.
- **Cold-start latency** — first `/chat` for a `(tenant, agent)` pair pays full instantiation cost. Worth pre-warming on agent save? Probably not for v1; revisit if students complain.
- **Skill versioning** — `student_skills` rows are mutable. Cache invalidation on edit is straightforward. Edge case: a chat is mid-execution when the student edits the skill in another tab — does the in-flight call use old or new? Recommend: in-flight uses old (tool was bound at instantiation), next call uses new. Document this.
- **Guide-to-agent token budget** — a guide call that delegates to an agent that itself delegates to another agent... how deep should this go? Recommend: hard cap at depth 2 (guide → built agent → tool) for v1. Anything deeper is a langgraph subgraph problem.
- **MCP keepalive** — 5 min idle keepalive is a guess. Some MCP servers may drop connections sooner. Make this per-server-configurable in the registry.
