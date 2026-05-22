# 2026-05-21 — Project-starter recommendations

Recommendations for [`Lizo-RoadTown/project-starter`](https://github.com/Lizo-RoadTown/project-starter) based on auditing what's listed in its current `agent-app` and `ui-app` variants against (a) what's actually installable from the public skill ecosystem, (b) what's in the private `skills/` stash here in Make_Skills, and (c) what's currently in [`Lizo-RoadTown/claude-skills-marketplace`](https://github.com/Lizo-RoadTown/claude-skills-marketplace).

Three concerns, in order: which of Liz's private skills to publish, what to fix in the project-starter `SKILLS.md` files, and what to add.

---

## 1. Publishing decision — which of the 14 private skills go to the marketplace

The private stash in `skills/` currently has 14 SKILL.md files. They split three ways for publishing.

### Publish as-is (6 skills)

Generic enough to ship without editing. No Make_Skills coupling beyond a few example references that don't break the skill's usefulness.

| Skill | Why publish |
|---|---|
| `agentic-skill-design` | The PROBE → DECIDE → ACT → REPORT pattern is universally applicable to any agent project. This is arguably the most valuable skill in the stash for outside users — it teaches the "agentic, not passive" distinction. |
| `design-evaluation` | Tradeoff-matrix discipline. Useful for any team making "should we use X or Y" decisions. The dimensions table is generic (just drop the two-mode-fit row when publishing). |
| `documentation` | Diátaxis + ADRs + docs-as-code. Already cites the public Diátaxis source. Ready. |
| `document-parsing` | PDF/Office decision tree (Claude native / LlamaParse / Marker). Generic. |
| `deep-research-pattern` | 3-role topology with context isolation, drawn from real public sources (NVIDIA AI-Q, open_deep_research). Already publication-shaped. |
| `eval-deep-research` | DRB harness wiring. Useful for anyone evaluating research agents. |

**Recommendation:** publish these as 6 separate marketplace entries (or bundle two or three into thematic plugins — e.g., a "research" plugin holding deep-research-pattern + eval-deep-research).

### Publish after light editing (3 skills)

Framework is portable but the prose mentions repo-specific paths or examples. ~30 min of editing each.

| Skill | What needs editing |
|---|---|
| `lessons-learned` | Remove references to `~/AppData/.../anthropic.claude-code/` specifics; generalize the transcript probe. The friction-pattern → intake-form pattern is the publishable core. |
| `next-actions-planning` | Remove `ROADMAP.md` and `docs/proposals/` hardcoded paths. Replace with "your project's roadmap / proposal source". |
| `orchestration-cataloging` | Same treatment — generalize the example tables; the pattern-detection thresholds (5+ / 3-5 / 2-3 / 1-2 uses) are the publishable core. |

### Keep proprietary (7 skills) — NOT published, NOT in public repo

These remain proprietary. As of 2026-05-21 they are moved out of the public `skills/` directory into a gitignored `skills_private/` and will not be published to the marketplace. The reasoning splits two ways:

**Strategic — the upskilling triad (3 skills):**

Together these form the continuous-improvement engine that makes Make_Skills uniquely educational. The *idea* of "agents get sharper at how you work" is not a secret. The **operational detail** — exact thresholds, decision rules, demotion logic, dogfooding surface design — is what makes it actually work. Any thoughtful reader could derive your Pillar 2 design from these three skills together.

| Skill | Why proprietary |
|---|---|
| `agentic-upskilling` | Operational discipline for Pillar 2 — skill→tool promotion criteria, demotion criteria, dogfooding surface design. The PRODUCT, not just an artifact about it. |
| `orchestration-cataloging` | Sibling skill — meta-detection layer that drives upskilling. Pattern recognition over user workflow → promotion to reusable. |
| `lessons-learned` | Third leg of the observation→learning→growth triad. Transcript-mining tool that feeds friction patterns into the loop. |

**Structural — tightly coupled to Make_Skills (4 skills):**

These are too tied to this app's specific schema, tools, or organizational structure to publish without rewriting most of the prose. The cost to generalize exceeds the benefit.

| Skill | Why proprietary |
|---|---|
| `roadmap-maintenance` | Coupled to ROADMAP.md schema and three wired-in tools (`update_roadmap_status`, etc.). Won't help anyone else's project. |
| `open-source-documentation` | Describes Make_Skills's specific docs tree, Pillar 0/1/2/3 model, two-mode commitment. Project-specific scaffolding. |
| `proposal-authoring` | Make_Skills's house style for `docs/proposals/`. Section template won't fit other repos. |
| `web-app-scaffold` | References stack-specific presets (Vercel chat UI, chainlit aesthetic) and the Make_Skills architecture (existing `platform/api`, Pillar references). Project-specific. |

**Where they live now:** `skills_private/` (gitignored, never committed). Kept locally as working files; not visible on GitHub.

**Net marketplace inventory after publishing the 7 (6 ready + 1 edited) plus the 2 already up:** ~9 skills under `Lizo-RoadTown/claude-skills-marketplace`.

---

## 2. Project-starter fixes — what's broken in the current SKILLS.md files

The current `templates/agent-app/SKILLS.md` and `templates/ui-app/SKILLS.md` were authored by recommending skill *names* the other agent thought made sense, then writing install instructions. Some of those names don't cleanly resolve to installable packages.

### `templates/agent-app/SKILLS.md` — current issues

| Current entry | Problem | Recommended fix |
|---|---|---|
| `ralph-loop` | Real, installable, but oriented around the Stop-hook iteration loop, which is a niche pattern. Most agent projects don't need it. | **Remove from defaults.** Mention in a "optional" section if Stop-hook iteration matches the project's needs. The `superpowers:executing-plans` workflow covers most multi-step agent work better. |
| `agent-memory-systems` (community) | Manual `git clone + ln -s` install. Awkward for new contributors. No marketplace entry. | **Replace with `episodic-memory:remembering-conversations`** (real, installable plugin) for runtime conversation memory. Mention CoALA / vector-store decisions as a *concept link*, not an install step. |
| `agent-orchestrator` (Context-Engineering plugin) | Real package exists, but the install path (`muratcankoylan/Agent-Skills-for-Context-Engineering`) is third-party with no review trail. The skill content is also thinner than the alternative. | **Replace with `superpowers:dispatching-parallel-agents`** + reference your own `ai-agents-architect` skill for the architectural decision. |
| `ai-agents-architect` (Liz's) | Correct. Real marketplace entry. | Keep. |
| `claude-api` (Anthropic) | Correct. Bundled with Claude Code. | Keep. |
| `portable-identity` (not a skill) | Correctly noted as a design discipline. | Keep. |

### `templates/ui-app/SKILLS.md` — current issues

| Current entry | Problem | Recommended fix |
|---|---|---|
| `ui-ux-pro-max` | Real, installable via `npm install -g uipro-cli`. Works. | Keep. |
| `design-system` (Triptease) | Clone-and-place install. Works but awkward. Skill is good but the install path is fragile. | **Augment with `figma:figma-create-design-system-rules`** when the project uses Figma. Keep Triptease as the no-Figma fallback. |
| `frontend-design` (Anthropic) | Bundled with Claude Code (or installable via `claude-plugins-official`). | Keep. |
| `onboarding-psychologist` (Liz's) | Correct. Real marketplace entry. | Keep. |

---

## 3. What to add — gaps in both variants

Both SKILLS.md files are missing skills that materially change agent quality. Recommend adding to both:

### Universal additions (both variants)

| Skill | Reason |
|---|---|
| `superpowers:brainstorming` | Mandatory before any creative/build work per its own trigger. Skipping it is how teams ship the wrong thing. |
| `superpowers:verification-before-completion` | Evidence-before-claims discipline. Matches Liz's `feedback_test_on_preview_not_local` memory rule. The single highest-leverage discipline-skill in the public stack. |
| `superpowers:writing-plans` + `superpowers:executing-plans` | For any multi-step task that needs to survive a context reset. Replaces the gap left by removing `ralph-loop`. |
| `antigravity-bundle-essentials:concise-planning` | Pairs with writing-plans; produces the "next 3 things" distillation. |
| `antigravity-bundle-essentials:systematic-debugging` | When agents stall or produce wrong output. Currently missing from the agent-app variant despite being core to agent work. |
| `antigravity-bundle-essentials:git-pushing` | Sane defaults for committing+pushing+PR-opening. Matches Liz's "always open PR via `gh pr create`" rule. |
| `antigravity-bundle-essentials:lint-and-validate` | Pre-merge hygiene. |

### Agent-app-specific additions

| Skill | Reason |
|---|---|
| `antigravity-bundle-llm-application-developer:prompt-caching` | Token economics. Make_Skills's own CLAUDE.md preaches token discipline; this skill operationalizes it across LLM calls. Currently *no* skill in either variant covers caching. |
| `antigravity-bundle-llm-application-developer:context-window-management` | Pairs with prompt-caching. Matters for any multi-turn agent. |
| `antigravity-bundle-llm-application-developer:langfuse` | Observability for agent behavior — tool-call counts, latency, error patterns. Currently missing observability story entirely. |
| `antigravity-bundle-llm-application-developer:llm-app-patterns` | Generic LLM-app patterns the variant doesn't yet reference. |
| `episodic-memory:remembering-conversations` | Replaces the manual-clone `agent-memory-systems`. Real, installable, and produces durable conversation memory across sessions. |
| `agent-sdk-dev:new-sdk-app` | Bootstrap helper for Claude Agent SDK apps. |
| `ai:building-pydantic-ai-agents` | When the agent app is Python-based. |

### UI-app-specific additions

| Skill | Reason |
|---|---|
| `antigravity-bundle-web-wizard:nextjs-best-practices` | Next.js 16 has breaking changes. The model's training data is stale. This skill is current. Critical. |
| `antigravity-bundle-web-wizard:tailwind-patterns` | Tailwind v4 uses `@theme inline` and design tokens. The model's defaults are v3. Critical for UI variants. |
| `antigravity-bundle-web-wizard:react-patterns` + `react-best-practices` | React 19 patterns. |
| `antigravity-bundle-typescript-javascript:nextjs-app-router-patterns` | App Router data-fetching and Server Components. |
| `figma:figma-implement-design` | When implementing from Figma. |
| `figma:figma-create-design-system-rules` | Replaces or augments the Triptease `design-system` skill. |
| `antigravity-bundle-creative-director:frontend-design` | Design taste, typography, layout — alternative to (or paired with) Anthropic's `frontend-design`. |
| `antigravity-bundle-creative-director:copy-editing` | UI copy quality. |
| `verify` (top-level skill) | Run the app and see the change. Matches Liz's "I have never seen anything on that screen" feedback. |

---

## 4. Suggested final shape — recommended SKILLS.md per variant

### `templates/agent-app/SKILLS.md` (recommended ~10-12 skills)

**Tier 1 — discipline (install first, always):**

- `claude-api` — Anthropic SDK reference
- `ai-agents-architect` (Liz's) — architecture decisions
- `agentic-skill-design` (Liz's, once published) — agentic vs passive form
- `superpowers:brainstorming` — before any build work
- `superpowers:writing-plans` + `executing-plans` — multi-step work
- `superpowers:systematic-debugging` — for stuck agents
- `superpowers:verification-before-completion` — evidence before "done"

**Tier 2 — LLM-app stack:**

- `antigravity-bundle-llm-application-developer:prompt-caching`
- `antigravity-bundle-llm-application-developer:context-window-management`
- `antigravity-bundle-llm-application-developer:llm-app-patterns`
- `antigravity-bundle-llm-application-developer:langfuse`
- `episodic-memory:remembering-conversations`

**Tier 3 — situational:**
- `ai:building-pydantic-ai-agents` (if Python)
- `agent-sdk-dev:new-sdk-app` (when bootstrapping)
- `superpowers:dispatching-parallel-agents` (when multi-agent is real)
- `antigravity-bundle-llm-application-developer:rag-implementation` (when RAG is in scope)

### `templates/ui-app/SKILLS.md` (recommended ~10-12 skills)

**Tier 1 — discipline:**

- `onboarding-psychologist` (Liz's) — first-use surfaces
- `superpowers:brainstorming` — before design
- `superpowers:verification-before-completion` — visual confirmation, not just type-checks
- `verify` (top-level skill) — run the app and look at it

**Tier 2 — design + current framework:**

- `ui-ux-pro-max:ui-ux-pro-max` — palettes, fonts, UX rules
- `antigravity-bundle-creative-director:frontend-design` — design taste
- `antigravity-bundle-web-wizard:nextjs-best-practices` — Next.js 16 patterns
- `antigravity-bundle-web-wizard:tailwind-patterns` — Tailwind v4
- `antigravity-bundle-web-wizard:react-patterns` — React 19

**Tier 3 — Figma workflow (when relevant):**

- `figma:figma-implement-design` — design-to-code
- `figma:figma-create-design-system-rules` — design tokens

**Tier 4 — public-facing surfaces:**

- `antigravity-bundle-creative-director:copy-editing` — UI copy
- `antigravity-bundle-web-designer:scroll-experience` — marketing pages
- `antigravity-bundle-web-wizard:seo-audit` — public pages

---

## 5. Sequencing — what to do in what order

1. **Edit and publish the 3 marginal skills** (`lessons-learned`, `next-actions-planning`, `orchestration-cataloging`) — strip Make_Skills-specific paths, push to `claude-skills-marketplace`.
2. **Publish the 6 ready skills as-is** — `agentic-skill-design`, `design-evaluation`, `documentation`, `document-parsing`, `deep-research-pattern`, `eval-deep-research`.
3. **Rewrite both `SKILLS.md` files in project-starter** with the tier structure above. Replace fragile install paths (`agent-memory-systems`, `agent-orchestrator` manual clones) with marketplace-installable equivalents.
4. **Update `templates/_common/CLAUDE.md`** to reference the recommended skill discipline (brainstorming before build, verification before claiming done, token-discipline rules).
5. **Consider a `templates/research-app/`** variant — using `deep-research-pattern` + `eval-deep-research` + `document-parsing` + `academic-research-skills` family. This is a real workflow shape that doesn't fit cleanly under either agent-app or ui-app.

---

## 6. Open questions

- Should the project-starter's `_common/CLAUDE.md` reference Liz-authored marketplace skills by their plugin name (`lizo-skills/agentic-skill-design`) or by their short name? The former is unambiguous; the latter is more readable. The current style uses short names.
- Do you want a **third variant** (`research-app` or `science-app`) bundling the research skills? The current binary split (agent-app vs ui-app) misses the research-agent shape, which has elements of both.
- The `agent-orchestrator` and `agent-memory-systems` *concept* references in the current `SKILLS.md` are valuable even when the named packages are awkward. Worth keeping as "conceptual references" in the doc, even after the install instructions are removed.

---

## References

- [`Lizo-RoadTown/project-starter`](https://github.com/Lizo-RoadTown/project-starter) — the repo being recommended for
- [`Lizo-RoadTown/claude-skills-marketplace`](https://github.com/Lizo-RoadTown/claude-skills-marketplace) — where the Liz-authored skills publish to
- [Make_Skills `skills/` directory](../../skills/) — the 14 private skills source-of-truth
- PR #29 in this repo — adds "Pair with the public stack" sections to each private skill (the upstream of the publish-after-editing changes)
