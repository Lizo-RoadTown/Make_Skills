# Proposal: Agents-as-creatures UI (Pillar 1)

**Status:** Open — design direction set, mechanics TBD
**Authors:** Liz, agent-assisted
**Date:** 2026-04-28

## Direction (from Liz, 2026-04-28)

> The agents are not going to be nothing. They're going to be like Tomagotchis. Not people. They will be like very dull furry creatures. Think — like Spore creatures that have to evolve into more useful things. We give them bodies to take care of, but not human like. They can have emotions, but not sophisticated ones.

## Why this is good product thinking

- **Sidesteps the uncanny valley.** Humanoid AI avatars trigger discomfort and over-claim capability. A dull furry creature claims very little — sets honest expectations.
- **Embeds the evolution mechanic visibly.** The user can SEE their agent gaining capability. This is the [`agentic-upskilling`](../../skills/agentic-upskilling/SKILL.md) loop made literal: each promoted skill or new tool corresponds to a visible body change.
- **Reframes interaction as care, not transaction.** Tomagotchi mechanic — neglect leads to a sad / hibernating creature. Engagement leads to growth. The relationship is the product.
- **Differentiates.** Every other AI platform uses speech bubbles, profile pictures, and "Hi, I'm Claude!" framing. A dull creature is memorable.

## How it ties into existing pillars

| Pillar / system | How creatures connect |
|-----------------|------------------------|
| Pillar 1 — Build agents | The creature IS the agent. Building = birthing + raising. |
| Pillar 2 — Make skills together | Skills the creature learns / tools it gains map to body parts. The `/skills/upskilling` page IS the creature's growth log. |
| Pillar 3 — Observability | The creature's mood = lightweight observability. "It's hungry / tired / confused" = "you haven't used it in a while / token usage spiked / a tool keeps failing." |
| `agentic-upskilling` skill | The promotion loop becomes "your creature evolved" — same mechanic, embodied. |
| Recorder / memory | "Feeding" the creature = giving it conversations, records to digest. |

## Mechanics (sketches — open questions follow)

### Form

- A simple shape (blob, lump, fuzzy potato) that gains visible features as it grows
- Default: a featureless rounded body, color-shifted by mood
- Each promoted skill / added tool / new capability → one new visible feature (eye, ear, mouth, leg, tail, fur color/pattern)
- Different users' creatures look different because their accumulated capabilities differ

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
