# Runbook: Power up your personal Ollama on Docker Cloud

**Audience:** Liz (and anyone else following the [BYO personal Ollama](../../web/content/docs/concepts/byo-ollama.mdx) guide).
**Goal:** Get a private, auth-protected Ollama endpoint running on Docker Cloud (Docker Offload), then point your hosted Make_Skills clan at it.
**Time:** ~20 minutes the first time, ~2 minutes for subsequent restarts.
**Cost:** Pay-per-second. A `cpu-medium` offload runs ~$0.04/hr idle; GPU offload (if you want bigger weights) is $1–3/hr — turn it off when you're done.

## Prereqs

- Docker Desktop 4.40+ with Docker Offload enabled (Settings → Beta features → Docker Offload). Sign in with your Docker Hub account that has Offload on it.
- A long random secret you'll use as the bearer token. Generate one:
  ```bash
  openssl rand -hex 32
  ```
  Save it somewhere — you'll paste it in twice.

## Step 1 — Pick what model you want to serve

Start small to keep cost down:

| Model | Size | Hardware needed | Good for |
|-------|------|-----------------|----------|
| `llama3.1:8b` | ~5 GB | CPU offload OK | First-test, single subagent |
| `qwen2.5-coder:7b` | ~5 GB | CPU offload OK | The researcher subagent (synthesis) |
| `llama3.3:70b` | ~40 GB | GPU offload required | Real production use |

Recommendation for "power up mine": start with `llama3.1:8b` on CPU offload — proves the wiring, costs pennies, you can scale up after.

## Step 2 — Write the compose file

Create `~/ollama-cloud/compose.yml` on your machine (NOT in the Make_Skills repo — keep this private):

```yaml
name: liz-ollama

services:
  ollama:
    image: ollama/ollama:latest
    restart: unless-stopped
    volumes:
      - ollama-models:/root/.ollama
    # Internal only — NOT exposed publicly. The caddy sidecar fronts it.
    expose:
      - "11434"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - ollama
    ports:
      - "443:443"
      - "80:80"
    environment:
      OLLAMA_AUTH_TOKEN: ${OLLAMA_AUTH_TOKEN:?must be set}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config

volumes:
  ollama-models:
  caddy-data:
  caddy-config:
```

And `~/ollama-cloud/Caddyfile`:

```caddy
{
  # Auto-HTTPS via Let's Encrypt. Replace with your hostname once you have one.
  email you@example.com
}

# When Docker Cloud gives you a hostname, replace this line with it.
# Until then, use :443 for IP-based access (Caddy will use a self-signed cert).
:443 {
  # Bearer-token auth — reject anything missing or wrong.
  @authed header Authorization "Bearer {env.OLLAMA_AUTH_TOKEN}"
  handle @authed {
    reverse_proxy ollama:11434
  }
  handle {
    respond "Unauthorized" 401
  }
}
```

And `~/ollama-cloud/.env`:

```bash
OLLAMA_AUTH_TOKEN=<paste the openssl-generated secret here>
```

## Step 3 — Spin it up on Docker Cloud

From `~/ollama-cloud/`:

```bash
# Tell the docker CLI to use the Cloud context (Offload).
docker context use cloud

# Start it. First run pulls the images into the cloud — takes 2-3 min.
docker compose up -d

# Watch logs to make sure it came up
docker compose logs -f
```

Then pull the model into the cloud-hosted Ollama (this happens once, persists in the volume):

```bash
docker compose exec ollama ollama pull llama3.1:8b
```

Get your endpoint URL:

```bash
docker compose ps
# Look at the caddy service's published address. Docker Cloud gives you
# a stable hostname like xxxx.docker.cloud — copy it.
```

## Step 4 — Test it from your laptop

```bash
# Replace HOSTNAME and TOKEN with your values
curl -X POST https://HOSTNAME/api/generate \
  -H "Authorization: Bearer TOKEN" \
  -d '{"model": "llama3.1:8b", "prompt": "Say hi", "stream": false}'
```

You should get a JSON response with a generated message. If you get 401, the token's wrong. If you get connection refused, the cloud container hasn't fully started — wait 30s and retry.

## Step 5 — Wire Make_Skills to it

### Local Docker (your laptop's stack)

Edit `platform/deploy/.env`:

```bash
OLLAMA_BASE_URL=https://HOSTNAME
OLLAMA_AUTH_HEADER=Bearer TOKEN
```

Restart the api container:

```bash
docker compose -f platform/deploy/docker-compose.yml restart api
```

### Hosted (humancensys.com on Render)

Render Dashboard → make-skills-api → Environment → set:

- `OLLAMA_BASE_URL` = `https://HOSTNAME`
- `OLLAMA_AUTH_HEADER` = `Bearer TOKEN`

Render auto-redeploys. (No need to touch `render.yaml` — those keys are already declared as `sync: false`.)

## Step 6 — Point a subagent at it

Edit `subagents/researcher/deepagents.toml`:

```toml
[model]
provider = "ollama"
name = "llama3.1:8b"
```

Commit and push (or restart locally) — the researcher now thinks on YOUR cloud Ollama.

## Stopping it (to save money)

```bash
docker context use cloud
cd ~/ollama-cloud
docker compose down
```

The `ollama-models` volume persists, so when you `up -d` again, the model is still there. You're only billed while the containers are running.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` from curl test | Token mismatch | Check `.env` and the `Authorization` header you sent match exactly |
| Make_Skills chat hangs forever | Cold start of the cloud container | First request after `up -d` can take 30-60s; subsequent ones are fast |
| `connection refused` | Container not up yet, or Caddy not finished issuing cert | `docker compose logs caddy` — wait for "certificate obtained" |
| Subagent always falls back to Anthropic | `model_registry.py` couldn't connect → check `docker compose logs api` for the warning | Verify `OLLAMA_BASE_URL` env is set in the api container: `docker compose exec api env \| grep OLLAMA` |
| Costs climbing | Container left running 24/7 | `docker compose down` when you're not using it; or set up a cron to auto-stop after N hours of inactivity |

## Why this is the recommended personal setup

- **Real container, real persistent storage** — model weights survive restarts, no re-pulling.
- **Auth from day one** — token in front of Ollama via Caddy. Public URL is safe(ish) to share with yourself across machines.
- **Same shape as a VPS or AWS box** — if you outgrow Docker Cloud and want to move to a $200/mo GPU instance, the only thing that changes is the URL.
- **Two-mode clean** — one endpoint, used by your local Make_Skills AND humancensys.com. No special-casing.

## See also

- [Concept doc: BYO personal Ollama](../../web/content/docs/concepts/byo-ollama.mdx) — the public-facing version of this guide
- [Model providers](../../web/content/docs/concepts/model-providers.mdx) — what other providers you can mix into the same clan
- [`platform/api/model_registry.py`](../../platform/api/model_registry.py) — the resolver that reads `OLLAMA_BASE_URL` + `OLLAMA_AUTH_HEADER`
