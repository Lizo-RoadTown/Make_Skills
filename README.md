# Make_Skills

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-humancensys.com-blue)](https://humancensys.com)

**An academic agentic-AI multiplayer world-building tool.** Students build their own AI and carry it through their studies, leveling it up over time, taking it on real-world quests (build a website for a local business, reproduce a published methodology, compose music with an AI co-pilot), and eventually contributing to online neural network building with their classmates.

Open-source and hosted.

---

## What it is

- A multi-agent platform: one orchestrator plus a clan of specialist subagents (planner, researcher, writer, custom). Each subagent is configured separately.
- A semantic memory layer: conversations, decisions, and lessons are extracted and stored in LanceDB. Future sessions recall what mattered without re-loading transcripts.
- A skill library: markdown files that codify how the agents work. Skills can graduate into hard-coded tools.
- An observability dashboard: token cost, latency, agent activity, recorder volume.
- A documentation site at [humancensys.com/docs](https://humancensys.com/docs).
- Pillar 1 (in design): character builder for the agent clan, with simple emotions, evolution as agents gain skills, and a 3D viewport.
- Pillar 2 (in design): a quest system covering music, business, science, and social impact.
- Phase 2 (post-MVP): group quests, shared knowledge graphs, student-formed organizations, collective neural network design.

---

## Quick start (self-host)

```bash
git clone https://github.com/Lizo-RoadTown/Make_Skills.git
cd Make_Skills

# 1. Configure the agent backend
cd platform/deploy
cp .env.template .env
# Edit .env — at minimum set ANTHROPIC_API_KEY (or pick a different provider)
docker compose up -d --build

# 2. Run the web UI
cd ../../web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Documentation at [`docs/`](docs/) or [humancensys.com/docs](https://humancensys.com/docs).

---

## Architecture at a glance

```
   Browser (humancensys.com on Vercel  /  localhost:3000)
                          │
                          ↕ HTTPS
                          │
   ┌──────────────────────┴────────────────────────────┐
   │ Docker Compose (your machine OR Render)            │
   │   ┌────────┐   ┌──────────┐   ┌───────────┐       │
   │   │api     │←─→│postgres  │   │grafana    │       │
   │   │FastAPI │   │ckpts +   │   │(local ops)│       │
   │   │+agent  │   │analytics │   └───────────┘       │
   │   │+memory │   └──────────┘                       │
   │   └────────┘                                       │
   │      │                                             │
   │      ▼                                             │
   │   LanceDB    semantic memory (volume)              │
   └────────────────────────────────────────────────────┘
```

Two deployment modes:

| | Self-host | Hosted-multitenant |
|---|---|---|
| Who runs it | You, on your machine or VPS | Liz, at humancensys.com |
| Auth | None | OAuth (TBD) |
| Data | Local | Tenant-scoped, shared infrastructure |

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the layered model and container topology.

---

## Model providers

Each subagent picks its own model.

| Provider | Notes |
|----------|-------|
| Anthropic (Claude) | Default |
| OpenAI (GPT) | |
| Google (Gemini) | Free tier available |
| Hugging Face (Inference Providers) | Free tier available |
| Together AI | |
| Groq | |
| Ollama | Local, no API key |

Adding a new provider is roughly ten lines in [`platform/api/model_registry.py`](platform/api/model_registry.py). See [`web/content/docs/concepts/model-providers.mdx`](web/content/docs/concepts/model-providers.mdx).

---

## Project layout

```
Make_Skills/
├── README.md, ARCHITECTURE.md, CONTRIBUTING.md, LICENSE
├── AGENTS.md                    Root orchestrator persona
├── deepagents.toml              Agent runtime config
├── skills/                      Skill library
├── subagents/                   Specialist subagents (planner, researcher, ...)
├── platform/                    Docker stack (api + postgres + grafana + lancedb)
│   └── api/                       FastAPI + deepagents runtime
├── web/                         Next.js UI (Vercel-deployed)
│   ├── app/                       Routes (chat, memory, roadmap, docs, agents, ...)
│   └── content/docs/              MDX docs (Fumadocs-rendered)
├── docs/                        Repo-side docs: ADRs, design proposals
│   ├── decisions/                 Architecture decisions
│   └── proposals/                 Pre-decision design docs
├── render.yaml                  Render Blueprint for cloud deploy
└── scripts/                     sync-upstream, backfill, smoke-tests
```

---

## Status

Today:

- Multi-agent runtime (orchestrator + planner + researcher subagents)
- Semantic memory (LanceDB + Haiku-powered recorder + recall tool)
- Memory backfill from Claude Code transcripts
- Observability dashboard (Recharts)
- File-backed roadmap with agent-update tooling
- Fumadocs documentation site
- Mobile-responsive nav
- Render + Vercel deploy
- Apache 2.0 license

In design:

- Pillar 1 — agent builder UI and 3D creature clan ([builder flow](docs/proposals/agent-builder-flow.md), [creature UI](docs/proposals/agent-creatures-ui.md))
- Pillar 2 — quest system ([quest system](docs/proposals/quest-system.md))
- Agent retirement and clan optimization ([retirement](docs/proposals/agent-retirement-and-clan-optimization.md))
- Knowledge observatory (Pillar 3c, multiplayer)
- Tenant abstraction for hosted-multitenant
- BYO Claude Code via MCP ([proposal](docs/proposals/byo-claude-code-via-mcp.md))
- BYO personal Ollama — point the hosted site at your own Ollama endpoint ([proposal](docs/proposals/byo-personal-ollama.md), [docs](web/content/docs/concepts/byo-ollama.mdx))

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Every PR considers both deployment modes (self-host and hosted-multitenant), with documentation and tests for both.

---

## License

Apache 2.0 ([`LICENSE`](LICENSE)). See [ADR-001](docs/decisions/001-license-apache-2.md) for the reasoning.

---

## Author

Elizabeth Osborn — humancensys.com
