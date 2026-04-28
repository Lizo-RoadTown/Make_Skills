# GitHub Copilot

Custom instructions, prompt files, and skillsets for GitHub Copilot.

## What goes here

| Type | Format | Where it lives in a project |
|------|--------|------------------------------|
| **Custom instructions** | Markdown | `.github/copilot-instructions.md` |
| **Prompt files** | Markdown with frontmatter | `.github/prompts/<name>.prompt.md` |
| **Path-specific instructions** | Markdown with `applyTo` glob | `.github/instructions/<name>.instructions.md` |
| **Agent skills** | Folder with `SKILL.md` (open agentskills.io standard) | `.github/skills/<name>/`, `.claude/skills/<name>/`, or `.agents/skills/<name>/` |
| **Skillsets** | JSON manifest + tool definitions | Copilot Extensions / GitHub App |

## Custom instructions format

A single repo-wide `copilot-instructions.md`:

```markdown
# Project context for Copilot

We are building <project>. Use <language>, <framework>, <conventions>.

When writing tests, use <test framework>.
When writing commits, follow Conventional Commits.
Avoid <anti-patterns>.
```

## Path-specific instructions

`.github/instructions/python.instructions.md`:

```markdown
---
applyTo: "**/*.py"
---

For Python files:
- Use type hints
- Format with ruff
- Docstrings in Google style
```

## Prompt files (reusable prompts)

`.github/prompts/new-adr.prompt.md`:

```markdown
---
mode: agent
description: Create a new Architecture Decision Record
---

Create a new ADR following the template in docs/adr/template.md.
Number sequentially. Title should be a verb phrase.
```

## Agent skills (VS Code Copilot, Copilot CLI, Copilot cloud agent)

Copilot supports the **open [agentskills.io](https://agentskills.io) standard** — the same `SKILL.md` format used by Claude. Skills written for Claude generally work in Copilot unchanged. Reference: [VS Code docs — agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills).

### SKILL.md format

```markdown
---
name: skill-name                # lowercase, alphanumeric + hyphens, max 64 chars; MUST match folder name
description: One sentence on what it does and when to use it (max 1024 chars)
# optional:
argument-hint: <hint shown after slash command>
user-invocable: true            # default true; false hides from /slash menu
disable-model-invocation: false # default false; true prevents automatic loading
---

# Body — instructions, workflows, examples.
# Reference extra files with relative markdown links: [template](./test-template.js)
```

**Gotcha:** if the folder name doesn't match the `name` field, or the name has invalid characters (slashes, colons, dots, namespace prefixes like `myorg/foo`), the skill silently fails to load.

### Where Copilot looks for skills

**Workspace (per project):**

- `.github/skills/<name>/`
- `.claude/skills/<name>/` (shared with Claude Code)
- `.agents/skills/<name>/`
- Custom locations via the `chat.agentSkillsLocations` setting

**User profile (all projects):**

- `~/.copilot/skills/<name>/`
- `~/.claude/skills/<name>/`
- `~/.agents/skills/<name>/`

For monorepos, enable `chat.useCustomizationsInParentRepositories` so Copilot walks up to find parent-repo skills.

### Invoking skills in VS Code

- Type `/` in chat to list available skills, then pick one (e.g. `/webapp-testing for the login page`)
- Copilot also auto-loads skills whose `description` matches the user request
- `/skills` — open the Configure Skills menu
- `/create-skill` — generate a new skill from a description (AI-assisted)
- `Chat: Open Chat Customizations` — full UI for managing skills

### Cross-platform reuse

Because the SKILL.md format is shared with Claude (and deepagents), the skills under `../skills/` work in Copilot unchanged:

```bash
# Symlink one upstream skill so all agents in a project can use it
ln -s "$(pwd)/skills/_upstream/anthropics-skills/skills/pdf" /path/to/project/.claude/skills/pdf
```

Or copy into `.github/skills/<name>/` if you only want Copilot to see it. Or add `skills/` to `chat.agentSkillsLocations` in VS Code settings to make every skill in this repo visible to Copilot in any workspace.

## How to install in a project

```bash
# Repo-wide instructions
cp copilot/<file>/copilot-instructions.md /path/to/project/.github/

# Path-specific
cp copilot/<file>/instructions/* /path/to/project/.github/instructions/

# Prompt files
cp copilot/<file>/prompts/* /path/to/project/.github/prompts/
```

## References

- [Adding custom instructions for GitHub Copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
- [Prompt files (preview)](https://docs.github.com/en/copilot/customizing-copilot/about-customizing-github-copilot-chat-responses)
- [Copilot Extensions](https://docs.github.com/en/copilot/building-copilot-extensions)
- [Copilot Skillsets](https://docs.github.com/en/copilot/building-copilot-extensions/building-a-copilot-skillset-extension)
- [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) — SKILL.md format inside VS Code Copilot
- [Agent Skills open standard](https://agentskills.io) — vendor-neutral spec shared with Claude

## Skillsets here

(none yet)
