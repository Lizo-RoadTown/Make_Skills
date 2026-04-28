# GitHub Copilot

Custom instructions, prompt files, and skillsets for GitHub Copilot.

## What goes here

| Type | Format | Where it lives in a project |
|------|--------|------------------------------|
| **Custom instructions** | Markdown | `.github/copilot-instructions.md` |
| **Prompt files** | Markdown with frontmatter | `.github/prompts/<name>.prompt.md` |
| **Path-specific instructions** | Markdown with `applyTo` glob | `.github/instructions/<name>.instructions.md` |
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

## Skillsets here

(none yet)
