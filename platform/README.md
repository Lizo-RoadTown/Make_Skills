# platform/

Docker-based always-on agent platform. Runs the deepagents agent (and its subagents) as a long-lived service with **persistent conversation state** so you can leave it running and resume where you left off — instead of starting fresh every session.

Architecture is influenced by [NVIDIA AI-Q](https://github.com/NVIDIA-AI-Blueprints/aiq) (three-service Docker Compose + Postgres for checkpoints + single workflow config), minus the NVIDIA-specific lock-in (NeMo Agent Toolkit, Nemotron, NIMs, Helm).

> **Why we don't use AI-Q's runtime as-shipped:** the [RAG support matrix](https://github.com/NVIDIA-AI-Blueprints/rag/blob/main/docs/support-matrix.md) requires 2× H100 / 2× B200 / 3× A100 GPUs, Ubuntu 22.04, CUDA 12.9, and 200GB disk for self-hosted. The "lite mode" requires an NGC account with quotas. We take the architecture, run on Anthropic's API, deploy on whatever Docker host is convenient.

## Reference clones (read-only)

`bash scripts/sync-references.sh` (or `powershell -File scripts\sync-references.ps1`) clones three reference repos into `platform/_reference/` (gitignored):

- `aiq/` — NVIDIA's AI-Q blueprint (read their `deploy/compose/docker-compose.yaml`, `configs/config_web_docker.yml`, `src/aiq_aira/agents/deep_researcher/prompts/planner.j2`)
- `open_deep_research/` — LangChain's reference deep-research agent (study `src/legacy/multi_agent.py`)
- `deepagents/` — LangChain's deepagents library (study `examples/deploy-gtm-agent/`)

These are patterns to copy from, not dependencies to import.

## Layout

```
platform/
├── README.md                     (this file)
├── requirements.txt              Python deps for the runtime services
├── deploy/                       AI-Q convention — deployment artifacts
│   ├── docker-compose.yml        Three services: api + postgres + chainlit
│   ├── .env.template             ANTHROPIC_API_KEY, POSTGRES_PASSWORD, ...
│   └── Dockerfile                (TBD) Python image with deepagents + chainlit
├── api/                          (TBD) FastAPI backend wrapping create_deep_agent
│   └── main.py
├── ui/                           (TBD) Chainlit chat surface
│   └── app.py
└── eval/                         (gitignored) Clone-on-demand eval harnesses (deep_research_bench, etc.)
```

The root `deepagents.toml` is the **single workflow config** — it tells the API which model, which skills, which subagents to load. The `platform/` services consume that file as the source of truth.

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│ Local browser  /  Tailscale-reachable laptop              │
│   ├─ chainlit    → :8000                                  │
│   ├─ Next.js UI  → :3000 (npm run dev in web/)            │
│   ├─ FastAPI     → :8001                                  │
│   └─ Grafana     → :3001                                  │
└──────────────────────┬────────────────────────────────────┘
                       │
┌──────────────────────▼────────────────────────────────────┐
│ Docker Compose                                             │
│  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌───────────┐    │
│  │chainlit │  │api     │  │postgres  │  │grafana    │    │
│  │:8000    │──│:8001   │──│:5432     │←─│:3001      │    │
│  │chat UI  │  │FastAPI │  │ckpts +   │  │dashboards │    │
│  │         │  │+agent  │  │analytics │  │           │    │
│  └─────────┘  └───┬────┘  └──────────┘  └───────────┘    │
│                   │                                        │
│   read-only volumes:                                       │
│     ../skills/    ../subagents/    ../AGENTS.md           │
│     ../deepagents.toml                                     │
└────────────────────────────────────────────────────────────┘
```

For laptop access while the desktop is running the stack: see [REMOTE_ACCESS.md](REMOTE_ACCESS.md). Recommended: Tailscale.

## Why each service

- **chainlit** — free, ChatGPT-like UI in ~20 lines of Python. Runs in front of the API. Replaceable with a custom Next.js UI later if you need richer interactions.
- **api (FastAPI)** — wraps `create_deep_agent(...)` and exposes it over HTTP. Decoupling UI from agent runtime means you can hit the agent from VS Code, browser, or CLI without going through chainlit.
- **postgres** — LangGraph's `PostgresSaver` checkpointer writes per-thread conversation state here. **This is what makes "always running" actually useful** — without it, each container restart wipes every in-flight conversation. AI-Q's `postgres:16` config is the reference.

## Why no Postgres for skills (still)

Skills remain markdown on disk under `../skills/`, mounted read-only. Postgres is only for **conversation state and async job checkpoints** — the things LangGraph needs to resume work after a restart. Skills are content, not state.

## Shallow vs. deep agent (from AI-Q)

The agent supports two modes, separated by bound:

| Mode | Bound | When |
|------|-------|------|
| **Shallow** | max 10 LLM turns, max 5 tool calls | Default. Direct questions, lookups, single-source answers. |
| **Deep** | max 2 outer loops, full planner→researcher topology | Triggered explicitly (user asks for "deep research", "report", or via UI toggle) or when shallow fails to satisfy success criteria. |

Encoded in the root [`AGENTS.md`](../AGENTS.md) routing hints.

## On a "skills MCP"

There's no canonical skills MCP from Anthropic. A few community projects expose `list_skills` / `load_skill` over MCP, but for a single-repo personal setup the volume mount gives the same affordance with zero infrastructure. Worth integrating only if you start managing skills across many repos or need indexed search.

## Setup

```bash
cd platform/deploy
cp .env.template .env
# fill in ANTHROPIC_API_KEY, POSTGRES_PASSWORD, LLAMA_CLOUD_API_KEY
docker compose up -d --build
docker compose logs -f api          # watch the agent build the first time
# UI:        http://localhost:8000
# API:       http://localhost:8001
# API docs:  http://localhost:8001/docs (FastAPI auto-generated)
docker compose down                 # stops; keeps postgres data in the volume
docker compose down -v              # nukes the postgres volume (loses conversations)
```

## Status

- [x] Architecture decided (AI-Q-influenced, three services)
- [x] [`deploy/docker-compose.yml`](deploy/docker-compose.yml) — three services + volume mount of repo + postgres healthcheck
- [x] [`deploy/Dockerfile`](deploy/Dockerfile) — single Python 3.12 image used by api + ui
- [x] [`deploy/.env.template`](deploy/.env.template) — keys + Postgres + LangSmith
- [x] [`api/main.py`](api/main.py) + [`api/agent.py`](api/agent.py) — FastAPI wrapping `create_deep_agent` + `PostgresSaver`, with `/chat`, `/chat/stream`, `/threads/{id}/state`, `/healthz`
- [x] [`ui/app.py`](ui/app.py) — chainlit, streams from API, persists thread_id per session
- [ ] First successful end-to-end run — **expect to iterate.** The deepagents API surface (exact kwargs to `create_deep_agent`, exact `astream` chunk shape) may need adjustment when this first runs against the installed version. The single integration point is `api/agent.py`.

## Architecture notes worth keeping

- **Volume mounts make skills/subagents/AGENTS.md/deepagents.toml hot-reloadable.** Edit a SKILL.md in your editor → next agent invocation sees the change. The api process only needs a restart if you change the deepagents.toml ITSELF (which determines what gets loaded at agent-build time).
- **Thread persistence is per-`thread_id`.** Chainlit sets a thread_id per chat session and stores it in `cl.user_session`. Restart the chainlit container — the session resumes. Restart the api container — same thread_id resumes from postgres. Restart postgres without the volume — you lose everything.
- **`docker compose down` keeps postgres data**; `docker compose down -v` deletes it.
