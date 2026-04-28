# skills/

Canonical SKILL.md skills root for this repo. Loaded by deepagents via `skills=["./skills/", ...]` in `deepagents.toml`. Compatible with Claude Code, GitHub Copilot, and any other [agentskills.io](https://agentskills.io)-compatible agent.

## Layout

```
skills/
├── README.md                       (this file)
├── <skill-name>/
│   ├── SKILL.md                    (frontmatter: name, description; body: instructions)
│   ├── references/                 (long-form reference content the skill links into)
│   ├── scripts/                    (helper scripts the skill can execute)
│   └── assets/                     (images, templates, etc.)
└── _upstream/                      (gitignored — refreshed via scripts/sync-upstream.sh)
    └── anthropics-skills/
        └── skills/                 (17 reference skills from anthropics/skills)
```

## SKILL.md format

```markdown
---
name: skill-name                  # MUST match folder name. lowercase, hyphens, max 64 chars.
description: One sentence on what this skill does and when to use it. (max 1024 chars)
# optional:
argument-hint: <hint shown after slash command>
user-invocable: true
disable-model-invocation: false
---

# Skill body
Instructions, workflows, examples. Reference extra files with relative
markdown links: [template](./references/template.md)
```

**Gotcha:** if folder name ≠ `name:` field, OR the name has a slash/colon/dot/namespace prefix, the skill silently fails to load.

## Loading

These skills are loaded automatically by deepagents when the agent runs from this repo root. They are also automatically picked up by:

- **Claude Code / Claude.ai** — symlink or copy into a project's `.claude/skills/<name>/` (or globally to `~/.claude/skills/<name>/`)
- **GitHub Copilot in VS Code** — symlink or copy into `.github/skills/<name>/`, `.claude/skills/<name>/`, or `.agents/skills/<name>/`; or add this folder to `chat.agentSkillsLocations` in VS Code settings

## Skills here

| Skill | Description |
|-------|-------------|
| [documentation/](documentation/) | Write/update documentation in this codebase |
| [deep-research-pattern/](deep-research-pattern/) | Architectural pattern for multi-agent deep research (5-role decomposition + context isolation). Drawn from open_deep_research and NVIDIA AI-Q. |
| [eval-deep-research/](eval-deep-research/) | Run the deep_research_bench (DRB) harness against the research subagents — RACE + FACT scores. |
| [document-parsing/](document-parsing/) | Convert PDFs / DOCX / PPTX / scanned images into LLM-friendly markdown (LlamaParse, Claude native PDFs, Marker, Docling, Unstructured). |
| [web-app-scaffold/](web-app-scaffold/) | Scaffold a deployable web app for a specified stack (frontend host + framework + API + DB + domain). Agentic — probes, decides, executes. Has an [intake form](web-app-scaffold/intake.md) and stack [presets](web-app-scaffold/references/). |
| [agentic-skill-design/](agentic-skill-design/) | Meta-skill for designing skills that DECIDE and EXECUTE rather than ask the user permission for every choice. Captures the PROBE → DECIDE → ACT → REPORT pattern. |
| [lessons-learned/](lessons-learned/) | Walk back through prior chat transcripts to find systematic friction patterns (recurring info needs, corrections, negotiations) and crystallize them into intake forms + memory updates. |
| [roadmap-maintenance/](roadmap-maintenance/) | Keep `ROADMAP.md` current as work ships. Agents flip statuses via `update_roadmap_status`; users amend manually anytime. File-backed, rendered at `/roadmap` in the UI. |
| [open-source-documentation/](open-source-documentation/) | Maintain the `docs/` tree (concepts/how-to/reference/decisions/proposals/per-pillar) for the open-source project. Defines the ADR pattern, the two-mode discipline for every doc, and the freshness rules for keeping docs current. |

## Refreshing the upstream library

```bash
bash scripts/sync-upstream.sh                  # Bash / Git Bash
powershell -File scripts\sync-upstream.ps1     # Windows PowerShell
```
