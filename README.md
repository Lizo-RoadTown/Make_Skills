# Make_Skills

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

The agent platform engine. Takes recognized patterns and embodies them as runnable capability — the system that turns a pattern source into a usable skill, registers it, and makes it available to any consuming application.

## What this repo is

The reusable engine. Provides:

- Per-user AI agent runtime (orchestrator + subagent clan)
- Skill compilation pipeline: markdown `.md` → runnable agent capability
- Skill registry + sharing
- Multi-model provider registry (Anthropic / OpenAI / Google / Ollama / etc.) with BYO API keys per user
- Per-tenant semantic memory (LanceDB, episodic + session memory in one typed table)
- Pillar 0 tenant isolation (Postgres RLS + ContextVar tenant resolution)
- MCP server surface for memory + skill access
- Observability hooks for telemetry to consumer-side dashboards

## What this repo is NOT

- A student-facing product. That's [`Lizo-RoadTown/humancensys-app`](https://github.com/Lizo-RoadTown/humancensys-app) — the first consumer.
- A development tool for Liz. That's [`Lizo-RoadTown/the-loom`](https://github.com/Lizo-RoadTown/the-loom) — the personal AI substrate that lives during dev, never in deployed runtime.
- A specific UI, identity provider, or branding. Consumers bring those.

See [`docs/proposals/make-skills-engine-vs-consumer-scope.md`](docs/proposals/make-skills-engine-vs-consumer-scope.md) for the engine/consumer boundary.

## Architecture

```text
Consumer app (e.g., humancensys-app, future health-app, future game-app)
   |
   |  HTTPS + JWT (HS256 via AUTH_SECRET)
   v
Make_Skills engine (this repo)
   - platform/api/            FastAPI runtime + agent endpoints
   - platform/api/memory/     LanceDB tenant-scoped memory MCP
   - platform/api/auth.py     JWT verification + tenant resolution
   - scripts/                 Engine tooling
   - skills/                  Skill source files (.md)
   - subagents/               Agent definitions
```

Consumers integrate via:

- HTTPS REST for agent management + chat
- MCP for memory read/write/search

## Quick start (self-host)

```bash
git clone https://github.com/Lizo-RoadTown/Make_Skills.git
cd Make_Skills/platform/deploy
cp .env.template .env
# Edit .env -- at minimum set ANTHROPIC_API_KEY
docker compose up -d --build
```

The engine listens on `:8000`. Point a consumer app at it (the first one is humancensys-app).

## Relationship to other repos

| Repo | Role |
|---|---|
| `Lizo-RoadTown/Make_Skills` | This repo -- the engine |
| `Lizo-RoadTown/humancensys-app` | The student-facing consumer (Next.js + Auth.js + lessons) |
| `Lizo-RoadTown/the-loom` | Liz's dev substrate (project intelligence, observability) -- dev-time only |
| `Lizo-RoadTown/project-starter` | Day-1 scaffolding for new projects |
| `Lizo-RoadTown/claude-skills-marketplace` | Public skills marketplace |

## Documentation

- [Architecture overview](ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](ROADMAP.md)
- [Proposals](docs/proposals/)
- [Runbooks](docs/runbooks/)

## License

Apache 2.0 -- see [LICENSE](LICENSE).
