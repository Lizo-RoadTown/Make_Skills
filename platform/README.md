# platform/

Docker-based always-on agent platform. Runs the deepagents agent (and its subagents) as a long-lived service with **persistent conversation state** so you can leave it running and resume where you left off — instead of starting fresh every session.

The chat UI lives separately under [`../web/`](../web/) (Next.js, deployed to Vercel at humancensys.com). This folder is API + state only.

Architecture is influenced by [NVIDIA AI-Q](https://github.com/NVIDIA-AI-Blueprints/aiq) (Postgres for checkpoints + single workflow config), minus the NVIDIA-specific lock-in.

> **Why we don't use AI-Q's runtime as-shipped:** the [RAG support matrix](https://github.com/NVIDIA-AI-Blueprints/rag/blob/main/docs/support-matrix.md) requires multi-H100 GPUs and Ubuntu 22.04. We take the architecture, run on Anthropic's API, deploy on whatever Docker host is convenient.

## Reference clones (read-only)

`bash scripts/sync-references.sh` (or `powershell -File scripts\sync-references.ps1`) clones three reference repos into `platform/_reference/` (gitignored):

- `aiq/` — NVIDIA's AI-Q blueprint
- `open_deep_research/` — LangChain's reference deep-research agent
- `deepagents/` — LangChain's deepagents library

These are patterns to copy from, not dependencies to import.

## Layout

```
platform/
├── README.md                     (this file)
├── REMOTE_ACCESS.md              Tailscale / Cloudflare Tunnel setup
├── requirements.txt              Python deps for the api service
├── deploy/
│   ├── docker-compose.yml        Three services: api + postgres + grafana
│   ├── .env.template             Keys + Postgres + LangSmith
│   ├── .env                      (gitignored — your filled-in copy)
│   ├── Dockerfile                Python 3.12 image with deepagents + lancedb
│   └── grafana/                  Provisioning for datasource + dashboards
├── api/
│   ├── main.py                   FastAPI: /chat, /chat/stream, /memory/*, /healthz
│   ├── agent.py                  Single integration point with deepagents
│   ├── memory/                   LanceDB-backed semantic memory
│   │   ├── lance.py              Connection, schema, search/insert
│   │   ├── recorder.py           Background extraction after each chat turn
│   │   └── recall.py             Tool the agent uses to query memory
│   └── tools/
│       └── db.py                 query_db tool — read-only SQL on postgres
└── eval/                         (gitignored) Clone-on-demand eval harnesses
```

The root [`deepagents.toml`](../deepagents.toml) is the single workflow config — model, skills paths, subagents dir. The api container reads it at startup.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│ Browser (humancensys.com on Vercel  /  localhost:3000)    │
│   ↕ HTTPS                                                 │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│ Docker Compose (your machine, optionally Tailscale-shared)│
│  ┌────────────┐  ┌──────────┐  ┌───────────┐             │
│  │api :8001   │──│postgres  │  │grafana    │             │
│  │FastAPI     │  │:5432     │  │:3001      │             │
│  │+ agent     │  │checkpoints│  │dashboards │             │
│  │+ recall    │  │+ analytics│  │           │             │
│  │+ recorder  │  └──────────┘  └───────────┘             │
│  └─────┬──────┘                                            │
│        │                                                   │
│   ┌────▼─────┐                                             │
│   │LanceDB   │  semantic memory (volume: memory-data)     │
│   └──────────┘                                             │
│                                                            │
│   read-only volumes from repo root:                        │
│     ../skills/    ../subagents/    ../AGENTS.md           │
│     ../deepagents.toml                                     │
└────────────────────────────────────────────────────────────┘
```

For laptop access while the desktop is running the stack: see [REMOTE_ACCESS.md](REMOTE_ACCESS.md).

## Why each service

- **api (FastAPI)** — wraps `create_deep_agent(...)` and exposes it over HTTP. The web UI (Next.js on Vercel) calls this. Includes the `recall` tool and `query_db` tool the agent uses, plus `/memory/*` endpoints the UI uses.
- **postgres** — LangGraph's `AsyncPostgresSaver` writes per-thread conversation state here. Without it, container restarts wipe in-flight conversations.
- **grafana** — visual dashboards over the postgres data. Anonymous editor mode locally; tighten for prod.
- **LanceDB** (in-process, not a service) — semantic memory store. Records extracted from each chat turn live here forever; the agent recalls them on demand.

## Setup

```bash
cd platform/deploy
cp .env.template .env
# fill in ANTHROPIC_API_KEY (LLAMA_CLOUD_API_KEY optional, POSTGRES_PASSWORD not needed in trust mode)
docker compose up -d --build
docker compose logs -f api          # watch the agent build the first time
# API:       http://localhost:8001
# API docs:  http://localhost:8001/docs
# Grafana:   http://localhost:3001
docker compose down                 # stop; postgres + memory data preserved
docker compose down -v              # nuke everything (lose conversations + memory)
```

## Status

- [x] FastAPI + agent + checkpoints — verified end-to-end
- [x] Postgres trust mode (no password needed for personal local stack)
- [x] Grafana with auto-provisioned postgres datasource
- [x] LanceDB semantic memory + recall tool + recorder + /memory endpoints — verified end-to-end
- [x] Web chat UI in `../web/`, deployed to Vercel at humancensys.com
- [ ] Public agent endpoint — when ready, deploy this stack to Render/Fly so the Vercel UI can reach a public URL instead of localhost

## Architecture notes worth keeping

- **Volume mounts make skills/subagents/AGENTS.md/deepagents.toml hot-reloadable.** Edit a file in your editor → next agent invocation sees the change. The api process only restarts if you change `deepagents.toml` itself.
- **Thread persistence is per-`thread_id`** stored in postgres. The Next.js UI sets a thread_id per session in localStorage; restart anything except `postgres -v` and the conversation resumes.
- **Memory persists separately** in the LanceDB volume. `down -v` clears both postgres AND lancedb.
- **`docker compose down` keeps data**; `docker compose down -v` deletes it.
