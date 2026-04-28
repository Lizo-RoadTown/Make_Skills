# Make_Skills

A collection of agent skills, prompts, and editor configurations,
organized by platform. Each platform's folder has its own README explaining
the format and how to install.

## Platforms

| Folder | What goes there |
|--------|-----------------|
| [claude/](claude/) | Skills (SKILL.md), agents, slash commands, hooks for Claude Code |
| [copilot/](copilot/) | Custom instructions, prompt files, and skillsets for GitHub Copilot |
| [chatgpt/](chatgpt/) | Custom GPTs, project instructions, and account-wide instructions |
| [vs_code/](vs_code/) | Workspace settings, tasks, snippets, recommended extensions |

## Cross-platform skills

Some skills work across multiple platforms because the underlying format
(SKILL.md, markdown prompt, etc.) is shared. These live at the repo root:

| Skill | Compatible with |
|-------|-----------------|
| [documentation/](documentation/) | Claude Code, deepagents, any SKILL.md runner |

## Adding a new skill

1. Decide which platform(s) it targets
2. If platform-specific: create a folder under that platform's directory
3. If cross-platform: create at the repo root and list it in the table above
4. Follow the format conventions in the relevant platform README
5. Update this README's tables

## Author

Elizabeth Osborn — lizosborn@gmail.com
