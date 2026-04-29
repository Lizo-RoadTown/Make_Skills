# Architecture Decision Records (ADRs)

Append-only log of *why* the project is the way it is. Each numbered ADR captures one decision, the alternatives considered, and the consequences (positive and negative).

## Index

| # | Title | Status | Date |
|---|-------|--------|------|
| [001](001-license-apache-2.md) | Adopt Apache License 2.0 | Accepted | 2026-04-28 |
| [002](002-two-mode-commitment.md) | Build for both self-host and hosted-multitenant from day one | Accepted | 2026-04-28 |

## How to write a new ADR

1. Copy [`000-adr-template.md`](000-adr-template.md) to a new file with the next number, padded to 3 digits, and a kebab-case title verb phrase. Example: `003-choose-github-oauth-for-hosted-auth.md`.
2. Fill in every section. Be honest about consequences — both positive AND negative.
3. Set **Status: Proposed** initially. After review (informal — at minimum, the maintainer reads it), update to **Accepted**.
4. Commit it. ADRs are immutable after acceptance.
5. Update this index table.

## How to amend an ADR (you don't)

Architecture decisions get superseded, not edited. To change a decision:

1. Write a NEW ADR with the next number.
2. In its **Status** field write: `Accepted (supersedes ADR-NNN)`.
3. Open the OLD ADR and update only its **Status** to: `Superseded by ADR-MMM`. (This is the ONLY edit allowed to an accepted ADR.)
4. Update this index.

The audit trail of changes lives in git history; the ADRs themselves stay coherent as a sequence of decisions.

## When NOT to write an ADR

- Implementation choices with no real alternative ("we used `psycopg` because it's the standard postgres driver" — just an import)
- Decisions that change frequently (UI styling, copy)
- Things downstream of an existing ADR (reference the parent ADR instead)
- Vendor or library version pins (those live in `requirements.txt` / `package.json`)
