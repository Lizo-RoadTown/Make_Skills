# Make_Skills engine — MVP repo layout

**Status:** Draft 2026-05-25. Open for Liz to refine. Companion to `make-skills-engine-vs-consumer-scope.md` + `2026-05-25-make-skills-engine-data-model.md`.

## What this proposes

Future shape of the `Lizo-RoadTown/Make_Skills` repo AFTER humancensys.com is extracted into its own repo. The engine becomes a reusable agent platform that consumer products install.

## Core sentence

> Make_Skills the engine is a reusable agent platform that ships as both a hosted service AND a self-host distribution. Consumer products install it (any way: Python package, Docker image, hosted endpoint) and integrate via REST/MCP/SDK. Their UI, identity, and business logic stay in their own repos.

## The four-layer architecture (mirrors the-loom's shape)

```text
Consumer Product (humancensys.com, future health app, etc.)
  ↓
Consumer SDK / REST client / MCP client
  ↓
Engine Access Layer (auth, routing, validation, rate-limiting)
  ↓
Engine Core Services (Tenant, Agent, Skill, Model, Memory)
```

Consumer products never touch core services directly. Always via the access layer.

## Target tree

```text
Make_Skills/                         (the engine, after humancensys.com extraction)
│
├── services/                        — bounded-context backend services
│   ├── tenant/                      — Tenant Service (Tenants + BYO secrets)
│   ├── agent/                       — Agent Service (AgentInstance, ConversationThread, Turn)
│   ├── skill/                       — Skill Service (SkillSource, CompiledSkill, SkillAttachment)
│   ├── model/                       — Model Service (ModelProvider registry, ModelInvocation)
│   ├── memory/                      — Memory Service (MemoryRow, MemoryWriteEvent)
│   ├── skill-making/                — The bridge from the-loom: accepts promotion candidates, compiles to skills
│   └── policy/                      — engine-side policy / access control / quota enforcement
│
├── access/                          — access layer (entry points for consumer products)
│   ├── rest/                        — REST API the consumer SDK calls
│   ├── mcp/                         — MCP servers exposing agent + skill + memory operations
│   ├── websocket/                   — streaming chat responses
│   └── webhook/                     — inbound webhooks (e.g. from the-loom: promotion candidates)
│
├── providers/                       — model-provider adapter implementations
│   ├── anthropic/
│   ├── openai/
│   ├── google/
│   ├── ollama/
│   ├── together/
│   └── huggingface/
│
├── runtime/                         — the agent runtime itself (loads CompiledSkills, executes turns)
│   ├── agent-loop/
│   ├── skill-loader/
│   ├── tool-dispatcher/
│   └── streaming/
│
├── compiler/                        — skill compilation pipeline (.md → CompiledSkill artifact)
│   ├── parser/                      — frontmatter + body parsing
│   ├── analyzer/                    — capability extraction
│   ├── codegen/                     — emit the runtime-format artifact (json / prompt / etc.)
│   └── validator/                   — pre-publish checks
│
├── sdk/                             — consumer-installable client SDKs
│   ├── python/                      — `pip install make-skills-sdk`
│   ├── typescript/                  — `npm install @make-skills/sdk`
│   └── examples/                    — minimal consumer-product integrations
│
├── packages/                        — internal shared code
│   ├── shared-types/                — TS interfaces + Python typing
│   ├── schemas/                     — DB schemas, API schemas, MCP protocol shapes
│   └── tenant-context/              — the cross-service tenant ContextVar (the existing `current_tenant`)
│
├── infra/                           — infrastructure-as-code
│   ├── docker/                      — Dockerfiles + compose for self-host
│   ├── migrations/                  — Postgres migrations
│   ├── render/                      — Render Blueprint for hosted deploy
│   └── kubernetes/                  — optional Helm charts for self-host at scale
│
├── tests/                           — engine tests
│   ├── unit/
│   ├── integration/
│   └── e2e/                         — fake consumer product wiring up the SDK
│
└── docs/
    ├── architecture/                — internal architecture docs (incl. this proposal series)
    ├── api-contracts/               — REST + WebSocket + Webhook contracts
    ├── agent-contracts/             — MCP protocol shapes per access surface
    ├── integration-guides/          — "how to integrate Make_Skills into your consumer product"
    └── decision-records/            — ADRs
```

## The smaller MVP slice (ship this first)

```text
Make_Skills/
├── services/{tenant,agent,skill,memory,model}/
├── access/rest/
├── providers/anthropic/             (one provider to start)
├── runtime/{agent-loop,skill-loader}/
├── compiler/{parser,codegen}/
├── sdk/python/
├── packages/shared-types/
├── infra/docker/ + infra/render/
└── docs/architecture/
```

Drops for MVP (add later): `services/skill-making/`, `services/policy/`, the other access surfaces (mcp, websocket, webhook), most providers, `runtime/streaming`, `compiler/{analyzer,validator}`, `sdk/typescript`, `packages/schemas`, `infra/kubernetes`, the integration-guides + agent-contracts docs.

**MVP capability:** a consumer product can register a tenant, attach an agent, attach skills, and have the agent chat using Anthropic's models. Skills can be authored from markdown. Memory persists per agent. Everything else is V2.

## Distribution shape (how consumers install it)

Three modes the engine supports:

| Mode | Who uses it | Mechanism |
|---|---|---|
| **Hosted SaaS** | Consumer products that don't want to run their own infrastructure | The engine runs on Render (or wherever). Consumers POST to a URL. Pay-per-use or subscription. |
| **Self-host (Docker image)** | Consumer products that want their own deploy | `docker run make-skills:latest` with their own Postgres + LanceDB. Full control. |
| **SDK-only (Python package)** | Embedded use cases — running the engine in-process | `pip install make-skills-sdk` and instantiate in the consumer's own Python service. No separate engine process. |

`PLATFORM_MODE` env var (already in Make_Skills today) determines self-host vs hosted behavior at runtime — keep that pattern in the engine.

## Engine ↔ consumer wiring example

```python
# In the consumer product (e.g., humancensys.com's backend)
from make_skills_sdk import EngineClient

engine = EngineClient(
    url="https://api.humancensys.com",      # or local URL in self-host
    api_key=os.environ["MAKE_SKILLS_KEY"],
)

# Provision a tenant for a new student
tenant = engine.tenants.create(kind="single-user")

# Create an agent for this student
agent = engine.agents.create(
    tenant_id=tenant.id,
    name="Study Buddy",
    kind="learning-coach",
)

# Attach a skill (already-compiled, from the catalog)
engine.agents.attach_skill(
    agent_id=agent.id,
    skill_slug="explain-like-im-5",
)

# Send a message, stream the response back to the student
async for chunk in engine.agents.chat_stream(
    agent_id=agent.id,
    message="What is photosynthesis?",
):
    yield chunk    # forward to the student's UI
```

The consumer product never sees Tenant rows, Turn rows, ModelInvocation rows, MemoryRow rows. The engine handles all of that.

## The skill-making bridge service (`services/skill-making/`)

The new service introduced in the scope doc. Receives promotion candidates from the-loom and produces CompiledSkills.

| Direction | Endpoint | What |
|---|---|---|
| the-loom → engine | `POST /access/webhook/skill-promotion` | Webhook: "this pattern is stable, here's the source material + metadata. Make a skill." |
| engine → the-loom | `POST {the-loom's URL}/architecture-registry/skill-registered` | "Skill compiled and registered, here's the skill_id and the SkillSource location." |
| engine internal | `services/skill-making/` watches its own queue + invokes the compiler pipeline | — |

This service is the only one in the engine that knows about the-loom. The rest of the engine treats SkillSource as "a skill someone authored" — doesn't care if a human wrote it or it was promoted from a pattern.

## What this commits to

| Commitment | Implication |
|---|---|
| **Monorepo with services/ + access/ + providers/ + runtime/ + compiler/ + sdk/** | One repo for the engine; atomic refactors; consistent CI |
| **REST API is the primary access method**, MCP/WebSocket/Webhook are peers added later | Consumers integrate via well-known REST initially; MCP is for agent-side access; WebSocket is for streaming; webhook is for the-loom integration |
| **Hosted + self-host + SDK-only distribution** | Engine ships THREE ways. Same code, three runtime shapes. Consumers pick. |
| **Provider adapters live in `providers/`** | Each model provider has its own adapter; engine is provider-agnostic at the core |
| **`compiler/` is internal** | Consumers don't run the compiler; they call the engine's APIs which run it on their behalf |
| **`services/skill-making/` is the only service that knows about the-loom** | The rest of the engine doesn't care where SkillSources come from |

## How this relates to current `Lizo-RoadTown/Make_Skills` (the migration shape)

Current Make_Skills has both engine and consumer mixed:

| Currently at | Goes to in the split |
|---|---|
| `platform/api/runtime.py`, `skill_compiler.py`, agent management | `runtime/agent-loop/` + `compiler/` in this repo (Make_Skills the engine) |
| `platform/api/memory/{lance.py,mcp_server.py,mcp_http.py,auth_bridge.py}` | `services/memory/` + `access/mcp/` in this repo |
| `platform/api/auth.py` (JWT shared-secret bridge) | `access/rest/` middleware + `packages/tenant-context/` |
| `platform/api/main.py` agent endpoints (`/chat`, `/agents/*`) | `access/rest/` |
| Model provider wiring (Anthropic, OpenAI, etc.) | `providers/*` |
| `web/` Next.js UI + student flows | **Moves to a new repo: `Lizo-RoadTown/humancensys-app`** |
| Auth.js Drizzle setup + student identity tables | **Moves to `humancensys-app`** — Auth.js issues JWTs; engine accepts them but doesn't own students |
| Lesson content, IDENTITY-TO-HABIT framework | **Moves to `humancensys-app`** |
| `render.yaml` | Splits: one render.yaml for the engine, one for humancensys-app |
| Pillar 1/2/3 framing tied to students | **Moves to `humancensys-app`** docs — engine framing is more general |

## Migration roadmap (high-level — separate proposal needed for full plan)

1. **Stabilize the engine's API surface inside current Make_Skills.** Identify what's "engine code" vs "humancensys.com code." Mark boundaries with comments / module structure.
2. **Create `Lizo-RoadTown/humancensys-app` repo.** Empty.
3. **Move `web/` + Auth.js + student-shaped code** into `humancensys-app`. Wire humancensys-app to call Make_Skills' API at the engine's existing URL.
4. **Restructure Make_Skills' code** to the engine MVP layout above. Drop everything humancensys-specific.
5. **Add `services/skill-making/`** to receive from the-loom.
6. **Publish SDK** (Python first; TypeScript later).
7. **Iterate** — refine the API contract as humancensys-app and any future consumers use it.

## Open design questions

1. **Single Postgres or multi-DB?** Engine's services could share one Postgres (simpler) or each have its own (stricter isolation). Default: one Postgres with schema separation + RLS by tenant_id.
2. **`runtime/` vs `services/`** — the agent runtime is somewhere between a service (long-running, owns state) and a library (called per-turn). Could be either. Default: standalone service with its own deploy footprint.
3. **Skill catalog placement** — does the skill catalog (SkillSource + CompiledSkill) live in Make_Skills the engine or in the-loom? My data model put it in the engine. But the-loom is also interested in cataloging promoted patterns. Possible answer: engine OWNS the catalog; the-loom QUERIES it via API for its own dashboards.
4. **Provider adapter contract** — what's the minimum a new provider must implement? Probably `complete(messages, model, tools)` + `embed(texts)` + `list_models()`. Document as a Python protocol.
5. **Versioning** — the engine ships as 0.X for a while; semver after stable. Consumer SDKs probably want their own version too.

## What this does NOT cover

- The detailed REST API contract — that's `docs/api-contracts/` content, separate spec.
- The compiler pipeline internals — that's `docs/architecture/skill-compilation.md`, separate.
- Migration sequencing — needs its own proposal (`docs/plans/2026-05-XX-humancensys-extraction.md`).
- Provider adapter implementation patterns — `docs/integration-guides/adding-a-provider.md`, separate.
- The-loom's skill-making integration contract — see `2026-05-25-skill-making-bridge.md` (to be written).
