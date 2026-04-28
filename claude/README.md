# Claude

Skills, agents, hooks, and slash commands for Claude — both the API and Claude Code.

## What goes here

| Type | Format | Where it lives in a project |
|------|--------|------------------------------|
| **Skill** | Folder with `SKILL.md` (YAML frontmatter + markdown body) | `.claude/skills/<name>/` |
| **Agent** | Markdown with frontmatter (`name`, `description`, `tools`) | `.claude/agents/<name>.md` |
| **Slash command** | Markdown file with prompt template | `.claude/commands/<name>.md` |
| **Hook** | Shell command + matcher in `settings.json` | `.claude/settings.json` (under `hooks`) |
| **Sub-agent** | Same as agent, scoped to a parent flow | `.claude/agents/<name>.md` |

## SKILL.md format

```markdown
---
name: skill-name
description: One sentence on what this skill does and when to use it.
license: <license-id>
metadata:
  author: <name>
  version: "1.0"
---

# Skill body
Workflows, rules, examples. Keep under ~500 lines and push detail
into a `references/` subfolder.
```

The same SKILL.md format works for **deepagents**, so skills here are portable
between Claude Code and any deepagents-compatible runner.

## How to install a skill in a project

```bash
# From this repo:
cp -r claude/<skill-name> /path/to/project/.claude/skills/
```

Or symlink for live editing:
```bash
ln -s "$(pwd)/claude/<skill-name>" /path/to/project/.claude/skills/<skill-name>
```

## References

- [Claude Code documentation](https://docs.claude.com/en/docs/claude-code)
- [Skills overview](https://docs.claude.com/en/docs/claude-code/skills)
- [Building agents](https://docs.claude.com/en/docs/claude-code/agents)
- [Hooks](https://docs.claude.com/en/docs/claude-code/hooks)
- [Slash commands](https://docs.claude.com/en/docs/claude-code/slash-commands)

## Skills here

(none yet — `documentation/` at the repo root works for Claude as-is, since it follows the SKILL.md format)
