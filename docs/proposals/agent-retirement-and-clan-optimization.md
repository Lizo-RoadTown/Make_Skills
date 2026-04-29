# Proposal: Agent retirement & clan optimization (the hardest mechanic)

**Status:** Open — direction set 2026-04-29, the design challenge of the whole platform
**Connects:** [`agent-builder-flow.md`](agent-builder-flow.md), [`quest-system.md`](quest-system.md), [`agent-creatures-ui.md`](agent-creatures-ui.md), Pillar 3 (Observability)

## Direction (from Liz, 2026-04-29)

> "The hardest part in the end is where we have to teach them to retire some agents when they have to assess if their charts show some are not doing well and they should only keep x amounts etc. They should only keep what maximizes their goals."

This is the closing mechanic of the gameplay loop — and the one that makes everything else educational rather than just collectible.

## Why this is THE hard part

The natural tendency is to **collect**. Students will train creatures, get attached, never retire any. That's a Pokemon collection mindset. But it sabotages the engineering education:

- Without retirement pressure, no real performance evaluation happens
- Without a cap, no opportunity cost is felt
- Without goal-setting, no optimization is meaningful
- Without explicit choice, no skill in choosing develops

**The retirement mechanic is what turns Make_Skills from a "build cute creatures" toy into a "manage a real engineering team" simulation.**

## The full gameplay loop, completed

```
   ┌──────────────────────────────────────────────────────────┐
   │ 1. BUILD                                                  │
   │    Pick species, brain, class, skills (agent-builder)    │
   └────────────────────────┬─────────────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ 2. QUEST                                                  │
   │    Real work that grants skills, body parts, XP          │
   └────────────────────────┬─────────────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ 3. OBSERVE                                                │
   │    Charts of cost, speed, quality per creature            │
   └────────────────────────┬─────────────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ 4. SET GOALS                                              │
   │    "I want my clan to make money" / "to do science" /    │
   │    "to maximize creative output per dollar" — the user   │
   │    declares what they're optimizing for                   │
   └────────────────────────┬─────────────────────────────────┘
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │ 5. RETIRE                                                 │
   │    Hard choice: which creatures to keep at the cap?      │
   │    Underperformers vs the goal go to a graveyard         │
   │    (archived, not deleted — the lifelong-companion       │
   │    promise; you can revive them later or remember them   │
   │    as a memento).                                         │
   └────────────────────────┬─────────────────────────────────┘
                            │
                            └──→ back to BUILD/QUEST with sharper clan
```

**Each loop iteration the student gets better at:** evaluating performance, making trade-offs, declaring goals, accepting opportunity cost, and letting go of work-in-progress that didn't pan out. These are real engineering management skills.

## Mechanics

### 5a. Clan cap

A configurable maximum number of active creatures. Defaults:

| Stage | Cap |
|-------|-----|
| First week | 3 (forces specialization early) |
| After 5 quests | 5 |
| After 20 quests | 7 |
| Permanent ceiling | 10 |

The cap is **soft-enforced** — when you spawn or train a creature beyond the cap, the system prompts: "you've hit your active-creature limit — choose one to retire." Could ALSO be tunable per-tenant if a power user wants more.

Why a cap: forces the choice. Without a cap, you accumulate; with a cap, you decide.

### 5b. Goal declaration

Before retirement decisions become meaningful, the student must have declared what their clan optimizes for. The /agents page (or onboarding extension) prompts:

```
What's your clan optimizing for? (pick 1–3, weight them)

  □ Speed       — get answers fast
  □ Cost        — minimize tokens / dollars
  □ Quality     — maximize correctness, even if expensive
  □ Creativity  — favor novel outputs
  □ Education   — favor explanations + reasoning steps
  □ Privacy     — prefer local models even if slower
  □ Scale       — favor parallel / multi-task throughput
  □ Custom: _______ (declare your own)
```

Goals can be re-weighted any time. The dashboard's "you should retire X" suggestions key off these weights.

### 5c. Performance scoring

Each creature gets scored against the active goals using observability data:

| Goal | Measured by |
|------|-------------|
| Speed | Avg response time across recent tasks |
| Cost | Tokens consumed / $ spent |
| Quality | Quest completion rate, user up-vote rate |
| Creativity | Novelty heuristic (low embedding similarity to prior outputs) |
| Education | Length / depth of explanations, reasoning-step count |
| Privacy | % of work done on local models |
| Scale | Parallel task count, throughput per hour |

A creature gets a **fitness score** = weighted sum of (its performance per goal × user's weight on that goal).

The dashboard ranks creatures by fitness. The student SEES the ranking. The decision is theirs but the data is unmistakable.

### 5d. Retirement (the actual moment)

When the student hits "retire creature X":

1. **Confirmation step** — shows the creature, its lifetime stats, the quests it completed, the skills it learned, the moments it shone
2. **Optional ceremony moment** — a 5-second animation as the creature curls up; respects the time invested
3. **Archive, not delete** — full state persists in a "retired" namespace. Skills, history, memory all preserved.
4. **Reviveable later** — students can pull a retired creature back into the active clan if a slot opens (or can pay to expand cap, optional). Their old skills come with them.
5. **Skills/tools graduation** — if a retired creature had unique skills the rest of the clan didn't, those skills become available to other creatures (the wisdom carries forward).
6. **Memorial entry** — the retired creature shows up in a "graveyard" view with its history and optional notes from the student.

The lifelong-companion promise still holds — nothing is destroyed.

## Why "archive not delete" matters

Two reasons:

1. **Emotional safety.** Students who feel "I'm killing my creature" won't engage with the mechanic. Students who feel "I'm graduating my creature into rest" will.
2. **The lifelong vision.** A student who built a creature for a college class might revisit it years later. The graveyard is where their early-career agents live. They might pull one out for nostalgia or to apply its old skills to new work.

## What the student is learning (covertly)

| Mechanic | Engineering skill in disguise |
|----------|-------------------------------|
| Goal declaration | Specifying objective functions |
| Fitness scoring | Multi-objective evaluation, weighted utility |
| Forced retirement at cap | Resource constraints, opportunity cost |
| Retired-creature revival | Versioning, restoration, technical debt |
| Skill graduation on retirement | Code reuse, library extraction |
| Goal re-weighting over time | Iterative requirements engineering |

By the time a student has retired their first creature they've made a real engineering management decision. By the time they've retired five they're scoring and prioritizing like a senior engineer.

## Two-mode discipline

| Mode | Retirement state |
|------|------------------|
| Self-host | Active and retired creatures both in local Postgres + LanceDB; "graveyard" is a query, not a separate store |
| Hosted | Tenant-scoped; retired-creature data still tenant-isolated; never shared with other users without explicit publish |

## The full picture (Pillar 1 + 2 + 3 + retirement)

```
Build (P1)  →  Quest (P2)  →  Observe (P3)  →  Goal-set  →  Retire  →  back to Build
                                                              ↑
                                                              │
                                                  This is where the platform
                                                  earns its educational claim.
                                                  Without it, it's a toy.
```

## Open questions for sign-off

1. **Default starting cap?** Lean: 3. Forces early specialization, prevents collection sprawl.
2. **Cap progression?** Lean: tied to quest completion (proves the student is using their creatures). Alternative: tied to time, or skill, or paid tiers.
3. **Goal categories?** The seven listed above are a starting point. Easy to extend.
4. **Fitness score visible to user?** Lean: yes, transparently — they should see HOW the system thinks they should choose, then make their own call.
5. **Skill graduation on retirement — automatic or opt-in?** Automatic is simpler; opt-in keeps user in control. Lean: opt-in with a "yes, transfer all skills to my active clan" default.
6. **Revival cost?** Free for the first revival; premium for unlimited? Or always free? Lean: always free (matches lifelong-companion promise).
7. **Public graveyard?** A "memorial wall" where students see other students' famous-retired creatures? Could be inspiring, could be morbid. Lean: opt-in publish, similar to the commons in 3c.

## What unlocks after mastery (Phase 2 — multiplayer)

Per Liz, 2026-04-29:

> "Once they finish this, they unlock group quests, where they can be inside the knowledge observatories and universe building. They can collectively contribute to large science projects, create organizations or build things together and observe their knowledge actively become neural networks that they collectively design."

Mastering the solo loop (build / quest / observe / retire) is what unlocks the multiplayer phase:

- **Group quests** — multiple students take a quest as a team; their clans collaborate
- **Shared knowledge observatories** — Pillar 3c lit up multiplayer; clans contribute to shared graphs with PROVES_LIBRARY-style review
- **Universe building** — shared 3D environments where clans meet and work together
- **Real science contributions** — citizen science, OSS ML, multi-team research
- **Student-formed organizations** — guilds with their own goals, quest backlogs, knowledge graphs, governance
- **Collective neural networks** — accumulated knowledge graphs become the architecture of co-designed neural networks the students compile from their own thinking

This is Phase 2. It doesn't get designed in detail until Phase 1 (the solo loop) is shipped and used. But knowing it's coming shapes Phase 1 architecture: tenant abstraction, exportable creatures, opt-in publishing, public commons, multi-team governance primitives.

## What this proposal does NOT cover

- The actual scoring algorithms (need engineering work to pick metrics that aren't gameable)
- The retirement ceremony animation (3D + sound design, separate work)
- The graveyard UI (separate visual design)
- Multiplayer retirement events ("we retired our researcher together") — Phase 2
- Knowledge graph compilation into neural network architectures — explicitly Phase 2 R&D work

## If accepted, becomes ADR-NNN with these specifics

- Clan cap progression locked (3 → 5 → 7 → 10)
- 7 standard goal categories + custom
- Fitness scoring transparent to user
- Archive-not-delete policy permanent
- Skill graduation default = opt-in transfer
- "Memorial" surface explicit
