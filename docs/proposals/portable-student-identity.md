# Proposal: Portable Student Identity

**Status:** Open — design discussion. Foundation for Pillar 1B.
**Authors:** Liz, Claude
**Date:** 2026-05-02

## Architectural framing

The guide is a persistent personal AI companion — same pattern as Jarvis or Cortana. It accumulates the student's history (every agent built, skill written, quest run), maintains a continuous identity across every surface, and exports with the student to a new account.

**The guide is its own module, built out as a first-class system** — not a feature of the wizard, not a UX device. It's built deliberately, sibling to the agent builder, the way Claude Code itself is a built-out system. The agent builder plugs into the guide module (calls it for choice-aware reactions, writes signal to it, reads its state). The guide module is independent: it has its own persistence, its own LLM-call layer, its own memory pipeline, its own export surface. The wizard and the guide are co-built and evolve together, but they are distinct modules.

The student's relationship with the guide is symbiotic and ambient. The student does things they care about — build agents, take quests, learn skills. The guide grows from that activity in the background. The mechanism is never surfaced to them: no "level up your guide" UI, no XP bars, no progress meters tied to the guide. Student-facing language treats the guide as just-there. Internally, engineering and design treat the guide as the precious artifact and protect it with persistence, memory, and export decisions.

This proposal specifies the data architecture that makes the guide persistent and portable without asking the student to manage it. The full guide-module specification (LLM-call layer, memory pipeline, signal extraction, voice/persona model) is a separate proposal to follow.

## Problem

Make_Skills is built around the principle that the student's "trained AI" travels with them through life. That principle has technical implications the current architecture only partially supports:

- The wizard built in `wizard-section1` (PR #14) persists agent drafts to `localStorage`. Browser-bound, deployment-bound, lost on cache clear.
- There is no `user_agents` table. Built agents have no persistent home.
- The guide character at the bottom of the wizard is stateless scripted dialog. It cannot remember the student between sessions, let alone be exported.
- LanceDB is tenant-scoped (Pillar 0) and active for memory, but no schema yet binds the student's *identity* to it as a portable artifact.
- No `/export` or `/import` API exists. Without these, "AI travels with them" is aspiration, not implementation.

Building Pillar 1B (the agent runtime) without first nailing the identity model risks retrofitting export support later — which usually means fields are forgotten and bundles end up incomplete.

## Decision: design student identity as an exportable bundle from day one

Six commitments shape every persistence and identity decision.

### Commitment 1 — Student identity is decoupled from the LLM

The "brain" is a swappable component. Provider choice is a foreign-key-pointed setting, not a discriminator on persistence. Switching from Claude to Gemini changes the inference engine; the student's memory, skills, tools, and guide stay intact.

### Commitment 2 — Identity is portable; export is first-class

`/export` and `/import` exist from day one, even if export is initially internal-JSON-only. Designing them last means designing them wrong.

### Commitment 3 — The base agent (the guide) is Claude-Code-shaped

The student inherits the orchestration capability stack: MCP servers, LanceDB access, subagent orchestration, tool use. They don't build that capability in the wizard; they build *specialized subagents* the guide orchestrates between.

### Commitment 4 — Two parallel growth tracks

- **Platform self-updates** (push-based): new MCPs, bundled skills, providers, presets flow to every student's guide automatically.
- **Guide self-teaches** (pull-based, per student): every interaction writes signal to LanceDB; the guide synthesizes a model of this student over time.

### Commitment 5 — Hard line between platform-owned and student-owned data

| Platform-owned (NOT exported) | Student-owned (IS the export bundle) |
|-------------------------------|--------------------------------------|
| MCP server registry           | Built agents                         |
| Bundled skills (`skills/`)    | Authored skills                      |
| Model provider list           | Integrations (the connection map)    |
| System knowledge / docs       | LanceDB personal memory              |
| Bundled subagent presets      | Guide's customized state             |
| Substrate code                | Quest history                        |

Re-fetched on import to any deployment vs. carried with the student.

### Commitment 6 — Backward-compat at the data layer

A year-old skill still works tomorrow. A saved agent doesn't break when a model is deprecated (graceful fallback or visible warning, never silent break). Platform updates are *additive* to the student experience.

## The guide is the central character (not a UX device)

The student is the player. The agents they hatch are the curriculum. The **guide is the companion they're really building** — through every wizard run, every quest, every conversation.

This means:
- The guide has its own persisted state (name, voice/tone setting, learned-personality summary, growth log).
- The guide's portrait of *this specific student* is the most precious thing in the export bundle. Skills are markdown — replicable. Built agents are configs — replicable. The guide's accumulated understanding of THIS person is not.
- Wizard reactions in the smart-guide era come from the guide's learned state, not scripted strings: *"I notice you keep going sparse on personas — want to push it richer this time?"*

## Schema: the Portable Identity Bundle

Six tables, all tenant-scoped (Pillar 0 RLS), plus the LanceDB shard.

### `user_agents`
The student's stable. Each row is one built agent.
```
id              uuid PK
tenant_id       uuid FK → tenants.id
name            text          -- student-given
starter         text          -- "orb" | "cube" | "spark" | "loom"
provider        text          -- LLM provider slug at time of build
model           text          -- model identifier
persona         text          -- the "idea" — system prompt
created_at      timestamptz
deleted_at      timestamptz   -- soft delete; export filters
```

### `student_skills`
Authored skills. The portable markdown the student wrote.
```
id              uuid PK
tenant_id       uuid FK
agent_id        uuid FK → user_agents.id (NULL if standalone)
name            text          -- short identifier
description     text          -- the LLM's "when to use this" line
body_md         text          -- the full SKILL.md body
created_at      timestamptz
```

### `student_integrations`
The connection map — what's wired, NOT the auth tokens.
```
id              uuid PK
tenant_id       uuid FK
agent_id        uuid FK
mcp_server_slug text          -- references platform MCP registry by slug
config_json     jsonb         -- non-secret config only
```
Auth tokens / secrets stored separately in `student_secrets` (encrypted, NOT exported as plaintext — export emits a manifest of "these connections existed; you'll need to re-auth on import").

### `student_secrets`
BYO API keys per provider, encrypted at rest. Not exported as plaintext.
```
id              uuid PK
tenant_id       uuid FK
provider_slug   text          -- "anthropic" | "openai" | etc.
encrypted_value bytea         -- libsodium / pgcrypto
created_at      timestamptz
```

### `student_guide_state`
The guide's persisted identity for this student. Singleton per tenant.
```
tenant_id        uuid PK FK
guide_name       text          -- student-given (or working name)
voice_setting    text          -- "dry" | "warm" | "neutral" | etc.
personality_md   text          -- guide's learned-portrait of the student, periodically refreshed
created_at       timestamptz
updated_at       timestamptz
```

### `student_quest_log`
(Section 2 territory; included for completeness — quests level the guide.)
```
id              uuid PK
tenant_id       uuid FK
quest_slug      text
agent_ids_used  uuid[]        -- which built agents participated
outcome         jsonb         -- structured result
completed_at    timestamptz
```

### LanceDB shard (already exists, tenant-scoped)
The free-form personal memory: every interaction's distilled signal. The guide's actual understanding lives here. Export includes a JSON dump of all rows where `tenant_id = $student`.

## Export bundle format

JSON envelope plus optional binary attachments. v1 is JSON-only.

```json
{
  "schema_version": 1,
  "exported_at": "2026-05-02T14:00:00Z",
  "source_deployment": "make-skills.humancensys.com",
  "student": {
    "guide": { "name": "...", "voice_setting": "...", "personality_md": "..." },
    "agents": [ /* user_agents rows */ ],
    "skills": [ /* student_skills rows */ ],
    "integrations": [
      { "mcp_server_slug": "...", "config": {...}, "needs_reauth": true }
    ],
    "memory": [ /* LanceDB rows, with embeddings dropped — re-embedded on import */ ],
    "quest_log": [ /* student_quest_log rows */ ]
  },
  "platform_dependencies": {
    "mcp_servers_referenced": ["github", "context7", ...],
    "providers_referenced": ["anthropic", ...],
    "bundled_skills_referenced": []
  }
}
```

`platform_dependencies` lets the importing deployment warn the student up-front about missing capabilities ("the new deployment doesn't have MCP server X — three of your agents reference it"). The bundle imports anyway; affected agents get a visible warning state.

## API endpoints

```
GET  /export              → returns the bundle JSON for the calling tenant
POST /import              → accepts a bundle, validates, writes rows scoped to the calling tenant
GET  /export/preview      → bundle summary without the full payload (sizes, counts, dependencies)
```

Tenant-scoped via Pillar 0 — the calling tenant is the only one that can export themselves or import into themselves.

## Migration path

What's needed to make this real, in order:

1. **Schema migrations** for the six tables (Python source of truth in `platform/api/migrations.py`, mirrored in `web/db/schema.ts`).
2. **`/export` and `/import` endpoints** as the FIRST endpoint added — even if internal-only, it forces the data model to be correct.
3. **Wizard backend wire-up**: replace localStorage in `WizardShell` and `SaveScene` with `POST /agents/create` (writes `user_agents`, `student_skills`, `student_integrations` rows in one transaction).
4. **`student_secrets` BYO key UI** before the wizard's Brain step is meaningful — student pastes their API key, encrypted at rest, the agent runtime reads it via `student_secrets` lookup.
5. **`student_guide_state` minimal persistence** — guide name + voice setting persisted from a settings page; learned-personality summary populated by a periodic background task that reads LanceDB rows for the tenant.
6. **Per-student agent runtime selection in `/chat`** — when the student "chats with their agent," `/chat` loads the agent's persona + skills + integrations + the tenant's secrets, builds a deepagents instance with that config.
7. **Guide-as-LLM-call** — `/guide/respond` endpoint pulls personal memory from LanceDB + system knowledge from a separate index + surface context, returns dialog text. Wizard's scripted reactions become a fallback path only.

Order matters: 1-3 unblock real persistence; 4 unblocks the runtime; 5-7 deliver the smart guide.

## What this proposal does NOT cover

- **Section 2 quest mechanics** — out of scope; this proposal includes `student_quest_log` only as a placeholder so quest results are exportable when Section 2 lands.
- **Multiplayer / Section 3** — sharing identity across students, group quests, etc. Future proposal once solo loop is solid.
- **System knowledge index** — the docs/FAQ corpus the guide queries for help answers. Separate proposal.
- **Procedural creature engine** — the evolved-avatar component currently uses deterministic marks; the procedural engine that gives each student's creature a truly unique form is a separate concern. The bundle includes `starter` + skill metadata so the engine has what it needs at re-render time.

## Open questions

- **Encryption key management for `student_secrets`** — pgcrypto with a deployment-level key, libsodium with a per-tenant key, or external KMS? Affects export semantics: per-tenant key means export can't include secrets even encrypted (key doesn't travel). Deployment-level means secrets stay deployment-bound (probably fine — re-auth on import is the right UX anyway).
- **Versioning of `student_skills.body_md`** — students will revise. Snapshot history vs. live edit? Recommend live edit + git-like history table when needed.
- **Soft-delete vs. hard-delete on agent retirement** — see existing `agent-retirement-and-clan-optimization.md` proposal; align with whatever it concludes.
- **Guide identity at first contact** — does the guide arrive named ("default name: Pilcrow, rename me?") or unnamed ("I don't have a name yet — give me one or wait until you've shown me enough")? UX call.
