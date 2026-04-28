# Make_Skills roadmap

The Make_Skills platform organizes around **three top-level pillars**, sitting on a **foundational pillar (Pillar 0)** that ensures everything we build supports both self-hosted and hosted-multitenant modes from day one.

> **Status legend:** ✓ shipped · ⚠ partial · ✗ not started · 💬 needs discussion before execution

> **Two-mode commitment (2026-04-28):** Every change from this point forward considers both deployment modes (self-host and hosted-multitenant), with documentation and tests for both. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the clean lines and [`CONTRIBUTING.md`](CONTRIBUTING.md) for the discipline.

---

## Pillar 0 — Foundational: open-source-ready + dual-mode

The platform is **open-source-first** and **deployment-agnostic** (self-host AND hosted-multitenant). This pillar is invisible to users but governs every other pillar's design.

| Capability | Status | Notes |
|------------|--------|-------|
| Architecture document with layered model + clean lines | ✓ | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| `CONTRIBUTING.md` with two-mode discipline | ✓ | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Repo strategy: monorepo with module boundaries | ⚠ | Boundaries defined; explicit per-module READMEs in `platform/`, `web/`, `skills/` are partial |
| License chosen + `LICENSE` committed | ✗ | 💬 MIT vs Apache 2.0 vs AGPL — needs decision |
| Tenant abstraction (tenant_id on data, scoped queries) | ✗ | Required before *any* multi-tenant feature ships |
| Auth interface (`NoAuthBackend` + stub `OAuthBackend`) | ✗ | Pluggable; default to NoAuth for self-host |
| Config loader abstraction (filesystem ↔ multi-tenant config store) | ✗ | Platform code reads tenant config through this only |
| `PLATFORM_MODE` env var + mode-aware startup | ✗ | Single switch determines auth backend |
| Per-mode test scaffolding (unit + integration for both modes) | ✗ | CI must run both |
| Per-mode docs (every feature explained for both modes) | ⚠ | Discipline declared; current docs are mostly self-host-only |
| Code of Conduct | ✗ | 💬 default to Contributor Covenant unless redirected |
| GitHub Actions CI for tests + smoke tests in both modes | ✗ | |
| One-click self-host deploy (Render Blueprint, fly.toml, k8s helm) | ⚠ | Render Blueprint shipped; others later |
| GitHub Discussions enabled for community Qs | ✗ | |

**Discussion needed (decisions block downstream work):**

- 💬 **License:** MIT/Apache 2.0 (max contributor friendliness) vs AGPL (forces SaaS hosters to share modifications)
- 💬 **Auth provider for hosted mode:** GitHub OAuth, Clerk, Auth.js
- 💬 **Tenant routing:** subdomain (`<tenant>.humancensys.com`) vs path (`humancensys.com/<tenant>`)
- 💬 **Tenant config storage in hosted mode:** S3/blob, postgres rows, both
- 💬 **Knowledge graph cross-tenant posture:** strict silo (default) vs opt-in publish vs federated

---

## Pillar 1 — Build agents

A site section for **creating individual agents**: custom personas, model selection across providers (Anthropic, plus open-weight via Hugging Face — Qwen, Llama, etc.), tool/skill scoping, deployment.

The shape Liz outlined: "an area where we create (or cook) agents first — or just have a drop-down or both."

| Capability | Status | Notes |
|------------|--------|-------|
| Author agent persona via filesystem (AGENTS.md + deepagents.toml) | ✓ | Already canonical layout in `subagents/` |
| Two specialist agents stubbed | ✓ | `subagents/planner/`, `subagents/researcher/` |
| Model registry across providers | ✗ | Currently only Anthropic. Need: Hugging Face inference (Qwen, Llama, etc.), OpenAI, Voyage |
| **UI for agent creation** ("cook" mode) | ✗ | Form: name, description, system prompt, model, skills allowlist, tools allowlist → writes to `subagents/<name>/` |
| **UI for agent selection** (dropdown of pre-built) | ✗ | Lists existing subagents, picks one as the orchestrator's delegate |
| Hot-reload of subagents | ✓ | Volume-mounted on local; baked-in on Render — both reflect changes after restart |
| Authoring assistant — agent that helps you build agents | 💬 | "We can work on building skills together" ties into Pillar 2 |

**Discussion needed:** What does "cook an agent" mean concretely — visual form, chat-driven dialog, both? How is HF inference auth handled (local Ollama vs HF Inference Endpoints vs Together.ai)?

---

## Pillar 2 — Make skills together (human ↔ agent skill-building)

A site section where Liz and an agent **co-author skills through the work itself**. The agent learns how Liz works, captures patterns, proposes skills; Liz approves/edits; over time the system gets sharper at recurring tasks.

This is the natural extension of `skills/lessons-learned/SKILL.md` and the `agentic-skill-design` meta-skill.

| Capability | Status | Notes |
|------------|--------|-------|
| `lessons-learned` skill defined | ✓ | Spec for transcript → intake forms + memory updates |
| `agentic-skill-design` meta-skill | ✓ | PROBE → DECIDE → ACT → REPORT pattern, anti-pattern catalog |
| `web-app-scaffold` skill with intake form + preset | ✓ | First fully-realized agentic skill |
| Recorder extracts records from live chats | ✓ | Haiku-powered, fire-and-forget after each turn |
| Backfill from Claude Code transcripts | ✓ | `scripts/backfill-claude-code.py` — verified, 109 records from this session |
| **Curator agent** (auto-runs lessons-learned periodically) | ✗ | Scheduled job that surveys recent records, clusters by project_tag, proposes new skill ideas |
| **Approval workflow for proposed skills** | ✗ | Records → "skill candidates" table → UI page → click approve → agent generates SKILL.md → git commit |
| **Project-categorized skills** | ⚠ | `project_tags` field exists in records; recorder uses sparingly; needs tag-driven UI grouping |
| Skill versioning / evolution | ⚠ | Git is this; no aggregator yet showing "skill X improved over N revisions" |
| **Personalized agent ("learns how to work with you")** | 💬 | Memory + recorder already feed this; the explicit *learning loop* needs design — how does an agent change behavior based on accumulated preferences? |

**Discussion needed:** What's the approval surface — a sidebar in `/memory`, a separate `/skills` page, an inline "approve this skill?" button on a record? How aggressive should the curator be — proposes daily? on-demand? after N records of the same project_tag?

---

## Pillar 3 — Observability (full system)

Three sub-sections. All live under `/dashboard` (or a sibling tab) on humancensys.com.

### 3a. Agent comms observability

How agents talk to each other in multi-agent flows. **What's slow, what's expensive, where context isolation is or isn't holding.**

| Capability | Status | Notes |
|------------|--------|-------|
| Per-thread checkpoints in Postgres | ✓ | LangGraph `AsyncPostgresSaver` |
| `query_db` tool exposes those to the agent | ✓ | Agent can answer "how many threads today?" |
| LangSmith integration | ⚠ | Env vars wired; off by default. Turn on for trace visualization. |
| **Agent-to-agent call tracing** | ✗ | When orchestrator → planner → researcher, where does time go? Needs span tracking. |
| **Token cost per agent / per skill** | ✗ | Aggregate by model + skill. Critical for cost intuition. |
| **Context-isolation audit** | 💬 | Verify agents only see what their `Reads` contract permits — needs instrumentation in deepagents itself or a wrapper |

### 3b. Grafana section

| Capability | Status | Notes |
|------------|--------|-------|
| Grafana service running | ✓ | Local at `:3001`, anonymous editor mode |
| Postgres datasource auto-provisioned | ✓ | |
| Iframed at `/dashboard` in web UI | ✓ | |
| **Pre-provisioned dashboards** (conversation activity, skill usage, latency) | ✗ | Currently empty — Liz authors as she explores |
| Grafana on Render alongside the api | ✗ | When platform is on Render: a sibling Web Service for Grafana. Or skip and use Grafana Cloud free tier. |

### 3c. Knowledge library

A **personal knowledge graph** that grows from sessions, decisions, and discoveries. Modeled on [`PROVES_LIBRARY`](C:/Users/Liz/PROVES_LIBRARY/) (Liz's own project for engineering teams):

> *Sources → AI Extraction → Engineer Review → Knowledge Graph → Team Queries*

| Capability | Status | Notes |
|------------|--------|-------|
| Records extracted from chats | ✓ | LanceDB semantic memory holds them |
| **Couplings / relations** ("X depends on Y", "Z connects to W") | ✗ | Records currently flat; no graph edges |
| **Human review before promotion to canon** | ✗ | PROVES pattern: agent extracts → Liz approves → enters shared truth |
| **"Canon" vs. "extracted" distinction** | ✗ | LanceDB has all extractions; need a reviewed-and-canonical layer |
| **Graph queries** ("show me everything connected to deploy") | ✗ | Currently semantic similarity; not graph traversal |
| Integration with PROVES_LIBRARY itself | 💬 | Mirror the architecture? Share storage? Cross-link? **Discuss before execution** |

**This is the largest sub-pillar by far.** Requires a careful design conversation before any code. PROVES_LIBRARY uses Supabase + curator-agent + extraction-api + curation_dashboard — components Make_Skills could mirror, share, or replace.

---

## Site-level UX

The chat UI at humancensys.com currently has three tabs: **Chat / Memory / Dashboard**. The roadmap implies a richer top-level navigation:

```
humancensys.com
├── /                    Chat (current)
├── /agents              Pillar 1 — Build & manage agents
│   ├── /agents/build    Cook a new agent
│   └── /agents/library  Drop-down of pre-built
├── /skills              Pillar 2 — Skill workshop
│   ├── /skills/active   Skills currently loaded
│   ├── /skills/proposed Curator-suggested skills awaiting approval
│   └── /skills/build    Co-author with an agent
├── /observability       Pillar 3 — All three sub-sections
│   ├── /observability/agents     3a. Agent comms
│   ├── /observability/grafana    3b. Iframed Grafana
│   └── /observability/library    3c. Knowledge graph
└── /memory              (existing) Semantic recall — folds into 3c eventually
```

**Discussion needed:** Does `/memory` survive as a separate tab once `/observability/library` exists, or fold in?

---

## Discussion queue (nothing executes from this list without explicit go)

Liz wants to discuss before execution. In rough priority:

1. 💬 **Knowledge library architecture** (Pillar 3c) — how does Make_Skills's knowledge graph relate to PROVES_LIBRARY? Mirror? Share Supabase? Cross-link via MCP? **Largest decision in this roadmap.**
2. 💬 **Curator + approval workflow** (Pillar 2) — surface, cadence, what gets generated on approval
3. 💬 **Agent cooking UX** (Pillar 1) — form vs. chat-driven vs. both, model registry approach
4. 💬 **Personalized agent learning loop** (Pillar 2) — concrete mechanic for "agent learns how to work with you"
5. 💬 **Context-isolation audit** (Pillar 3a) — instrumentation strategy

---

## Independent next-actions (no discussion needed, ready to execute when Liz says go)

- Render deployment via existing `render.yaml` blueprint (covered in [`platform/RENDER.md`](platform/RENDER.md))
- Backfill remaining Claude Code projects (`Knowrg`, `PROVES-LIBRARY`, `Patent`, etc.) into LanceDB memory
- Pre-provisioned Grafana dashboards (conversation count, skill usage, recorder volume)
- Grafana on Render as a sibling service when the api is up there
- Custom subdomain `agent.humancensys.com` once Render is live

---

## Cross-references

- [`AGENTS.md`](AGENTS.md) — root orchestrator persona
- [`deepagents.toml`](deepagents.toml) — agent runtime config
- [`platform/RENDER.md`](platform/RENDER.md) — hosting walkthrough
- [`skills/`](skills/) — current skill library (7 skills)
- [`subagents/`](subagents/) — planner + researcher
- [`MCP.md`](MCP.md) — active and documented MCP servers
- `C:/Users/Liz/PROVES_LIBRARY/` — knowledge library reference (Liz's own project)
