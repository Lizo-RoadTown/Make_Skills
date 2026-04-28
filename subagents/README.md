# subagents/

Canonical deepagents subagents root. Each subdirectory is one specialist agent that the root orchestrator can delegate to.

## Layout

```
subagents/
├── README.md                       (this file)
└── <subagent-name>/
    ├── AGENTS.md                   (subagent's own persona / system prompt)
    ├── deepagents.toml             (subagent's model, sandbox, skill scope)
    └── skills/                     (skills only this subagent can load)
        └── <skill-name>/SKILL.md
```

A subagent may scope to a subset of the parent's skills, OR ship its own private skills under its own `skills/` folder, OR both. Skills under a subagent are NOT visible to the root agent unless explicitly listed in the root's `deepagents.toml`.

## Adding a subagent

1. Create `subagents/<name>/`
2. Add `AGENTS.md` defining the subagent's role, scope, and routing rules
3. Add `deepagents.toml` (model + skill scope)
4. Optionally add `skills/<skill-name>/SKILL.md` for private skills
5. Reference it from the root `AGENTS.md`'s "Routing hints" section

## Subagents here

| Subagent | Role | Reads | Tools |
|----------|------|-------|-------|
| [planner/](planner/) | Decomposes user request into structured JSON plan (questions, source constraints, success criteria) | User request only | None (reasoning-only) |
| [researcher/](researcher/) | Executes the plan, returns findings + citations + draft report | Planner output only | ToolUniverse MCP (commented), web fetch |

Together these two form the **three-role deep-research topology** (orchestrator at root + planner + researcher), per [NVIDIA AI-Q](https://github.com/NVIDIA-AI-Blueprints/aiq).

Optional roles to add only when measurably needed (per `skills/deep-research-pattern/SKILL.md`): `compressor/`, `writer/`, `fact-checker/`. Don't add aspirationally — each extra role is one more LLM call's worth of latency and cost.

## When to use a subagent vs. a skill

| Use a **skill** when… | Use a **subagent** when… |
|-----------------------|--------------------------|
| The task is a procedure / recipe / template | The task is a *role* with judgment + multiple skills |
| Stateless — same instructions each time | Has a distinct persona, voice, or scope |
| One agent persona is fine | You want isolated context (smaller, focused) |
| Composes well with other skills | Owns a set of skills no other agent should touch |

Skills mediate **what** to do. Subagents mediate **who** does it.
