# Make_Skills engine — platform-level data model

**Status:** Draft 2026-05-25. Open for Liz to refine. Companion to `make-skills-engine-vs-consumer-scope.md`.

## Core sentence

> Make_Skills the engine owns the data model for "an agent operates for a user, in a tenant, with a catalog of compiled skills, against pluggable model providers, with persistent memory and observable runtime." It does NOT own anything about who that user is (student, patient, player, etc.) — that's the consumer's data model.

## The 12 engine-level objects

Each has one bounded-context owner inside the engine. Consumer-product data (Student, Lesson, Cohort, etc.) is NOT here — it lives in each consumer's own data model.

### Tenant Service domain

| Object | Definition | Key fields | Notes |
|---|---|---|---|
| **Tenant** | The scoping unit for everything else. One end-user OR one organization, depending on the consumer's deployment shape. | `id, kind` (single-user / org), `created_at, parent_tenant_id` (nullable, for org → user hierarchy) | RLS scope key. All other tables filter by `tenant_id`. |
| **TenantSecret** | The per-tenant BYO API keys (Anthropic, OpenAI, etc.) and any other per-tenant credentials. | `id, tenant_id, provider_slug` (anthropic / openai / google / ollama / ...), `value_encrypted, created_at, last_used_at` | Encrypted at rest. Never logged. |

### Agent Service domain

| Object | Definition | Key fields | Notes |
|---|---|---|---|
| **AgentInstance** | One running agent for one tenant. A tenant may have multiple AgentInstances (work agent, study agent, etc.). | `id, tenant_id, name, kind` (the agent role: assistant / coach / researcher / ...), `created_at, archived_at` | The unit a consumer product creates per end-user. |
| **ConversationThread** | A persistent dialogue between a Tenant and one of their AgentInstances. | `id, tenant_id, agent_instance_id, title, created_at, last_message_at` | LangGraph's `thread_id` maps here. |
| **Turn** | One user message + one agent response within a ConversationThread. | `id, thread_id, role` (user / assistant), `content, tokens_in, tokens_out, model_used, cost_cents, ts` | Smallest unit of agent work. |

### Skill Service domain

| Object | Definition | Key fields | Notes |
|---|---|---|---|
| **SkillSource** | A `.md` file that defines a skill in plain English. The author-time artifact. | `id, tenant_id` (or `null` for shared/public skills), `slug, name, content_md, frontmatter (json), version, source_origin` (authored / promoted / forked), `created_at, updated_at` | Authored by users (or admins, or promoted from the-loom). |
| **CompiledSkill** | The runtime artifact produced from a SkillSource. What the agent runtime loads. | `id, skill_source_id, version, runtime_format` (json / python / etc.), `compiled_at, capability_signature` (tools used, model needs, etc.) | One SkillSource → many CompiledSkill versions over time. |
| **SkillAttachment** | An AgentInstance's binding to a CompiledSkill. "This agent has this skill available." | `id, agent_instance_id, compiled_skill_id, attached_at, detached_at` (nullable) | Soft-detachable so we keep history. |

### Model Service domain

| Object | Definition | Key fields | Notes |
|---|---|---|---|
| **ModelProvider** | A registered model-provider integration (Anthropic, OpenAI, Google, Together, Ollama, etc.). | `id, slug, kind` (anthropic / openai / ...), `display_name, capabilities (json), default_model` | Engine ships with default providers; consumer products can register more. |
| **ModelInvocation** | One model call (used for cost tracking, debugging, telemetry). | `id, tenant_id, turn_id, model_provider_id, model_name, tokens_in, tokens_out, cost_cents, latency_ms, ts` | High-volume table; could be sampled at scale. |

### Memory Service domain

| Object | Definition | Key fields | Notes |
|---|---|---|---|
| **MemoryRow** | A persisted memory entry for an AgentInstance. Vector-indexed for retrieval. | `id, tenant_id, agent_instance_id, kind` (project / user / feedback / reference), `content, content_embedding (vector), visibility` (private / shared / deleted), `ts, why` (provenance string) | Per-tenant, per-agent. Soft-delete via `visibility=deleted`. |
| **MemoryWriteEvent** | A telemetry shadow of every MemoryRow write. Allows reconstructing what happened, who wrote what when. | `id, tenant_id, agent_instance_id, memory_row_id, ts, source` (agent / user-injected / promoted) | Used for audit + the-loom's observability feed. |

## Relationships (ER overview)

```text
Tenant ────┬──── TenantSecret (BYO API keys)
           │
           ├──── AgentInstance ────┬──── ConversationThread ──── Turn ──── ModelInvocation
           │                       │
           │                       ├──── SkillAttachment ──── CompiledSkill ──── SkillSource
           │                       │
           │                       └──── MemoryRow ──── MemoryWriteEvent
           │
           └──── (parent_tenant_id self-ref for org→user hierarchy)

ModelProvider ──── (referenced by) ModelInvocation
SkillSource ──── (one-to-many) ──── CompiledSkill
```

## Bounded-context ownership summary

| Bounded Context | Owns | Reads (without owning) |
|---|---|---|
| **Tenant Service** | Tenant, TenantSecret | — |
| **Agent Service** | AgentInstance, ConversationThread, Turn | Tenant (for scoping) |
| **Skill Service** | SkillSource, CompiledSkill, SkillAttachment | Tenant, AgentInstance (for scoping) |
| **Model Service** | ModelProvider, ModelInvocation | Tenant, Turn (for scoping) |
| **Memory Service** | MemoryRow, MemoryWriteEvent | Tenant, AgentInstance (for scoping) |

## What's NOT in this data model

- **Anything about who the end-user is.** No Student, no Patient, no Player, no Researcher. That's the consumer product's data model.
- **Anything about the consumer's UX flows.** No Lesson, no Onboarding step, no Cohort, no Module. Consumer data model.
- **Anything about consumer-side identity.** No "user", no "email", no "name." The engine knows Tenants (opaque scoping keys); consumers know users.
- **Anything about the-loom's domain.** No Project, no Repo, no Machine, no ArchitectureNode, no Run, no Decision. Those are the-loom's.

## What crosses the boundary with the-loom

The skill-making bridge (from the scope doc):

| Direction | What moves | Engine objects involved |
|---|---|---|
| the-loom → engine | Promotion candidate from Architecture Registry | Triggers creation of a new SkillSource (with `source_origin="promoted"`) and subsequent CompiledSkill |
| engine → the-loom | Skill metadata for cataloging | SkillSource + CompiledSkill metadata published to the-loom's catalog |
| engine → the-loom | Telemetry feed (which skills get used, in what threads, by what tenants) | MemoryWriteEvent, ModelInvocation, Turn — emitted as TelemetryEvents to the-loom's observability service |

## Engine ↔ consumer-product API contract

Consumers don't see the engine's internal tables directly. They interact via APIs:

| Consumer needs to | Engine API |
|---|---|
| Provision a tenant for a new end-user | `POST /tenants` |
| Create an agent for a tenant | `POST /tenants/{id}/agents` |
| Attach a skill to an agent | `POST /agents/{id}/skills` (with skill_id) |
| Send a user message, get an agent response (streaming) | `POST /agents/{id}/chat` (returns SSE / streaming) |
| Set per-tenant BYO API keys | `POST /tenants/{id}/secrets` |
| List available skills in the catalog | `GET /skills` (filterable by capability) |
| Author a new skill (from inside the consumer's admin UI) | `POST /skills` (with markdown body) |

The consumer never touches Turn, ModelInvocation, MemoryRow, MemoryWriteEvent directly. Those are internal. The engine handles them on the consumer's behalf.

## Open design questions

1. **Tenant hierarchy.** The current Make_Skills already has tenants — but does the engine need org → user hierarchy as a first-class feature, or do consumer products implement that themselves (e.g., humancensys.com's `tenant_users` table)? Default: keep simple (flat Tenants) in the engine; consumers can layer their own grouping.
2. **Skill versioning.** When a SkillSource changes, do existing SkillAttachments auto-upgrade to the new CompiledSkill, or do they stay pinned? Default: pin (stable behavior); admins explicitly upgrade.
3. **CompiledSkill format.** What does "compiled" actually mean? Some options: (a) JSON manifest the agent runtime interprets; (b) Python code the runtime imports; (c) prompt fragments the runtime composes; (d) all three depending on skill type. Default: start with JSON manifest + prompt fragments; add code-skills later if needed.
4. **Shared vs. per-tenant skills.** Does the catalog distinguish "global skills available to all tenants" from "tenant-private skills"? Default: yes, `tenant_id` is nullable on SkillSource; `null` = shared/public.
5. **Memory model granularity.** Should MemoryRow distinguish "session memory" from "long-term memory" from "skill-acquired memory"? Or is the `kind` field enough? Default: `kind` is enough for V1; specialize later.
6. **ModelInvocation retention.** Per-Turn ModelInvocation rows can be high-volume. Retention policy: keep raw for 30 days, aggregate after. Or longer for billing. Open.

## What this does NOT cover

- API endpoint shapes in detail — that's the API contract spec, next layer.
- Auth flow — Make_Skills' auth approach is JWT-shared-with-consumer, documented separately.
- Skill compilation pipeline internals — see future `2026-05-25-skill-making-bridge.md`.
- Consumer-product data models (humancensys.com's Student, Lesson, etc.) — they belong in the consumer's repo.
