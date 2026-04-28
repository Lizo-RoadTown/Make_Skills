# VS Code

Settings, snippets, tasks, and extensions configurations for VS Code.

## What goes here

| Type | Format | Where it lives in a project |
|------|--------|------------------------------|
| **Workspace settings** | JSON | `.vscode/settings.json` |
| **Tasks** | JSON | `.vscode/tasks.json` |
| **Launch configs** | JSON | `.vscode/launch.json` |
| **Snippets** | JSON (per language) | `.vscode/<lang>.code-snippets` |
| **Recommended extensions** | JSON | `.vscode/extensions.json` |
| **Editor config** | INI | `.editorconfig` (repo root) |

## How to install in a project

```bash
cp -r vs_code/<bundle>/.vscode /path/to/project/
cp vs_code/<bundle>/.editorconfig /path/to/project/
```

## Copilot agent skills inside VS Code

Agent skills (the SKILL.md format) for VS Code Copilot are documented in [../copilot/README.md](../copilot/README.md#agent-skills-vs-code-copilot-copilot-cli-copilot-cloud-agent). The same skills run in Copilot CLI and Copilot cloud agent — they aren't VS Code-specific. Settings of interest live in `.vscode/settings.json`:

- `chat.agentSkillsLocations` — extra directories to scan for skills
- `chat.useCustomizationsInParentRepositories` — walk up to parent repos (useful in monorepos)

## References

- [VS Code workspace settings](https://code.visualstudio.com/docs/getstarted/settings)
- [Tasks](https://code.visualstudio.com/docs/editor/tasks)
- [Snippets](https://code.visualstudio.com/docs/editor/userdefinedsnippets)
- [Recommended extensions](https://code.visualstudio.com/docs/editor/extension-marketplace#_workspace-recommended-extensions)
- [VS Code agent skills (Copilot)](https://code.visualstudio.com/docs/copilot/customization/agent-skills)

## Bundles here

(none yet)
