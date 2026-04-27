# Make_Skills

A collection of agent skills, each in its own folder following the deepagent
[SKILL.md specification](https://github.com/langchain-ai/deepagents).

## Skills

| Skill | Purpose |
|-------|---------|
| [documentation/](documentation/) | Plan, write, and audit project documentation using Diátaxis, ADRs, and docs-as-code |

## Skill format

Each skill is a folder:

```
skill-name/
├── SKILL.md         # YAML frontmatter + instructions (required)
├── references/      # Long-form docs the skill links into (optional)
├── scripts/         # Executable helpers the skill can call (optional)
└── assets/          # Templates, snippets, prompts (optional)
```

Folder names are lowercase-kebab-case. Keep `SKILL.md` under ~500 lines —
push detail into `references/`.

## Adding a new skill

1. Copy `documentation/` as a template
2. Rewrite `SKILL.md` (frontmatter + instructions)
3. Replace `references/`, `scripts/`, `assets/` with your skill's content
4. Update this README's table

## Author

Elizabeth Osborn — lizosborn@gmail.com
