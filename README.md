# Make_Skills

A personal multi-agent skill library for VS Code. Houses cross-platform [agentskills.io](https://agentskills.io)-format skills, deepagents agent configs (`AGENTS.md`, `deepagents.toml`), subagents, and platform-specific non-skill content (Copilot custom instructions, ChatGPT GPT prompts, VS Code workspace settings).

Designed around the canonical deepagents layout so the repo root *is* a runnable agent — but skills are also distributable to Claude Code, GitHub Copilot, and any other agentskills.io-compatible runner.

## Layout

```
Make_Skills/
├── AGENTS.md                  Root orchestrator persona (loaded into deepagents memory)
├── deepagents.toml            Agent config — model, skill paths, sandbox
├── skills/                    Cross-platform SKILL.md skills (canonical)
│   └── _upstream/             Gitignored — anthropics/skills clone, refresh via script
├── subagents/                 Specialist subagents (each is its own AGENTS.md + deepagents.toml + skills/)
├── scripts/                   Repo automation (sync upstream skills, etc.)
├── platform/                  Docker-based platform for running the agent persistently
├── copilot/                   Non-skill Copilot content: custom instructions, prompt files
├── chatgpt/                   Non-skill ChatGPT content: GPT instructions, project instructions
└── vs_code/                   VS Code workspace settings, tasks, snippets, extensions
```

## Quick start

```bash
# 1. Clone the upstream Anthropic skill library (17 reference skills)
bash scripts/sync-upstream.sh                       # macOS / Linux / Git Bash
powershell -File scripts\sync-upstream.ps1          # Windows

# 2. Run the agent (from this repo root, once deepagents is installed)
pip install deepagents
deepagents deploy
```

For the Docker-based always-on platform, see [platform/README.md](platform/README.md).

## Where things go

| If you're adding… | …it goes here |
|-------------------|---------------|
| A SKILL.md skill (any agent can use it) | [`skills/<name>/`](skills/) |
| A deepagents specialist subagent | [`subagents/<name>/`](subagents/) |
| Copilot custom instructions / prompt files | [`copilot/`](copilot/) |
| ChatGPT GPT instructions | [`chatgpt/`](chatgpt/) |
| VS Code workspace settings / extensions | [`vs_code/`](vs_code/) |
| Repo-level automation scripts | [`scripts/`](scripts/) |

## Cross-agent skill compatibility

The `SKILL.md` format is the open [agentskills.io](https://agentskills.io) standard. Skills written here work unchanged in:

- **deepagents** (this repo's agent runtime) — via `skills=["./skills/"]`
- **Claude Code / Claude.ai / Claude API** — symlink into `.claude/skills/<name>/`
- **GitHub Copilot in VS Code, Copilot CLI, Copilot cloud agent** — symlink into `.github/skills/<name>/` or add `skills/` to `chat.agentSkillsLocations`

See [skills/README.md](skills/README.md) for the SKILL.md format and per-agent install paths.

## Upstream reference library

The official [anthropics/skills](https://github.com/anthropics/skills) repo (17 reference skills) is cloned to [skills/_upstream/anthropics-skills/](skills/_upstream/) — gitignored, refreshed with the sync scripts above.

## Author

Elizabeth Osborn — lizosborn@gmail.com
