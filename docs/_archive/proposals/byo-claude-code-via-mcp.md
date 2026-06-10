# Proposal: BYO Claude Code via MCP

**Status:** Open — needs decision on auth model and scope
**Authors:** Liz, agent-assisted
**Date:** 2026-04-28

## Problem

Liz wants other people to "play with" the Make_Skills platform — the agents, the memory, the skills, the observability — but **she doesn't want to pay for their inference**. If users sign up for humancensys.com and their chats run against her Anthropic API key, costs balloon as the project gains attention.

Equally, Liz wants users to test the platform *before* the agent-cooking UI (Pillar 1) is built, so they can give early feedback. They need a way in NOW.

## Insight

Claude Code (Anthropic's CLI / VS Code extension) is already a Claude API client running on the user's machine, paid for by the user (or their org). It already supports **MCP servers** as a way to extend its capabilities — see the existing `.mcp.json` in this repo for the LlamaIndex docs MCP we already wire up.

If the Make_Skills platform exposes itself as an **MCP server**, then:

- Users add it to their own Claude Code config
- Their Claude Code uses *their* API key for inference
- The platform provides skills, memory, roadmap, knowledge graph, observability **as MCP tools**
- The platform pays for storage + DB + LanceDB only — not for inference
- Each user's data is tenant-scoped via auth

This is the same pattern Anthropic, Vercel, Linear, GitHub, Stripe etc. use: be an MCP server, let users bring their own model. It's the **interim** for Pillar 1 ("Build agents") because the user's "agent" is just their Claude Code talking to our MCP, not a custom agent we host.

## What the platform exposes as MCP tools

A subset of what the in-process deepagents agent already has:

| MCP tool | Backed by | Use |
|----------|-----------|-----|
| `recall` | LanceDB semantic memory | Pull relevant prior records into the user's Claude Code context |
| `query_db` | Postgres (read-only, tenant-scoped) | SQL queries against the user's tenant data |
| `roadmap_overview`, `update_roadmap_status`, `add_roadmap_item` | ROADMAP.md (per-tenant) | The user's Claude Code can update their roadmap directly |
| `list_skills`, `load_skill` | `skills/` library | Discover and pull in platform skills |
| `list_subagents` | `subagents/` | See available specialist agents (read-only initially) |

Future tools (Pillars 2 + 3):

| MCP tool | Adds |
|----------|------|
| `propose_skill` | Curator-extracted skill candidates the user can review/approve |
| `kg_search` | Knowledge graph queries (when 3c lands) |
| `kg_propose_node`, `kg_promote_to_canon` | Knowledge graph contributions with review workflow |
| `agent_invoke` | Invoke a remote subagent (planner, researcher, etc.) on the platform — runs on Liz's infra, paid by user via... ??? — open question |

## Auth: the hard part

The MCP server has to know which tenant a request is from. Three options:

### Option 1: OAuth (cleanest, more work)

User authorizes Make_Skills via OAuth (GitHub-backed for low friction). The MCP server stores a token; subsequent requests carry it. Standard pattern; matches the Vercel-MCP and other "real" MCP servers we've seen.

- Pro: secure, revocable, standard
- Pro: tenant identity is verified
- Con: requires building an OAuth flow on the platform side
- Con: not yet wired to any auth provider (decision pending — see ADR-002 and ROADMAP Pillar 0)

### Option 2: API key per tenant (simpler, less robust)

Each tenant generates a Make_Skills API key from a (future) settings page. The MCP server checks the key on each request.

- Pro: simple to implement
- Pro: revocable
- Con: requires a (future) settings UI to issue keys
- Con: less standard for MCPs in 2026

### Option 3: No auth, single shared instance (DEMO ONLY)

Users hit a public MCP with no auth; everyone shares one tenant. Useful only for a public demo / read-only docs MCP.

- Pro: zero infrastructure
- Con: no isolation; can't safely expose write tools (recall, roadmap, etc.)
- Con: not really "BYO Claude Code" — just a shared sandbox

**Recommendation:** Option 1 (OAuth) once the auth provider for the hosted mode is decided (currently 💬 in ROADMAP Pillar 0). Until then, run the BYO-Claude-Code path via Option 2 (API keys) as an interim, since it doesn't depend on the broader auth decision.

## Scope: what does "play with" allow?

Per-tool scoping decisions:

| Capability | Default scope | Why |
|------------|---------------|-----|
| Read skills | All users | Skills are platform code, public |
| Read your own memory | Tenant-scoped | Privacy |
| Write to your own memory (recorder, manual records) | Tenant-scoped | Privacy + integrity |
| Read your own roadmap | Tenant-scoped | Privacy |
| Update your own roadmap | Tenant-scoped | Same |
| Invoke remote subagents (planner, researcher) | **Restricted initially** | Inference cost — see "Cost containment" |
| Query the public knowledge commons (when 3c ships) | Public read | Whole point of a commons |
| Promote to canonical knowledge | Tenant-scoped writes; review for cross-tenant publish | Quality gate |

## Cost containment

The whole point of BYO-Claude-Code is that the user pays for inference via THEIR Claude Code. Where does the platform still incur inference cost?

- **Recorder** — runs after each chat to extract memory records, uses Haiku. Currently pays by Liz. **Decision needed:** does the recorder run for BYO users? Probably YES initially (it's cheap) but with a per-tenant rate limit. ADR-worthy when implemented.
- **Curator** — periodic lessons-learned sweeps. Lower frequency, higher cost per call. **Decision needed:** opt-in per tenant, or platform-wide?
- **Remote subagent invocation** — if user calls `agent_invoke('researcher')` and that subagent runs on Liz's infra with her API key, that's a problem. **Decision:** initially RESTRICT remote subagent invocation in BYO mode. Users wanting to delegate to a researcher subagent run that subagent locally in their own Claude Code (with the subagent's prompt + skills loaded as MCP tools, but inference on their key).

## Architecture sketch

```
┌────────────────────────────────────────────────────────────┐
│ User's local machine                                        │
│  ┌─────────────────┐                                        │
│  │ Claude Code     │ ← user pays for THIS inference          │
│  │ (VS Code ext)   │                                         │
│  └────────┬────────┘                                         │
│           │ MCP protocol over HTTPS                          │
└───────────┼──────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│ humancensys.com (Liz's hosted platform)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MCP server (mcp.humancensys.com)                     │  │
│  │   tenant = OAuth(token) or APIKey(token)             │  │
│  │                                                       │  │
│  │   tools: recall, query_db, roadmap_*, list_skills,   │  │
│  │          load_skill, kg_search, ...                  │  │
│  └────────┬─────────────────────────────────────────────┘  │
│           │ tenant-scoped queries                            │
│  ┌────────▼─────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ Postgres     │  │ LanceDB      │  │ ROADMAP per     │    │
│  │ (tenant_id)  │  │ (per-tenant  │  │ tenant_dir/     │    │
│  │              │  │  table)      │  │                 │    │
│  └──────────────┘  └──────────────┘  └─────────────────┘    │
└────────────────────────────────────────────────────────────┘

The platform's API server (FastAPI) and the MCP server share storage but
expose different interfaces. The chat UI on humancensys.com talks to the
API server (paid Liz inference); BYO-Claude-Code users talk to the MCP
server (paid user inference).
```

## What this proposal does NOT cover

- The chat UI for non-BYO users (where Liz pays inference). That's a different surface.
- Pillar 1's "build your own agents" UI. This is the INTERIM until that ships.
- Pricing / billing / abuse limits. Out of scope until tenancy lands.
- Federated MCP — running multiple Make_Skills instances that talk to each other. Out of scope for now.

## Open questions for Liz

1. Auth: OAuth (depends on the 💬 hosted-auth decision) or interim API key?
2. Recorder: run for BYO users at platform expense, or off by default?
3. Remote subagent invocation: restrict in BYO mode? Yes by default?
4. Public preview: do we offer Option 3 (read-only no-auth MCP) as a "see what it does" demo on public docs?
5. MCP transport: HTTP (works with Claude Code's existing MCP support) — confirm no exotic protocol needed.

## If accepted, becomes ADR-NNN with these specifics

- Implementation: a new FastAPI sub-app at `mcp.humancensys.com` (or `humancensys.com/mcp`) using Anthropic's MCP server SDK
- Auth: chosen option above
- Scope: tools + tenant rules from the table
- Cost containment: recorder + curator policies decided
- Tenant isolation: enforced at the storage layer (every tool call carries tenant_id from auth)

The interim path before this is live: nothing — users can't yet "play with" the hosted platform. They can self-host (which IS already supported and is the primary recommended path until BYO-Claude-Code ships).
