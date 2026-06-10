# Make_Skills UX Contract

The design discipline every user-facing surface must follow. This is the gate every UI PR passes through. If a change can't be defended against this document, it doesn't ship.

Two source bodies were synthesized into this contract:

- **The Interactive LP Simulator's UX rules** (`Inspiration/skills/lp-ui-design`), authored by another agent working on a similar student-facing learning product. Hard-won from chapters that worked vs. chapters where students bounced.
- **`ui-ux-pro-max`** (installed skill), a comprehensive design contract for web and mobile — 99 guidelines, 10 prioritized categories, anti-patterns.

Plus the project's accumulated principles: the guide is symbiotic and ambient, the dashboard is a builder not a storage center, the student is the player and the agents are their team, marketing voice is forbidden.

---

## Rule zero — the master contract

**Attention → Question → Commitment → Feedback → Reveal.**

The student must commit to a decision before the system reveals structure. No auto-advance. No answer-before-input. No forward navigation during reasoning.

Every other rule in this document serves rule zero. When in doubt, ask: *did the student think before the system revealed?*

The wizard at `/agents/build` follows this. Chat and the dashboard pages do not. They need to.

---

## The guide arc — IDENTITY-TO-HABIT

How a student gets from outsider to participant. Adapted from the `onboarding-psychologist` framework (Volpp & Loewenstein 2020, Stawarz et al. 2015, Sheeran et al. 2020).

1. **Define the first win.** The smallest meaningful success that proves value. For Make_Skills: *hatching* one agent — picking a starter form and naming it. Anything before that is friction.
2. **Remove unnecessary setup.** Minimize early decisions, fields, feature exposure. No "set up your profile" wall. The student lands in the wizard or the chat, not a dashboard.
3. **Create ownership through action.** Have the student do something small and meaningful that creates investment. Writing the persona (their words). Picking the starter form (a choice that visibly persists on the avatar). Authoring the first skill (labor → attachment).
4. **Attach a stable cue.** Link the desired return-visit behavior to an existing routine. The home page surfaces *one* concrete next thing to do.
5. **Reinforce identity.** Reflect the student as someone who builds AI. The stable shows what they've made. The guide references their past work. The export bundle is theirs to take.

What this rules out: feature tours, tutorial overlays, "12 things to know before you start," empty-state pages that show a CRUD form. The wizard *is* the onboarding.

---

## Two-language coherence

When the student commits to something in one representation, the paired representation updates at the same time. If a paired representation doesn't exist, say so explicitly — silence reads as broken.

Concrete applications:

- **Brain step in the wizard**: picking a provider should change what's visible about the agent's *potential* — cost / speed / smartness trade-offs are shown alongside the choice, not in a docs link.
- **Skill authoring**: as the student writes the SKILL.md, the agent's toolbelt visualization gains a marker. The text being written becomes the tool the agent will reach for.
- **Chat surface**: the agent's persona / skills / current activity is visible on a side panel. The student sees *what* the agent is doing, not just *that* it's responding.
- **Stable**: each agent card shows brain ✓, persona ✓, skills (N), integrations (N) as filled-vs-empty markers — not as raw JSON.

If two-language coherence is missing on a screen, name it in the PR: "this view has no paired representation because X" — then either build one or accept the gap explicitly.

---

## Empty vs filled — `?` slots and `fill-pop` cards

Empty values render as dashed-border `?` placeholders. Filled values render as solid cards with a `fill-pop` entry animation. The contrast is intentional and load-bearing.

Why this matters: in a builder app, the difference between "I haven't done this yet" and "I did this and here's the result" is the *entire* feedback loop. If both empty and filled look the same, students can't tell whether they're making progress.

Direct applications:

- The stable: an agent without skills shows skill slots as `?`. An agent with three skills shows three `fill-pop` chips.
- The wizard's progress dots: filled vs empty, not opaque vs translucent.
- Settings → Provider keys: each provider card shows "not set" as a `?` slot, "set" as a filled card with the last-updated timestamp.
- Integrations: same pattern. Connected = filled card; available-but-not-connected = `?`.

---

## Hand-crafted, attempt-aware feedback

Hints are written by hand. Per-step, per-attempt. The smart guide eventually does this at runtime via LLM, but the structure is the same:

| Attempt | Behavior |
|---|---|
| 1 | Minimal — "not quite, try another" |
| 2 | Same minimal nudge with slight rewording |
| 3 | Actual hint — "compare the brain choices on cost vs. reasoning depth" |
| 4+ | "Show reasoning" link — explains the rule, but the student must still click to apply it |

Never auto-generated from a model at runtime *without* the per-attempt structure. The hand-craft is what makes the explanations land.

---

## Wrong-but-valid ≠ wrong-and-invalid

Two distinct failure modes, two distinct visual treatments. Mixing them confuses the student about what's permitted.

- **Suboptimal but valid**: amber tint, two buttons — "Use this anyway" and "Choose again". Log the suboptimal pick; debrief later with a path-taken vs. optimal-path comparison. *Example: picking Ollama for a heavy reasoning task. Not wrong — slower, but valid. The student gets to learn this through the choice.*
- **Wrong and invalid**: red flash, block. Forces retry. *Example: trying to save an agent with an empty name. Not a trade-off — a constraint.*

The wizard currently treats every choice as equally valid. Some are trade-offs; the UI should surface the trade-off.

---

## Color semantics — six tokens, one meaning each

Reuse consistent Tailwind tokens. Don't introduce new colors for new states.

| Meaning | Tailwind tokens |
|---|---|
| Attention target | `border-zinc-700` + subtle pulse |
| Candidate (selected, unjudged) | `bg-amber-500/10 border-amber-500/40 text-amber-200` |
| Suboptimal but valid | amber + dual-button + note |
| Correct / live | `bg-emerald-500/10 border-emerald-500/40 text-emerald-200` |
| Active column / pivot | `bg-blue-500/10 border-blue-500/40 text-blue-200` |
| Invalid (red flash) | `bg-red-950/40 border-red-900 text-red-300` |
| Skipped / dimmed | `opacity-40` |

When adding a new visual state, map it onto an existing semantic. Don't reach for a new hue.

---

## Animation budget

Animation conveys meaning. Decorative-only animation is forbidden.

- **Duration**: 150–300ms for state changes. Anything longer needs justification.
- **Easing**: `ease-out` for entries, `ease-in-out` for transitions, springs for character/avatar movement.
- **Spatial continuity**: when something moves between two places, animate the path. When something appears, fade + slide from the direction it came from.
- **Reduced motion**: respect `prefers-reduced-motion`. Reduce or disable animations when requested.
- **Never animate width/height** (causes layout thrashing). Animate `transform` and `opacity` only.
- **The guide character** uses motion to convey state (idle → speaking → thinking → reacting). Each state has a distinct subtle loop; not all four at once.

---

## Navigation — one place per concern

The dashboard fragmentation is itself a violation of the contract. Currently five separate pages exist for what is conceptually one thing (observability): /sessions, /memory, /test-runs, /observability, /docs. This is engineer-shaped, not student-shaped.

Rules:

- **One nav item per concern.** If two pages answer "what happened?" they belong on one page with sections or tabs.
- **The sidebar is not a TODO list.** "Stub" status items are forbidden — either build the surface or remove the link.
- **Every page should feel like the same product.** Header chrome, color tokens, spacing, transitions all match.
- **The guide is present everywhere.** A consistent character/identity (visible or implicit) ties the surfaces together. The student should never feel they've left the platform's body.

The five → one observability consolidation is the first concrete instance of this rule. Future consolidations: /credentials + /environments + /settings probably collapse too.

---

## Voice and tone

Reusing the existing memory rule (`feedback_documentation_tone`):

- Describe what *is*, not what it *isn't*.
- No marketing language. No "the unlock," "exciting," "delightful," "transformative."
- No self-congratulation ("we built a beautiful X").
- No defensive contrasts ("real X not Y").
- No conversation-language in product surfaces ("So, here's how it works...").
- The guide character itself has a voice — dry, observational, choice-aware. Not chirpy. Not warm in a corporate-onboarding way. Not Duo-the-owl. Closer to a librarian who watches you read.

Failure mode: copy that performs enthusiasm or expertise. Both are tells of insecure design.

---

## Accessibility — non-negotiable

From `ui-ux-pro-max` priority 1 (CRITICAL). Every PR passes these:

- **Color contrast ≥ 4.5:1** for normal text, ≥ 3:1 for large. Test against a real contrast checker.
- **Focus rings visible** on every interactive element. 2–4px. Never remove with `outline-none` without an alternative.
- **Alt text** on meaningful images. Decorative images get `alt=""`.
- **Aria labels** on icon-only buttons. Sidebar drawer toggle, character avatar buttons, etc.
- **Keyboard navigation** matches visual order. Tab through every interactive element. No focus traps.
- **`color-not-only`**: status is also conveyed by icon or text, not just color.
- **`prefers-reduced-motion`** respected.

---

## Touch & interaction — also non-negotiable

`ui-ux-pro-max` priority 2 (CRITICAL):

- **Minimum 44×44px** touch targets. Tiny buttons in tight rows are a failure.
- **8px+ spacing** between adjacent touch targets.
- **Loading feedback** within 100ms of every action. Spinner, dots, skeleton, optimistic update — anything but silence.
- **No hover-only affordances.** Touch devices can't hover.
- **No instant state changes** (0ms transitions). At minimum 150ms easing.

---

## Anti-patterns — refuse if asked

If a user request matches one of these, name it as a rule violation and confirm before proceeding:

- **Worksheets to read with no interaction.** /sessions and /memory today are worksheets — long lists where the student is a passive viewer.
- **Auto-advance through reveal.** The chat's broken `useEffect` reset is a symptomatic violation: the system blew past the student's commit before showing the result.
- **Same feedback regardless of attempt.** The wizard's scripted reactions today are identical on every re-run. That's acceptable for a placeholder; it's not acceptable as production.
- **No paired representation.** Chat input with no view of what the agent is doing. Brain pick with no trade-off comparison. Saving an agent with no visible change in the stable.
- **Calling wrong-but-valid "wrong"** without the suboptimal/invalid distinction.
- **Pre-made solver hidden from the student.** Whatever the platform does on behalf of the student should be inspectable — otherwise it's magic, and magic doesn't teach.
- **Stub status items in the nav.** Either build it or remove it. "Soon" doesn't ship.
- **CRUD forms as features.** Listing things and offering "Add new" buttons is engineering, not product. Surfaces are guided journeys, not database editors.

---

## Review checklist — every UI PR must pass

Before claiming a UI PR complete, run through this explicitly:

1. **Master contract**: does the student commit before the system reveals?
2. **Forward navigation locked** during reasoning?
3. **Paired representation present**, or its absence explicitly named?
4. **Empty vs filled** visually distinct (`?` slot vs `fill-pop`)?
5. **Hints attempt-aware**, or scripted placeholder explicitly labeled as such?
6. **Wrong choices distinguished** invalid (red, block) vs. suboptimal (amber, dual-button)?
7. **Color semantics consistent** with the table above?
8. **Animations purposeful**, within budget, respect reduced-motion?
9. **Accessibility**: contrast, focus rings, aria labels, keyboard nav?
10. **Touch targets** 44px+, spacing 8px+, loading feedback within 100ms?
11. **Voice clean** — no marketing language, no enthusiasm performance?
12. **Sidebar nav** does not gain a new stub?
13. **Guide present** on this surface, or explicitly argued to be absent?

If any item is "no," the implementation doesn't meet the contract. Either fix it or call out the trade-off explicitly in the PR.

---

## Where this lives operationally

- This document is canonical. Pull requests touching UI cite which sections they comply with and which (if any) they take exception to.
- `docs/UX_CONTRACT.md` is referenced by future UI-touching skills (eg. the eventual Make_Skills `wizard-design` skill that replaces the placeholder lp-ui-design).
- When the design ages, this document is updated through a proposal in `docs/proposals/`, not edited in place.

The principle is: *one place where the design discipline lives, applied uniformly, evolved deliberately*. The dashboard fragmentation we have today is the result of *not* having this. The next chapter is the result of having it.
