# Learning-tool design evaluation — 2026-04-29

## Question

What design style (or mixture) should Make_Skills adopt for its agent-builder + workspace UI, given that the platform is an academic teaching tool — built for younger students and engineering students — and an open-source-first SaaS, not a commercial developer console?

## Options on the table

- **A. Microsoft Foundry style** — single 4-field builder form (name, model, instructions, tools) with an inline 50/50 playground; one "Save" commits. Resources / Build / Monitor sidebar. Tools as a collapsible secondary panel. AI-assisted prompt writing via "Inspire me" + "Generate" buttons. (Source: screenshot shared 2026-04-29.)
- **B. Claude Console style** — first-class siblings for Sessions, Environments, Credential vaults, Memory stores, Skills. Two distinct surfaces for prompt iteration (Workbench) and agent assembly (Managed Agents → Agents). 4-step Quickstart wizard with outcome-named templates. "Get Code" everywhere as graduation ramp. Empty states with single CTA. (Source: screenshots shared 2026-04-29.)
- **C. Status quo (Make_Skills today)** — `/agents` and `/upskilling` are stub pages. `/memory`, `/observability`, `/roadmap`, `/skills`, `/docs` are working but separate. No `/agents/build` form yet. Pillar 1A model registry exists, Pillar 0 tenant abstraction landed. (Source: current `web/app/`.)
- **D. Hybrid (recommended) — Console decomposition + Foundry inline build + Make_Skills inline pedagogy** — take Anthropic's first-class resource decomposition (Sessions, Credentials, Memory, Environments as siblings); take Foundry's inline 50/50 build-and-test surface for the agent-creation form; add the layer neither console builds — inline "why this exists" pedagogy on every form field, and outcome-named templates that double as Pillar 2 quest cards.

## Dimensions that matter (and why)

- **Teaching value** — Make_Skills is a curriculum disguised as a platform. Every UI choice is a pedagogical choice. Both reference consoles assume fluent users; this is the gap.
- **Multiplayer-fit** — Pillar 2 (group quests) and Pillar 3c (knowledge commons) are explicitly multiplayer. Choices that lock the platform into single-user assumptions will hurt later.
- **Two-mode-fit** — Self-host AND hosted-multitenant from day one (ADR-002). UI choices must work in both modes without forking.
- **Effort to build** — Days vs weeks. Inverse-weighted at parity.
- **Reversibility** — Higher weight when the choice writes data shape (URLs, sidebar slots that imply future endpoints, schema implications).
- **Author / contributor experience** — Open-source contributors need clear extension points. Confusing structure burns the OSS contribution funnel.
- **Path to "Get Code" graduation** — The platform must make API/CLI graduation natural. Otherwise students stay GUI-locked.

(Considered and dropped: visual polish, animation, marketing appeal — these are noise at MVP.)

## Tradeoff matrix

| Option | Teaching value | Multiplayer-fit | Two-mode-fit | Effort | Reversibility | Contributor exp | Get-Code graduation | Total |
|--------|----------------|-----------------|--------------|--------|---------------|-----------------|---------------------|-------|
| **A. Pure Foundry** | 2 (assumes fluent users; no inline pedagogy) | 2 (single-user mental model; tools/agents as artifacts, no sessions/sharing slots) | 3 (works either way; nothing two-mode-aware) | 4 (small surface, fast to copy) | 3 (form is reversible; sidebar locks in "agent-as-noun" framing) | 3 (one form to extend) | 1 (no code-export) | 18 |
| **B. Pure Console** | 2 (assumes fluent users; great primitives but no curriculum) | 4 (Sessions / Environments / shared resources naturally extend to multi-user) | 5 (decomposition matches our PLATFORM_MODE × tenant abstraction perfectly) | 2 (many sibling surfaces — weeks of UI work) | 5 (decomposed primitives are individually replaceable) | 4 (each resource has its own page = clear extension points) | 5 (Get Code first-class) | 27 |
| **C. Status quo** | 1 (no agent builder yet) | 2 (existing pages don't surface multiplayer) | 4 (Pillar 0 is two-mode-clean) | 5 (no work) | 5 (nothing to undo) | 3 (pages exist but aren't unified) | 1 (no code-export) | 21 |
| **D. Hybrid (decomposition + inline build + pedagogy)** | 5 (inline pedagogy is the whole differentiator) | 5 (Console primitives + sharable Sessions + forkable Agents = multiplayer-native) | 5 (Console primitives mirror our tenant model 1:1) | 3 (more than Foundry, less than full Console — pick the slots that compound) | 5 (decomposed; each slot can be deferred or replaced) | 5 (each sibling slot is a clean PR boundary) | 5 (Get Code on every form) | 33 |

## Recommendation

**Option D — hybrid with deliberate sequencing.**

### Adopt from Foundry (A)

- **Inline 50/50 build-and-test layout for the `/agents/build` page** — form on the left, live playground on the right. Reason: round-trip latency between "what I configured" and "what it does" is the single biggest learning blocker for new students.
- **AI-assisted prompt writing — "Inspire me" + "Generate" buttons** — Reason: "what do I write here" is the #1 freeze point on system-prompt fields. A Haiku-powered "describe your agent in one sentence → drafts a system prompt" collapses the freeze.
- **Tools as a collapsible secondary panel** — Reason: tools modify behavior, prompts define it. Don't let tool-picking dominate the build form.
- **Bottom-pinned Help section in the sidebar** — Reason: always reachable, doesn't pollute the workflow. Already done in our sidebar.

### Adopt from Console (B)

- **First-class sidebar siblings: Sessions, Environments, Credentials, Memory, Skills, Templates** — Reason: each is a teachable concept. Burying them in submenus erases the curriculum. Direct mapping to our existing data model (LanceDB = memory store, `tenants` table = environments, `tenant_secrets` = credentials when it lands).
- **Workbench distinct from Agents** — Reason: prompts come BEFORE agents in the curriculum. Conflating them ships a confusing form.
- **Outcome-named templates as cards** (Music co-writer / Local biz site / Reproduce a paper) — Reason: cards bridge directly to Pillar 2 quests. Same surface, two doors.
- **"Get Code" toggle on every form** — Reason: graduation ramp from no-code to code is the single most important affordance for engineering students. They use the form to learn, then read the code to understand, then write the code themselves.
- **Empty states with one CTA** — Reason: decision paralysis kills younger students. One button, not three.
- **Sessions as the unit of replay-with-trace** — Reason: failure forensics is the lesson. "Why did my agent do that?" is the question every assignment will provoke.
- **Workspace switcher top-left** — Reason: a workspace IS a tenant. The switcher teaches that students can wear multiple hats (personal, classroom, public commons).

### Make_Skills original (neither console has this)

- **Inline pedagogy on every form field** — one-line "why this exists" beside the label, not in a tooltip. "Model" → "the brain — picks how your creature thinks". "System prompt" → "the rules your creature lives by". This is the single thing that makes Make_Skills a teaching tool and not a knockoff console.
- **Templates double as quest cards** — same component renders in `/templates` (Pillar 1) and `/quests` (Pillar 2). Outcome-named, integration-iconed, picks-a-starter-state.
- **Reflection prompt at session end** — when a session is closed, optionally generate a "what did you learn?" record into memory. Future sessions can `recall("what have I learned?")`. Anthropic console has nothing like this; commercial users don't need it.
- **Forkable agents** — every agent has a "fork" button when viewed in the public commons. Maps to copying `subagents/<name>/` to your own tenant.

### Reject from all options

- **Foundry's "Microsoft Foundry Resources" sub-tree** — vendor lock-in baked into navigation. Our equivalent stays mode-agnostic.
- **Foundry's Fine-tuning + Model Conversion** — out of scope for an academic platform. Students don't need to fine-tune at MVP. Revisit if quests start needing tuned models (probably never).
- **Anthropic's Batches GUI choice** — they correctly chose code-only; we agree. Don't waste UI on batch.
- **Both consoles' assumption of a fluent user** — every form needs the inline "why" treatment. This is the rejection that makes Make_Skills different.
- **Generic-named templates** ("Custom agent", "Web search agent") — every template is outcome-named, period.

## Why not the alternatives

- **Why not pure Foundry (A):** Score 18 vs 33. The "agent as artifact" framing forecloses multiplayer (no sessions slot, no sharing primitives) and forecloses the two-mode commitment (no environments). The single-form simplicity is real, but it's the wrong simplicity — it hides the curriculum.
- **Why not pure Console (B):** Score 27 vs 33. Anthropic's primitives are right, but Anthropic's UI is for fluent developers. Without inline pedagogy, students would face the same intimidation we're trying to remove. Also: Anthropic's Workbench / Agents split is correct, but their inline build surface is weaker than Foundry's — taking Foundry's form-with-live-playground there is the right combination.
- **Why not status quo (C):** Score 21 vs 33. Doing nothing is cheapest but ships zero curriculum. Pillar 1 was identified as "the most important hook" in the STEM gamified vision memory; further deferral is wrong-headed.

## Open questions

- **Workspace vs Tenant naming** — Anthropic uses "Workspace"; we've been using "Tenant" in code. Pick one for the UI. Recommended: **Workspace** is friendlier; keep "tenant" as the internal/SQL term, use "Workspace" in the UI. One-time decision.
- **Templates as a separate sidebar slot vs nested under Agents** — Anthropic nests under Quickstart; Foundry doesn't have them. Recommended: **separate slot** — Templates IS the Pillar 2 quest entry point in disguise. Worth the visibility.

## What this implies for the next action

The next concrete step is a **sidebar-architecture proposal** that locks in the slot list (Workbench, Agents, Sessions, Templates, Skills, Memory, Credentials, Environments, Observability, Manage) before any of those pages get built. Once the slots are settled, Pillar 1B can scope to one slot (`/agents/build`) without the structure shifting underneath it.

Update [agent-builder-flow.md](../proposals/agent-builder-flow.md) AFTER the sidebar proposal — its scope was 6 steps; this evaluation collapses to 4 (name, model, instructions, skills) and pushes the sidebar context up a level.
