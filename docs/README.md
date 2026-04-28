# Make_Skills documentation

If you're new here: read these three first, in order.

1. [`concepts/two-mode.md`](concepts/two-mode.md) — the dual-mode commitment that shapes every other doc
2. [`how-to/self-host-quick-start.md`](how-to/self-host-quick-start.md) — get the platform running on your machine
3. [`decisions/README.md`](decisions/README.md) — why the project is the way it is (the ADR index)

## Tree

| Folder | What's in here | Read it when |
|--------|----------------|--------------|
| [`concepts/`](concepts/) | Architecture, principles, mental models | You want to understand WHY |
| [`how-to/`](how-to/) | Step-by-step recipes that work end-to-end | You want to DO a specific thing |
| [`reference/`](reference/) | Endpoints, env vars, schemas, formats | You're writing code that needs an exact spec |
| [`decisions/`](decisions/) | Architecture Decision Records — what was chosen + why | You want the audit trail of design choices |
| [`proposals/`](proposals/) | Design proposals not yet decided | You're evaluating whether to commit to an approach |
| [`per-pillar/`](per-pillar/) | Pillar-specific docs (1: build agents, 2: skills, 3: observability) | You're working on one specific pillar |

## Two-mode discipline

Every doc explains the topic in **both** deployment modes (self-host AND hosted-multitenant). If you're reading a doc and only one mode is covered, that's a bug — open an issue or fix the doc.

## Contributing to docs

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) at the repo root and the [`open-source-documentation`](../skills/open-source-documentation/SKILL.md) skill for the discipline. Anti-patterns:

- New feature without docs in the same PR
- Docs explaining only one mode
- ADRs amended in place after acceptance (write a superseding ADR instead)
- "How-to" docs that don't actually work end-to-end on a fresh checkout
