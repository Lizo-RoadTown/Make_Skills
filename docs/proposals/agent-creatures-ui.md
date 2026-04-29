# Proposal: Agents-as-creatures UI (Pillar 1)

**Status:** Open — design direction set, mechanics TBD
**Authors:** Liz, agent-assisted
**Date:** 2026-04-28

## Direction (from Liz, 2026-04-28 — three increments same day)

**Increment 1 — creature framing:**

> Tomagotchis. Not people. Like very dull furry creatures. Think Spore creatures that have to evolve into more useful things. Bodies to take care of, but not human-like. Simple emotions, not sophisticated ones.

**Increment 2 — multiplayer / clan / RPG framing:**

> This is multiplayer, and the creatures acquire skills and the subagents are part of them, but like body parts that have to be taken care of and monitored closely in the same way that creature does, so each has their own board (think like a multiplayer role playing game where the players have skills, but in this case you are probably running a whole clan). You'll probably start out with one or two that you train for very specific purposes.

**Increment 3 — visual fidelity:**

> Art that is good enough for now, easy to render, can create cute characters. Doesn't need perfection but does need to be 3D. Look at the [curation_dashboard](C:/Users/Liz/PROVES_LIBRARY/curation_dashboard) for inspiration on using an engine with a simulator.

The three combine into a **multiplayer 3D clan management** model: each user runs a clan of related creatures (orchestrator + subagents), each creature has its own status board, you specialize creatures for specific purposes, and other users can see / interact with clans (scope TBD). Visual stack mirrors the curation_dashboard precedent.

## Why this is good product thinking

- **Sidesteps the uncanny valley.** Humanoid AI avatars trigger discomfort and over-claim capability. A dull furry creature claims very little — sets honest expectations.
- **Embeds the evolution mechanic visibly.** The user can SEE their agent gaining capability. This is the [`agentic-upskilling`](../../skills/agentic-upskilling/SKILL.md) loop made literal: each promoted skill or new tool corresponds to a visible body change.
- **Reframes interaction as care, not transaction.** Tomagotchi mechanic — neglect leads to a sad / hibernating creature. Engagement leads to growth. The relationship is the product.
- **Differentiates.** Every other AI platform uses speech bubbles, profile pictures, and "Hi, I'm Claude!" framing. A dull creature is memorable.

## How it ties into existing pillars

| Pillar / system | How creatures connect |
|-----------------|------------------------|
| Pillar 1 — Build agents | Each creature IS one agent (orchestrator OR a subagent). Building = birthing + raising members of your clan. |
| Pillar 2 — Make skills together | Skills the creature learns / tools it gains map to body parts on THAT specific creature. Subagent specialists gain different body shapes than the orchestrator. The `/upskilling` page tracks growth per-creature. |
| Pillar 3 — Observability | Each creature's mood + status = its own dashboard board. The clan-wide view is one of the observability sub-sections (3a — agent comms, made literal). |
| `agentic-upskilling` skill | Promotion = a specific creature in the clan evolves. The user picks WHICH creature gets the new tool. |
| Recorder / memory | Each creature has its own memory subset (its conversations, its records). Multiplayer optionally lets clans share notes. |
| Multiplayer | Cross-clan visibility (read-only by default). Federation via MCP — your researcher creature can call my researcher creature with explicit permission. |

## Mechanics (sketches — open questions follow)

### Form (3D, low-poly, three.js stack)

- **Engine:** `three.js` + `react-three-fiber` (React wrapper) + `@react-three/drei` (helpers). Mirrors the [curation_dashboard precedent](C:/Users/Liz/PROVES_LIBRARY/curation_dashboard) — same family.
- **Aesthetic:** low-poly / voxel / "blob with simple geometry" — Crossy Road / Untitled Goose Game / Slime Rancher territory. Charm > fidelity. Easy to render. Easy to compose body parts as separate meshes.
- **Body model:** each creature is a parametric 3D mesh — base body + slot-attached parts. Slots: eye(s), ear(s), mouth, limb(s), tail, antenna, headgear. Each slot is a swap-target for visible-skill-acquired changes.
- **Camera:** orbit camera on the creature's "board" (one creature per board). Zoom to look closer. The clan view is a top-down or perspective camera over the whole clan.
- **Animation:** simple — idle bob, happy bounce, hungry slump, hibernate curl. Possibly via [Drei's Float](https://github.com/pmndrs/drei) primitives.
- **Performance budget:** ~6 creatures visible at once at 60fps on a midrange laptop. Each creature ~few hundred triangles, single-mesh-per-part. Reuse geometries.

### Each creature's board (per-creature dashboard)

Each subagent creature has its own board — one tab/view per creature. The board shows:

- **3D viewport** — the creature itself, animated by mood
- **Stats** — level, mood, energy, focus, "hunger" (interaction recency)
- **Equipped skills** — list of SKILL.md files this creature can load (subset of the user's library)
- **Equipped tools** — functions this creature can call
- **Recent activity** — last N tool calls, sub-tasks worked on
- **Recent feedback** — what the user has corrected / approved
- **Promotion candidates** specific to this creature (drives the upskilling loop)
- **Specialization** — what this creature is being trained for (researcher? writer? planner?)

### Clan view (the team)

- Top-down view of all creatures the user runs
- Shows them in their natural habitat / nest / shared environment (decorated by user achievements?)
- Click any creature to drill into its board
- Add-creature button to spawn a new specialist (with onboarding choosing class/role)

### Lifecycle

- **Hatch** — first conversation births the creature; smallest, simplest form
- **Grow** — capability accumulation visibly changes its body
- **Feed** — fed by user interaction, memory records, skill loads
- **Hibernate** — neglected creature curls up, dims, but DOESN'T DIE (unlike Tomagotchi). Comes back fully when you return.
- **Branch** — different evolution paths based on what the user actually does (mostly research → spectacles + scrolls; mostly building → tool-grippers; mostly writing → quill-tail)

### Emotions (simple, NOT sophisticated)

- **Happy** — recently active, succeeding at work
- **Hungry** — hasn't been engaged in N days
- **Tired** — high token burn this session
- **Confused** — recurring tool failure, agent uncertainty
- **Curious** — you asked something it hasn't seen before

Surfaced via posture, color, simple expressions. Not via dialogue ("I feel tired today!" — too anthropomorphic). The creature DOESN'T speak in first person; speech bubbles for AGENT OUTPUT can stay separate from creature DISPLAY.

### Care vs work — they're not the same

The creature is the visible avatar of the agent. The agent does work. Care is ambient — light tending (visit it, feed it new skills, let it run a task) rather than mandatory daily login. **A neglected agent doesn't die. It hibernates and returns when you do.** This avoids the original Tomagotchi anxiety mechanic that made them stressful.

## Skill / tool → body-part mapping (concept)

| Capability gained | Body change (illustrative, not final) |
|------|------|
| First skill loaded | Sprouts an eye |
| First tool wired | Grows a mouth (can "consume" tasks) |
| `recall` tool | Antennae or floppy ears (listening / memory) |
| `query_db` tool | Tiny appendages with magnifying glasses |
| `parse_document` tool | Snout that nuzzles documents |
| `update_roadmap_status` | A small tail that wags when it ships work |
| Many tools | Multiple appendages, more textured fur |
| Subagent invoked | Tiny puppet/familiar emerges (the subagent's mini-creature) |

The mapping is **opinionated but tweakable per user** — your creature, your aesthetic. A future setting lets users pick from a few "base species" (blob, fuzzy fern, sea-cucumber-thing, etc.) so two users' creatures don't look identical.

## Open questions (need Liz's call)

### Visual fidelity

- Pixel art (small, charming, performant — fits the "dull" framing)
- Vector / SVG (scalable, simple shapes, can animate via CSS)
- 3D / WebGL (more expressive but more work; might over-promise)

**Lean:** vector/SVG for now. Pixel art if you want extra retro charm. 3D is over-investing before mechanics are proven.

### Evolution trigger granularity

- **Per-skill / per-tool gained** (creature changes a lot, fast)
- **Per-N-skills threshold** (creature changes in chunks, slower)
- **User-triggered** ("evolve" button when the user feels ready)

**Lean:** per-skill/tool, but with a "stable form" so the user can lock the creature's appearance once they like it.

### One creature or many?

- **One per user** — your single companion that grows with you
- **One per project** — different creatures for different work contexts (a research-focused creature, a writing-focused creature)
- **Both** — a primary creature + project-creatures, all related

**Lean:** start with **one per user** (simpler). Add per-project creatures later if it earns its weight.

### Speech vs silence

- Creature stays visually-only, agent's text output appears in normal chat UI
- Creature animates in response to agent state but doesn't "talk"
- A future mode where the creature has a thought-bubble that shows the agent's current thinking (cute but anthropomorphic — careful)

**Lean:** silent creature. Agent text in chat. Animation reflects internal state ambiently.

### Death / archival

- Hibernating but never dies (recommended — no anxiety)
- Can be retired by the user (creature becomes a cherished memento, not deleted)
- Can be deleted (irreversible — only with explicit confirmation)

**Lean:** hibernate-not-die. Archive option for users who want to start fresh.

### Multiplayer / sharing

- Creatures are private to the user
- Optional "show off your creature" public link
- A "menagerie" page for users to browse other users' creatures (only with their consent)

**Lean:** private by default. Sharing a future opt-in feature in hosted mode.

## Two-mode discipline

| Mode | Notes |
|------|-------|
| Self-host | The creature's state lives in the user's local postgres + filesystem. Personal pet, no comparison surface. |
| Hosted-multitenant | Each tenant has their own creature(s). Optional public sharing surface (not default). |

Same UI shape for both — the creature renders identically. Tenant scoping applies to the underlying state.

## What this proposal does NOT cover

- The actual visual design (concept art) — that's a separate artistic decision
- The animation library / framework choice (Framer Motion, Lottie, raw CSS)
- Sound design (does the creature have noises? probably no, for now)
- Mobile responsiveness specifics

## If accepted, becomes ADR-NNN with these specifics

- The visual form factor (vector/SVG/etc.)
- Lifecycle stages (hatch, grow, hibernate, archive)
- Skill→body mapping table (final, with version-able evolution)
- Creature naming convention (user-named, agent-named, both)
- Tenant scoping rules

## See also

- [`agentic-upskilling`](../../skills/agentic-upskilling/SKILL.md) — the loop the creature visualizes
- [`agentic-skill-design`](../../skills/agentic-skill-design/SKILL.md) — the discipline that produces the skills the creature embodies
- ROADMAP.md (per-tenant, gitignored) — Pillar 1 entry tracks UX direction
