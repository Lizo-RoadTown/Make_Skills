# Make_Skills

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Live](https://img.shields.io/badge/live-humancensys.com-blue)](https://humancensys.com)

**An academic agentic-AI multiplayer world-building tool.** Students build their own AI and carry it through their studies, leveling it up over time, taking it on real-world quests (build a website for a local business, reproduce a published methodology, compose music with an AI co-pilot), and eventually contributing to online neural network building with their classmates.

Open-source and hosted.

---

## What it is, concretely

- **A multi-agent platform.** You build one orchestrator + a clan of specialist subagents (planner, researcher, writer, custom). Each is configurable separately.
- **A semantic memory layer.** Conversations, decisions, and lessons are extracted and stored in LanceDB. Future sessions recall what mattered without re-loading full transcripts.
- **A skill library.** Markdown files that codify how the agents work. Some skills graduate into hard-coded tools as you use them more.
- **An observability dashboard.** Token cost, latency, agent activity, recorder volume — visible in the UI.
- **A docs site.** Real software documentation at [humancensys.com/docs](https://humancensys.com/docs).
- **Pillar 1 (in design):** a Tomagotchi-meets-Spore character builder for your agent clan, with simple emotions, evolution as they gain skills, and a 3D viewport.
- **Pillar 2 (in design):** a quest system with curated and AI-generated tasks across music, business, science, social impact.
- **Phase 2 (post-MVP):** group quests, shared knowledge graphs, student-formed organizations, collective neural network design.

It's an **academic tool** — not a productivity assistant, not a chatbot. It teaches engineering through play.

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

Open [http://localhost:3000](http://localhost:3000). Full docs at [`docs/`](docs/) or [humancensys.com/docs](https://humancensys.com/docs).

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

Two deployment modes (always supported, parallel):

| | Self-host | Hosted-multitenant |
|---|---|---|
| Who runs it | You, on your machine or VPS | Liz, at humancensys.com |
| Auth | None | OAuth (TBD) |
| Data | All yours, local | Tenant-scoped, shared infrastructure |

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the layered model + container topology decisions.

---

## Model providers (Pillar 1 — pick your creature's brain)

Each subagent picks its own model. Currently supported:

| Provider | Best for |
|----------|----------|
| **Anthropic** (Claude) | Default; smart and cost-efficient |
| **OpenAI** (GPT) | OpenAI-specific features |
| **Google** (Gemini) | Generous free tier |
| **Hugging Face** (Inference Providers) | **Free tier path for students** |
| **Together AI** | Fast inference of open models |
| **Groq** | Lowest-latency inference |
| **Ollama** | Local, no API key, privacy |

Adding a new provider is ~10 lines in [`platform/api/model_registry.py`](platform/api/model_registry.py). See [`docs/concepts/model-providers.mdx`](web/content/docs/concepts/model-providers.mdx).

---

## Project layout

```
Make_Skills/
├── README.md, ARCHITECTURE.md, CONTRIBUTING.md, LICENSE
├── AGENTS.md                    Root orchestrator persona
├── deepagents.toml              Agent runtime config
├── skills/                      The skill library (10+ skills)
├── subagents/                   Specialist subagents (planner, researcher, ...)
├── platform/                    The Docker stack (api + postgres + grafana + lancedb)
│   └── api/                       FastAPI + deepagents runtime
├── web/                         Next.js UI (Vercel-deployed)
│   ├── app/                       Routes (chat, memory, roadmap, docs, agents, ...)
│   └── content/docs/              MDX docs (Fumadocs-rendered)
├── docs/                        Repo-side docs: ADRs, design proposals
│   ├── decisions/                 Architecture decisions (audit trail)
│   └── proposals/                 Pre-decision design docs
├── render.yaml                  Render Blueprint for cloud deploy
└── scripts/                     sync-upstream, backfill, smoke-tests
```

---

## Status & roadmap

**Live and working today:**

- ✓ Multi-agent runtime (orchestrator + planner + researcher subagents)
- ✓ Semantic memory (LanceDB + Haiku-powered recorder + recall tool)
- ✓ Memory backfill from Claude Code transcripts
- ✓ Custom observability dashboard (Recharts)
- ✓ File-backed roadmap with agent-update tooling
- ✓ Fumadocs documentation site
- ✓ Mobile-responsive nav
- ✓ Render + Vercel wired end-to-end
- ✓ Apache 2.0 license

**In design (proposals open for review):**

- ⚠ Pillar 1 — agent builder UI + 3D creature clan ([builder flow](docs/proposals/agent-builder-flow.md), [creature UI](docs/proposals/agent-creatures-ui.md))
- ⚠ Pillar 2 — quest system ([quest system](docs/proposals/quest-system.md))
- ⚠ Agent retirement & clan optimization ([retirement](docs/proposals/agent-retirement-and-clan-optimization.md))
- ⚠ Knowledge observatory (Pillar 3c, multiplayer)
- ⚠ Tenant abstraction for hosted-multitenant
- ⚠ BYO Claude Code via MCP ([proposal](docs/proposals/byo-claude-code-via-mcp.md))

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Every PR considers both deployment modes (self-host AND hosted-multitenant), with documentation and tests for both.

We're open-source. You can fork, modify, run. Contributions welcome.

---

## License

Apache 2.0 ([`LICENSE`](LICENSE)). See [ADR-001](docs/decisions/001-license-apache-2.md) for the reasoning.

---

## Author

Elizabeth Osborn — humancensys.com
