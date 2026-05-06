# Proposal: Guide Module

**Status:** Open — design discussion. Sibling to portable-student-identity.
**Authors:** Liz, Claude
**Date:** 2026-05-05

## Architectural framing

The guide is the student's persistent personal AI companion — the central character of their experience across every Make_Skills surface. The portable-student-identity proposal specified its data shape (`student_guide_state` table, what's exportable, the LanceDB shard). This proposal specifies the **module that runs the guide** — the code, endpoints, and pipeline that make it speak, learn, and remain consistent across surfaces.

The guide is its own module, not a feature of any surface. The wizard plugs into it. Chat plugs into it. Quests will plug into it. Each surface contributes signal; the guide synthesizes; the guide responds. The module is built deliberately, the same way the agent runtime is built deliberately.

The student's relationship to the guide is symbiotic and ambient. They never see the module's mechanics — no XP bars, no "your guide grew today" notifications, no "what the guide knows" inspector forced as a navigation step. They feel the result: a companion that knows them, anticipates them, references their past work, and stays consistent across every page.

## Module shape

Six components, each one a discrete piece of work that can land independently:

1. **`/guide/respond` endpoint** — the speech act. Takes surface context, returns dialog text.
2. **System knowledge index** — the "how the platform works" corpus the guide queries to answer questions in-flow.
3. **Personal memory pipeline** — the existing LanceDB tenant memory, queried for guide responses with tenant scope.
4. **Signal extractor** — the background process that watches student activity and writes distilled observations to LanceDB.
5. **Guide state synthesizer** — periodic background task that re-summarizes the student's portrait into `student_guide_state.personality_md`.
6. **Voice / tone layer** — how the guide speaks. Configurable by the student (their named guide, their chosen voice setting), constrained by a base style guide.

Each component is detailed below.

## 1. `/guide/respond` endpoint

The single speech act. Every surface that needs the guide to say something hits this endpoint.

### Request shape

```
POST /guide/respond
{
  "surface": "wizard.brain.greeting" | "wizard.skill.field_focus" | "chat" | "quest.intro" | ...,
  "context": {
    // surface-specific freeform context — e.g.:
    // { "field": "description" } for field-focus
    // { "choice": "anthropic" } for a brain pick
    // { "user_message": "..." } for chat
  },
  "thread_id": "..."  // optional — for chat continuity
}
```

### Response shape

```
{
  "text": "...",
  "tone_hint": "speaking" | "thinking" | "reacting",  // for character animation
  "memory_writes": [...]  // signal events extracted from this turn (debug only)
}
```

Streamed via SSE for chat-like surfaces; single-shot JSON for short reactions.

### What it does internally

1. Resolve the calling tenant (Pillar 0).
2. Load `student_guide_state` for the tenant — name, voice, personality summary.
3. Retrieve relevant rows from LanceDB:
   - Personal memory scoped to `tenant_id`, semantically similar to the surface context.
   - System knowledge (any tenant), semantically similar to the surface context.
4. Compose an LLM prompt: voice + personality summary + retrieved memory + retrieved system knowledge + surface context.
5. Call the LLM (default Claude Sonnet, but provider is configurable per deployment via env).
6. Stream the response back.
7. Fire-and-forget: send the (surface_context, response_text) to the signal extractor for memory writes.

### What it does NOT do

- It does NOT call any tools. The guide *speaks*; it doesn't *act*. Tool-call agents are separate (the student's built agents handle execution).
- It does NOT decide whether to speak. Surfaces decide when to call it; the endpoint always responds when called.
- It does NOT manage conversation history. `thread_id` is for chat continuity (loading prior turns); other surfaces are stateless one-shots.

## 2. System knowledge index

A LanceDB collection (separate from personal memory) holding "how the platform works" content. The guide queries it when the student asks help-shaped questions in-flow ("what's PROBE for?", "why pick HuggingFace?", "what do skills do?").

### What goes in

- `docs/concepts/*.md` — concept explainers (persona, skill, agent, quest, etc.)
- `docs/proposals/*.md` — architectural decisions (so the guide can answer "why does this work this way?")
- A FAQ file curated for student questions (`docs/faq/*.md`) — the kinds of things students actually ask the guide.
- The wizard's step descriptions (so the guide can explain what the student is currently doing).

### Indexing pipeline

A script (`scripts/index-system-knowledge.py`) chunks the markdown, embeds via the same embedding model used for personal memory (consistent vector space), writes to a `system_knowledge` LanceDB collection. Run on every deploy as a CI step. Idempotent.

### Tenant scoping

System knowledge is **NOT** tenant-scoped (it's the platform's knowledge, same for everyone). Personal memory **IS** tenant-scoped. The guide query merges retrievals from both — system rows + personal rows — into one prompt context.

## 3. Personal memory pipeline (already exists, document the contract)

LanceDB is already wired (`platform/api/memory/`). What the guide needs:

- **Read**: the existing `memory_search(query, tenant_id, limit, ...)` function. The guide uses this to pull personal context for each `/guide/respond` call.
- **Write**: the existing `record_turn(...)` recorder runs after `/chat` calls. The guide module adds a sibling writer for non-chat surfaces (wizard signal, quest signal).

No new infrastructure here — the guide module USES the existing pipeline. Documenting the dependency.

## 4. Signal extractor

A background task that runs after every guide-touched activity and writes distilled observations to LanceDB.

### When it runs

- After every `/guide/respond` call (fire-and-forget).
- After every wizard step completion (signaled by the wizard hitting a `POST /guide/observe` endpoint).
- After every quest completion (Section 2, future).

### What it extracts

Not raw activity (LanceDB would balloon with noise). Distilled observations — patterns, preferences, anomalies. Examples:

- "Student writes terse personas (avg 12 words across 3 builds)."
- "Student gravitates to Loom starter (3 of 4 hatches)."
- "Student went deep on PROBE in their second skill, after going shallow in their first."
- "Student asked about Hugging Face provider twice without picking it."

### How it extracts

A small LLM call (Haiku-class, cheap) per observation event. Prompt: "You are observing a student building things. Look at this activity and write 1-3 short observations about HOW they build. Don't describe what they built — describe their style." Output goes into LanceDB with `record_type='guide_observation'` and `tenant_id` scoping.

### Why a separate extractor (vs. just storing raw activity)

Two reasons:
- Retrieval quality. Distilled observations retrieve cleanly when the guide queries "what is this student like." Raw activity retrieves messily.
- Privacy + portability. Distilled observations are small, exportable, and inspectable. The student's full activity log is not what they'd want to carry around.

## 5. Guide state synthesizer

Periodic background task (e.g. once per day, or on-demand triggered by significant events) that reads the student's recent observations from LanceDB and writes a refreshed `student_guide_state.personality_md`.

### Why this exists

`/guide/respond` doesn't need to retrieve every observation every time. The synthesizer pre-bakes a top-level summary that gets injected into every prompt. This is the "high-resolution who is this student" layer; observations are the "low-resolution recent details" layer.

### Output shape

`personality_md` is markdown, ~500-2000 words, structured:

```
## Building style
- Tends toward terse personas; recent shift toward more detailed.
- Strong preference for Loom and Cube starters (structural shapes).
- Goes deep on PROBE; shallower on REPORT.

## Tools and providers
- Has tried Anthropic and Hugging Face; settled on Anthropic for skill-heavy agents.
- No interest yet in Together or Together Cohere.

## Pacing
- Builds in long sessions (~45 min); doesn't return to edit afterward.
- Prefers worked examples to blank slates.

## Open questions
- Hasn't named their guide yet (working name still active).
- Hasn't completed any quests.
```

The synthesizer has a prompt that turns the most recent N observations + the prior `personality_md` into a fresh version. Diff-aware: it keeps things that are still true, updates things that have shifted.

### Frequency

- On-demand: when N new observations have accumulated since last synthesis (default N=10).
- Daily fallback: even if not many new observations, refresh once a day so older summaries don't stale.

## 6. Voice / tone layer

How the guide speaks. Two layers:

### Base style (platform-owned)

A prompt-template fragment that constrains every guide LLM call:

- Plain, direct prose. No marketing language. No self-congratulation.
- One thought per sentence. Short paragraphs.
- The guide acknowledges what the student did; it doesn't praise them.
- No "Great choice!" or "Excellent question!" verbal tics.
- Reference past work when relevant. Don't fabricate references.

This is the same tone discipline already in the documentation memory — applied to runtime guide speech.

### Student-customizable (per tenant)

Stored in `student_guide_state.voice_setting`. Discrete options at first:

- `dry` — Lily-from-Duolingo dryness. Default for new accounts.
- `warm` — friendlier, uses the student's name more often.
- `neutral` — minimal personality, just informative.

Each value maps to an additional prompt-template fragment appended to the base style. Future: free-form voice description ("sound like a patient librarian").

### Guide name

`student_guide_state.guide_name`. Used in self-reference where it makes sense ("I'd suggest..." vs "Pilcrow would suggest..."). Default: empty until the student names it. Wizard asks for a name on first contact (low-friction, skippable).

## API surface (full list)

```
POST /guide/respond                  → the speech act
POST /guide/observe                  → surface signals an activity for extraction
GET  /guide/state                    → returns student_guide_state for the calling tenant
PATCH /guide/state                   → student updates name / voice
GET  /guide/portrait                 → returns personality_md (the "what the guide knows about you" view, OPTIONAL surface)
POST /guide/forget                   → student deletes specific observations or wipes the portrait
```

`/guide/forget` matters for the symbiotic-not-surveillance principle — students can curate what the guide remembers.

## Frontend usage

The wizard's current scripted reactions become a fallback path. Live behavior:

```typescript
// In a wizard scene component:
async function reactToChoice(choice: string) {
  const r = await fetch('/api/guide/respond', {
    method: 'POST',
    body: JSON.stringify({
      surface: 'wizard.brain.choice',
      context: { choice }
    })
  });
  const { text } = await r.json();
  setDialogText(text);
}
```

If `/guide/respond` is slow or fails, fall back to the scripted reaction strings already in the wizard. The student should never see a blank dialog box waiting on the network.

The Dialog component already supports text changes; no UI changes needed.

## Migration path

Order of build, smallest first:

1. **System knowledge index** — `scripts/index-system-knowledge.py` + LanceDB collection. No endpoints yet. Verifies the indexing path works.
2. **`/guide/respond` v1** — basic prompt: voice base style + retrieved system knowledge + surface context. No personal memory yet, no signal extraction. Wizard wires it in for one surface (skill.field_focus) as a proof.
3. **Personal memory hookup** — extend `/guide/respond` to also retrieve from the existing personal LanceDB. Uses the existing recorder for chat-derived signal.
4. **Signal extractor** — `/guide/observe` endpoint + Haiku-powered observation writer. Wizard starts calling it on step completions.
5. **Guide state synthesizer** — periodic task + `student_guide_state` writes.
6. **Voice / tone layer** — settings page for name + voice; prompt-template plumbing.
7. **`/guide/portrait` surface** — optional inspector for the student. Build last; design is delicate (don't surface mechanics in a way that breaks symbiosis).
8. **`/guide/forget`** — student-controlled forgetting. Required before any "see the portrait" surface ships, so it's not surveillance-shaped.

Steps 1-3 are the smallest viable smart-guide. Steps 4-5 make it actually learn. Steps 6-8 are polish + control.

## Costs and provider choice

Every guide response is an LLM call. At a few-hundred-students scale this is meaningful but not crippling. Considerations:

- **Default model**: Claude Sonnet for `/guide/respond`. Quality matters for the central UX.
- **Signal extractor**: Haiku-class. High volume, low quality bar.
- **Synthesizer**: Sonnet. Periodic, low frequency, output matters.
- **Provider switchability**: the guide module itself uses `model_registry.py` so a deployment can swap providers via env. Self-hosters who don't want paid API costs can point the guide at Ollama.

This connects to portable-student-identity Commitment 1: the guide module is LLM-agnostic. The student's experience doesn't change when the deployment swaps providers; only cost and latency do.

## What this proposal does NOT cover

- **Multiplayer guide interactions** — when two students with their own guides collaborate, what does that look like? Future proposal.
- **Guide-to-agent handoff** — when the guide says "let me have your research-agent look this up," how is that wired? Pillar 1B territory; this proposal assumes the guide can call the student's built agents but doesn't specify the protocol.
- **Procedural creature engine for the guide's own avatar** — the guide currently has a generic SVG character. Eventually it should have its own evolving look like the student's built agents do. Separate concern.
- **The "portrait" surface UX** — `/guide/portrait` is listed as an endpoint here, but the page that shows it (and its forgetting controls, its tone, its placement) is a UX concern. Separate proposal when ready.

## Open questions

- **System knowledge granularity** — chunking strategy for `docs/`. Per-paragraph? Per-section? Affects retrieval quality. Recommend per-section with overlap; iterate based on retrieval logs.
- **Observation event format** — structured (slug + payload) vs. freeform text? Structured is cheaper to query later. Recommend structured.
- **First-contact name prompt** — should the guide ask for a name on Day 1, or wait until it's earned signal? Hybrid: working name "Pilcrow" assigned silently, gentle "want to rename me?" prompt after the first agent is built.
- **Portrait visibility default** — opt-in or opt-out? Symbiosis principle says it shouldn't be navigation-forced; a quiet "see what I know" link in settings is enough.
