# Deploying the platform stack to Render

Goal: get the agent API running publicly at `https://make-skills-api-xxxx.onrender.com` so humancensys.com can actually chat from any browser, anywhere, regardless of whether your desktop is on.

The work is mostly clicking. Code is already prepped: [`render.yaml`](../render.yaml) defines the services, the Dockerfile bakes in skills/subagents, FastAPI has CORS for humancensys.com.

---

## Step 1 — Push the code so Render can read it

The `render.yaml` lives at the repo root and Render needs it on `main`. From your VS Code terminal (or via the GitHub UI):

```bash
git push origin main
```

(If push-to-main is blocked by your repo policy: open a PR for the recent commits and merge it. The relevant commits are the `Add LanceDB-backed semantic memory…`, `Remove chainlit…`, `Add /memory/ingest…`, plus this Render prep commit.)

## Step 2 — Create the Blueprint in Render

1. Go to https://dashboard.render.com → **New** (top right) → **Blueprint**
2. Connect your GitHub if you haven't (Render likely already has access since you have your linear-programming app there)
3. Pick the **`Lizo-RoadTown/Make_Skills`** repo
4. Render reads [`render.yaml`](../render.yaml) and shows what it'll create:
   - **Web Service:** `make-skills-api` (Docker, Starter plan, with 1 GB persistent disk)
   - **Database:** `make-skills-db` (PostgreSQL Free)
5. Click **Apply**

## Step 3 — Set the secrets

Render will pause the deploy and ask for the four secret env vars (the ones marked `sync: false` in `render.yaml`). Click into `make-skills-api` → **Environment** and set:

| Key | Value | Required? |
|-----|-------|-----------|
| `ANTHROPIC_API_KEY` | from console.anthropic.com | **Yes** |
| `LLAMA_CLOUD_API_KEY` | from cloud.llamaindex.ai | Recommended (document parsing) |
| `TAVILY_API_KEY` | from tavily.com | Optional (web search) |
| `LANGSMITH_API_KEY` | from smith.langchain.com | Optional (observability) |

`DATABASE_URL` is auto-wired from the managed Postgres — don't set it manually.

Click **Save Changes**. Render starts the build.

## Step 4 — Watch the first build (~5 minutes)

The build takes a while on the Starter plan (Docker layers + LanceDB/fastembed install + the agent build at startup). Watch the **Logs** tab. You should see:

```
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:api:Building deepagents agent...
INFO:api:Agent ready.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
```

Render injects `PORT=10000` automatically — uvicorn binds to it. The public URL is shown at the top of the service page, like `https://make-skills-api-abcd.onrender.com`.

## Step 5 — Smoke test the public API

In your VS Code terminal:

```bash
curl https://make-skills-api-abcd.onrender.com/healthz
# Expect: {"status":"ok"}

curl https://make-skills-api-abcd.onrender.com/memory/stats
# Expect: {"total":0}  (fresh deploy, empty memory until first chat)
```

If these work, the agent is live publicly.

## Step 6 — Wire humancensys.com to it

In the **Vercel dashboard**:

1. Go to your humancensys.com project → **Settings** → **Environment Variables**
2. Edit `NEXT_PUBLIC_AGENT_URL`:
   - Value: `https://make-skills-api-abcd.onrender.com` (the Render URL from Step 5)
   - Environments: Production (and Preview if you want previews to use prod agent)
3. Save
4. Go to **Deployments** → on the latest, click ⋯ → **Redeploy** (so the new env var is baked into the build)

Wait ~1 min for the redeploy. Then visit https://humancensys.com — the chat now hits the Render-hosted agent and works regardless of your desktop state.

## Step 7 — Backfill your memory into the cloud Postgres + LanceDB

The local backfill we ran is in your local LanceDB. Render's deploy is a fresh disk. Two options:

**Option A: Re-run the backfill against the Render API.**

```bash
python scripts/backfill-claude-code.py --api-url https://make-skills-api-abcd.onrender.com
```

Same script, different target. Re-extracts records via Render's Haiku calls. Costs another ~$0.05.

**Option B: Don't backfill the cloud — use it for new conversations going forward.** Local stack still has the backfilled memory; cloud accumulates fresh. They're separate stores. If you want them merged, write an export/import.

I'd default to Option A — keeps cloud parity with local.

---

## Costs

| Item | Plan | Cost |
|------|------|------|
| `make-skills-api` Web Service | Starter | **$7/month** |
| 1 GB persistent disk for LanceDB | included with Starter | $0 |
| `make-skills-db` Postgres | Free | $0 (256 MB, 30-day inactivity expiry) |
| Render egress / bandwidth | first 100 GB free | $0 |
| Anthropic API calls | per use | varies (~$0.001-0.05 per chat) |

**Total fixed:** ~$7/month for the platform.

If the Free Postgres becomes a constraint (data hits 1 GB or 30-day inactivity expires), upgrade the database to **Basic** ($7/month, 1 GB → 10 GB, no expiry). Total then $14/month.

## What's NOT included that you might want later

- **Custom subdomain `agent.humancensys.com`** — Render lets you add one in service Settings → Custom Domains. CNAME at your DNS provider.
- **Grafana on Render** — would need a separate web service. The Render-hosted Postgres can be queried by a Render-hosted Grafana the same way our local stack does. Not in `render.yaml` yet; add when you want dashboards on the cloud.
- **Auto-redeploy when skills change** — already enabled (`autoDeploy: true`). Push to main, Render rebuilds.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Application startup failed` in Render logs | Likely an `ANTHROPIC_API_KEY` issue | Check the env var is actually set (Render's Environment tab) and the key starts with `sk-ant-` |
| `CORS error` in humancensys.com browser console | The Render URL isn't in CORS allowlist | The code allows `humancensys.com` and `*.vercel.app` by default. If using a different domain, set `CORS_EXTRA_ORIGINS=https://your-domain.com` env var on the service |
| Memory empty after deploy | Persistent disk wasn't attached | Verify in Render service Settings → Disks: shows `memory-data` mounted at `/data/memory`. If missing, the Blueprint may have failed to provision; create the disk manually |
| Build fails on `pip install lancedb` | Memory limits during build | Bump to Starter Plus ($25/mo) for more RAM during builds. Or set `PIP_NO_CACHE_DIR=1` env var |
| 502 Bad Gateway | API crashed; Render auto-restarts after a few seconds | Check logs |

## When you're done

humancensys.com is fully end-to-end: UI on Vercel → API on Render → Anthropic + Postgres + LanceDB. Your desktop becomes optional.
