# Proposal: Quest system (Pillar 2 — gamified skill acquisition)

**Status:** Open — direction set 2026-04-29, mechanics need her sign-off
**Connects:** [`agent-builder-flow.md`](agent-builder-flow.md) (what students do AFTER they've built their agent)

## Direction (from Liz, 2026-04-29)

> "The next section will be quests to create the skills. They can make their own, but they will be live quests. Or we will generate quests. They will be quests to make music, make money (business websites) or contribute to science, social impacts etc. After they build their agentic flow in quests or begin to we weave in observability so they can begin to optimize and understand how they are using money for tokens and how fast things can be and customize what they need to optimize for (we can give guidance here too)."

## The gameplay loop (now visible)

```
   ┌──────────────────────────────────────────────────────────┐
   │ Pillar 1 — Build agents                                  │
   │   Character creation: pick species, brain, class, skills │
   │   Output: a starting creature ready for work             │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Pillar 2 — Quests (skill acquisition through real work)  │
   │   Curated or user-defined quests in domains:             │
   │     · Music (compose, arrange, produce)                  │
   │     · Make money (build a business website / product)    │
   │     · Contribute to science (research + write-up)        │
   │     · Social impact (campaigns, advocacy, organizing)    │
   │     · ... (extensible)                                   │
   │   Completing a quest grants new skills to the creature   │
   │   (skill→tool promotion happens here naturally)          │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Pillar 3 — Observability (optimization layer)            │
   │   Once a student has run several quests, the dashboard   │
   │   becomes useful: token cost per quest, speed, what      │
   │   their agent does well or poorly. The system suggests   │
   │   what to optimize for and guides the changes.           │
   │   Output: a sharper, cheaper, faster, more specialized   │
   │   agent — visible improvement.                           │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
                  (back to more quests, harder)
```

This is the gameplay. Every loop makes the creature more capable AND teaches the student real engineering.

## Quest anatomy

Each quest is a self-contained mini-project with this structure:

```yaml
title: "Build a landing page for a real local business"
category: make-money
difficulty: 1-5
estimated_time: 2-6 hours
prerequisite_skills: [web-app-scaffold, basic-react]

briefing: >
  Find a local small business without a website (your friend's coffee
  shop, your neighbor's dog-walking service, etc.). Build them a real
  one-page landing page. Deploy it to Vercel. Send them the link.

success_criteria:
  - Live URL on the public internet
  - Owner approval (they can use it)
  - Mobile-responsive
  - Loads in < 2s on a slow connection

skills_granted_on_completion:
  - vercel-deployment
  - landing-page-aesthetic
  - real-customer-feedback-loop

body_part_unlocked: hands  # creature gains visible "hands" body part
xp_award: 250

guidance_during_quest:
  - At 25% — agent suggests checking competitor sites
  - At 50% — agent reminds about mobile responsiveness
  - At 75% — agent suggests asking for owner feedback before deploying
  - At 100% — agent celebrates + writes a 2-paragraph reflection
```

The student doesn't have to know they're learning. They're just building a website for their friend.

## Quest sources

Three pipelines for quests:

### A. Curated quests (built-in library)

Make_Skills ships with a starter library of 50–100 quests across categories. Each is QA'd, has working agent guidance scripts, has clear success criteria. Examples:

- **Music:** "Compose a 30-second loop using your agent for chord theory help"
- **Make money:** "Build a landing page for a real local business" (above)
- **Contribute to science:** "Reproduce a published methodology and write a summary"
- **Social impact:** "Build a campaign site for a local cause"

Curated quests are the default for new students.

### B. AI-generated quests (personalized)

Once a student has completed N curated quests, the system can generate quests tailored to their interests and skill gaps. The recorder + memory know what they've worked on; the generator proposes what's next.

Generation happens via an existing Make_Skills agent (the curator) with a `generate_quest` tool that produces a quest in the schema above.

### C. User-defined quests (advanced)

Power users define their own quests. UI form to fill in the schema fields. Useful for self-directed learning or classroom assignments.

Optional: share user-defined quests to a public commons (opt-in) — others can take them.

## Live quest mechanics

Quests are "live" — meaning:

- **Accept a quest** → it appears in your active log with timer started
- **Work happens in chat** — you talk to your creature about the quest, it helps
- **Progress milestones** — agent recognizes you're 25% / 50% / 75% / done
- **Guidance prompts** — pre-written guidance triggers at milestones (the "covertly teaching" part — they're learning best practices without realizing)
- **Verification** — depending on success criteria, verification is automatic (URL responds, file exists) OR self-attested (you click "I delivered, here's the proof")
- **Rewards on completion** — XP, skill grants, body part unlock, optionally a creature evolution event

## When observability becomes relevant

After ~3-5 completed quests, the observability layer (Pillar 3) becomes the natural next surface. The student now has:

- Token cost data across quests (some were expensive, some cheap)
- Speed data (some agents were fast, some slow)
- Quality data (some quests went smoother than others)

The dashboard surfaces this with **opinionated guidance**:

> "Your researcher creature spends 4× more tokens than your builder per task — but produces work in half the time. Want to make it cheaper? Try [X]. Want to make the builder more thorough? Try [Y]."

This is the engineering education layer — the student learns about model trade-offs, prompt efficiency, multi-agent cost discipline, all by SEEING THEIR OWN DATA, not by reading abstract docs.

## What the curriculum teaches (covertly)

| Quest activity | What they think they're doing | What they're learning |
|---------------|--------------------------------|------------------------|
| Building a landing page | Helping a friend's business | HTML/CSS/Vercel/web ops |
| Composing music | Making a beat | Signal processing, music theory in agent prompts |
| Reproducing science | Reading a paper, running code | Scientific method, reproducibility, environment management |
| Social campaign | Helping a cause | Persuasive writing, multi-channel ops, audience analysis |
| Optimizing observability | Making numbers go down | Cost discipline, latency engineering, model trade-offs |

By the time a student has completed 10 quests they've practiced 30+ engineering concepts. Without ever taking a class.

## How quests interact with the creature

- Each quest **specialization** (music, make-money, science, social) maps to creature class options
- Completing a quest **grants skills** to the specific creature working on it (not all creatures in your clan)
- Different creatures evolve differently — your music creature looks different from your science creature
- Multi-class creatures (researcher + builder, etc.) emerge from cross-domain quest completion
- The clan view shows which creatures have done which quests — visible specialization

## Two-mode discipline

| Mode | Where quest data lives |
|------|--------------------------|
| Self-host | Local Postgres `quests` + `quest_completions` tables; curated quest library shipped in repo |
| Hosted | Tenant-scoped tables, public commons table for shared user-defined quests, all isolated |

## Open questions for sign-off

1. **Curated quest library size at launch?** Lean: 20-30 quests across 4 categories (5-7 per category) is enough to get students through their first month.
2. **Quest verification — automatic vs self-attested?** Automatic where possible (URL alive, file exists, output matches a checker), self-attested for subjective quests. Both with audit trail.
3. **AI-generated quest gating?** When does this unlock? After N completed curated quests, or always available with a "this is experimental" tag?
4. **Public commons for user-defined quests?** Opt-in publish, or wait until 3c knowledge graph lands and use that infrastructure?
5. **Observability "guidance" — prescriptive vs suggestive?** Prescriptive ("you should do X") vs suggestive ("here's an option"). Lean: suggestive with a "tell me more" expand.
6. **Quest difficulty progression?** Force linear (must complete level 1 before level 2)? Or open (anything available, but recommend in order)? Lean: open with strong recommendation, no hard gates.

## What this proposal does NOT cover

- The 3D quest-board UI (where students browse and accept quests) — separate visual design
- Specific quest content (the 20-30 starter quests) — needs authoring
- Verification automation (URL pingers, file checkers) — implementation detail
- The progression curve (what level 1 vs level 5 means concretely) — needs balance work
- Multiplayer quests (two students collaborate) — explicitly deferred to Pillar 1's multiplayer-clan landing first

## If accepted, becomes ADR-NNN with these specifics

- Quest schema locked (above)
- Initial 4 categories: music, make-money, science, social-impact
- 20-30 curated quests authored as launch content
- Generation pipeline + user-defined form built
- Observability "guidance" layer surfaces after N quest completions
- Skill-grant + body-part-unlock connected to existing agentic-upskilling loop
