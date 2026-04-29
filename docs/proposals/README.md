# Design proposals

Pre-decision design documents. A proposal lives here while it's being shaped — when accepted, it gets formalized as an ADR and the proposal is referenced from the ADR's "References" section.

## How a proposal becomes an ADR

1. Write a proposal here (`<short-name>.md`) describing the problem, options, recommendation, and open questions.
2. Discuss — comments, issues, in-person.
3. When the call is made, write the ADR in `../decisions/NNN-<slug>.md`. The ADR's References section links back to this proposal.
4. The proposal stays in this folder as historical context (don't delete it).

## Proposals on the table

| Proposal | Status |
|----------|--------|
| [`byo-claude-code-via-mcp.md`](byo-claude-code-via-mcp.md) | Open — needs Liz's call on auth + scope |
| [`agent-creatures-ui.md`](agent-creatures-ui.md) | Open — direction set (Tomagotchi/Spore-style 3D, multiplayer clan); mechanics TBD |
| [`agent-builder-flow.md`](agent-builder-flow.md) | Open — six-step character creation; HuggingFace as default free path |
| [`quest-system.md`](quest-system.md) | Open — gamified skill acquisition (music / make-money / science / social-impact) |
| [`agent-retirement-and-clan-optimization.md`](agent-retirement-and-clan-optimization.md) | Open — the hardest mechanic; closes the gameplay loop and unlocks Phase 2 multiplayer |

## How they fit together

```
agent-builder-flow      ──→  quest-system  ──→  observability  ──→  agent-retirement
       (Pillar 1 entry)        (Pillar 2 work)    (Pillar 3 dashboard)   (close the loop)
                                                                              │
                                                                              ▼
                                                              UNLOCKS Phase 2 multiplayer
                                                              (group quests, shared knowledge
                                                              observatories, organizations,
                                                              collective neural networks)

agent-creatures-ui   ──→  the visual layer all of the above produce/consume
byo-claude-code-via-mcp ──→ the path for power users to skip the chat UI entirely
```
