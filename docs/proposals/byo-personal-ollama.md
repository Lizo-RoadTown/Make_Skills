# Proposal: BYO personal Ollama (and any private model endpoint)

**Status:** Open — needs decision on tunnel-vs-VPS default and where the URL is configured (env vs per-tenant DB)
**Authors:** Liz, agent-assisted
**Date:** 2026-04-29

## Problem

Pillar 1A landed model-provider abstraction: a subagent can target Anthropic, OpenAI, Google, HuggingFace, Together, Groq, or **Ollama**. Ollama is the local-privacy story — but right now it only works in self-host mode, because `OLLAMA_BASE_URL` defaults to `http://host.docker.internal:11434` (the host of the API container).

When the same agent runs on humancensys.com (Render), the API container has no path to a user's laptop. So today, "use Ollama" effectively means "use self-host." Users who want their hosted clan to think with their own GPU can't.

Liz's framing: *"I think I should put my ollama in some kind of container and be able to sign into it wherever, that way I can use it on my site, at least my own personal one. Can we make that a function for those of us who want to plug in our personal ones?"*

## Insight

Ollama already exposes an HTTP API. The problem isn't Ollama — it's reachability + auth. We need a way for a hosted-multitenant tenant to register "**this** is my Ollama endpoint, **this** is the bearer token, **these** subagents are allowed to use it."

This is the same pattern as BYO Claude Code via MCP: **bring your own inference, the platform brings everything else.** Storage, memory, observability, skills are platform-provided; tokens come from the user.

## Three reachability options

| Option | What the user does | Pros | Cons |
|---|---|---|---|
| **A. Cloudflare Tunnel / Tailscale Funnel / ngrok** | Run a tunnel from their laptop, get a public HTTPS URL with auth header | Free, no VPS, laptop sleeps when closed | Ollama only available while laptop is awake + tunnel is up |
| **B. Self-hosted Ollama on a small VPS** | $5-10/mo Hetzner / Fly / Render box running Ollama | Always-on, predictable | Costs money, GPU-less unless they pay more |
| **C. Run Ollama on existing home server** | Open port + reverse proxy with auth | Reuses hardware they own | Needs home networking knowledge; ISP/CGNAT can block |

We should support **all three** because the platform doesn't care — it just needs `(base_url, optional_auth_header)`. The proposal is what we *recommend* in docs and what the UI defaults to.

**Recommendation:** document A as the default ("free, easiest, laptop-only") and B as the always-on path. Don't try to pick for the user.

## What the platform needs to add

1. **Per-subagent auth header passthrough.** Today `model_registry.py` accepts `**extra` kwargs and passes them to the LangChain provider. Verify `langchain-ollama`'s `ChatOllama` accepts a `headers` or `client_kwargs={"headers": ...}` arg for the bearer token. If not, add a tiny custom wrapper.

2. **A place to store the URL + token per tenant.** Today `OLLAMA_BASE_URL` is a single env var on the api container. For hosted-multitenant, this needs to be **per-tenant** config:
   - Self-host: keep the env var (single tenant, fine).
   - Hosted: a `tenant_model_endpoints` table — `(tenant_id, provider, base_url, auth_secret_ref, allowed_subagents)`. `auth_secret_ref` points to a secret in whatever secret store we land on (Render env, Doppler, AWS SM — open question, ties to Pillar 0).

3. **A subagent config syntax that picks tenant config over global env.** Suggested:
   ```toml
   [model]
   provider = "ollama"
   name = "llama3.1:8b"
   endpoint = "tenant"   # = look up tenant's registered Ollama; fall back to OLLAMA_BASE_URL if none
   ```
   Default `endpoint = "env"` (today's behavior) so nothing breaks.

4. **A "register your endpoint" flow in the UI** (Pillar 1B territory). Form:
   - Provider: Ollama / OpenAI-compatible / vLLM
   - Base URL: `https://my-ollama.tail-scale.ts.net`
   - Auth header: `Authorization: Bearer <secret>` (entered, never shown again)
   - Test connection button → calls the URL with a tiny prompt, shows latency + model list
   - Allowed subagents: checkboxes

5. **Health checks.** Tunneled endpoints go down. The agent build code in [`platform/api/agent.py:128-143`](../../platform/api/agent.py#L128-L143) already inherits the orchestrator's model on subagent resolution failure — extend that to **runtime** failure (TUNNEL_DOWN → fall back to platform-default Anthropic for that turn, log it, don't crash the chat).

## Two-mode notes

| Mode | What changes |
|---|---|
| Self-host | `OLLAMA_BASE_URL` env var keeps working exactly as it does today. The tenant-aware code path is dormant (no DB row → use env). |
| Hosted-multitenant | The "register endpoint" UI writes a row to `tenant_model_endpoints`. Subagent config with `endpoint = "tenant"` looks it up at agent build time. |

This is **additive** — no breaking change to the current Pillar 1A surface.

## Security considerations

- **Never log the auth header.** Already standard but worth restating; tunnels leak fast.
- **Allow-list of providers** at the platform level, even if the URL is user-supplied. We don't want a user pointing the "Ollama" subagent at `http://localhost/admin` of someone else's machine on a shared network. (Hosted-multitenant: the request leaves Render, so this is mostly the user's footgun, but document it.)
- **Encrypt `auth_secret_ref` at rest.** If we go with Render env vars per tenant, that's their problem; if we go with a Postgres column, encrypt with KMS / sodium.
- **Rate limit per tenant** on the platform side so a runaway subagent loop doesn't melt their home Ollama.

## Open questions

1. Is `headers` the right kwarg in `ChatOllama`? (Verify against `langchain-ollama>=0.2`.) If not, do we wrap or upstream a PR?
2. Generalize this beyond Ollama? The same shape applies to **any OpenAI-compatible endpoint** (vLLM, LM Studio, llama.cpp server, hosted Together-clones). Tempting to make this a `byo-openai-compatible` feature with Ollama as one preset.
3. Where does the secret live in hosted mode? Postgres (encrypted column) vs external secret manager. Ties to Pillar 0 tenant abstraction.
4. Do we expose this in the free tier of the hosted product, or only for paying tenants? (Liz's call.)

## Recommendation

Ship in two stages:

- **Stage 1 (now-ish, self-host first):** make the existing Ollama path work over a tunnel. That's just *documentation* — Liz spins up a Cloudflare Tunnel, sets `OLLAMA_BASE_URL=https://her-tunnel.example` + `OLLAMA_HEADERS='Authorization: Bearer xxx'` in `.env`, restart api. Add a doc page. Zero code changes if `ChatOllama` accepts headers.
- **Stage 2 (with Pillar 0 tenant abstraction):** the per-tenant endpoint registry, the UI form, the health-check fallback. Don't build this until the tenant table exists — otherwise we're hard-coding `tenant_id="default"` in yet another place.

## References

- [`byo-claude-code-via-mcp.md`](byo-claude-code-via-mcp.md) — sister proposal, same "BYO inference" pattern from a different angle
- [`web/content/docs/concepts/model-providers.mdx`](../../web/content/docs/concepts/model-providers.mdx) — Pillar 1A provider matrix this builds on
- [`platform/api/model_registry.py`](../../platform/api/model_registry.py) — the resolver this extends
- ROADMAP.md Pillar 0 — the tenant abstraction Stage 2 depends on
