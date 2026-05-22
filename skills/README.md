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
| [agentic-skill-design/](agentic-skill-design/) | Meta-skill for designing skills that DECIDE and EXECUTE rather than ask the user permission for every choice. Captures the PROBE → DECIDE → ACT → REPORT pattern. |
| [deep-research-pattern/](deep-research-pattern/) | Architectural pattern for multi-agent deep research (3-role decomposition + context isolation). Drawn from open_deep_research and NVIDIA AI-Q. |
| [design-evaluation/](design-evaluation/) | Evaluate a design question with multiple options across dimensions that matter for the project — produces a tradeoff matrix, scores each option, recommends a path. |
| [documentation/](documentation/) | Write/update documentation using Diátaxis + ADRs + docs-as-code. |
| [document-parsing/](document-parsing/) | Convert PDFs / DOCX / PPTX / scanned images into LLM-friendly markdown (LlamaParse, Claude native PDFs, Marker, Docling, Unstructured). |
| [eval-deep-research/](eval-deep-research/) | Run the deep_research_bench (DRB) harness against the research subagents — RACE + FACT scores. |
| [next-actions-planning/](next-actions-planning/) | Produce a grounded "what to do next" plan for the project — based on what shipped, what's open, what blocks what, and what the user has signaled they care about. |

### Proprietary skills (not in this repo)

A second set of skills lives outside the public repo in a gitignored `skills_private/` directory. These describe how Make_Skills uniquely works — together they form the upskilling triad, the house-style discipline, and project-specific scaffolding — and are kept proprietary as the platform's competitive differentiator. See [`docs/plans/2026-05-21-project-starter-recommendations.md`](../docs/plans/2026-05-21-project-starter-recommendations.md) §1 for the publishing decision.

The proprietary set: `agentic-upskilling`, `orchestration-cataloging`, `lessons-learned`, `roadmap-maintenance`, `open-source-documentation`, `proposal-authoring`, `web-app-scaffold`.

## Refreshing the upstream library

```bash
bash scripts/sync-upstream.sh                  # Bash / Git Bash
powershell -File scripts\sync-upstream.ps1     # Windows PowerShell
```
