# web/ — chat UI for the Make_Skills agent

Next.js 16 (App Router, TypeScript, Tailwind 4) chat UI. Streams from the FastAPI agent at `platform/api/`. Chainlit-inspired aesthetic.

## Local dev

```bash
cd web
npm install                     # already done if you cloned after first build
npm run dev
```

Visit http://localhost:3000. Requires the agent running at http://localhost:8001 — start it with `docker compose up -d` from `platform/deploy/`.

## File map

```
web/
├── app/
│   ├── layout.tsx              Dark-mode root layout, syntax highlighting CSS
│   ├── page.tsx                Single-page chat shell (sidebar + chat)
│   └── globals.css             Tailwind 4 import + chat markdown styling
├── components/
│   ├── Chat.tsx                Streaming logic, message list, thinking state
│   ├── Composer.tsx            Textarea + send (Enter to send, Shift+Enter newline)
│   ├── MessageBubble.tsx       User / agent bubbles, markdown rendering
│   ├── ThinkingDots.tsx        Animated typing indicator
│   └── ThreadSidebar.tsx       localStorage thread list
└── lib/
    ├── agent-client.ts         SSE parser for /chat/stream — single integration point
    └── threads.ts              localStorage helpers for the sidebar
```

## Streaming protocol

Matches the SSE shape from `platform/api/main.py /chat/stream`:

```
data: {"event":"thread","thread_id":"..."}
data: {"event":"chunk","data":"hello "}
data: {"event":"chunk","data":"world"}
data: {"event":"done"}
```

If the agent's stream shape changes, fix it ONLY in [`lib/agent-client.ts`](lib/agent-client.ts).

## Deploying to Vercel

```bash
# One-time
npx vercel link                 # creates / links a Vercel project for this folder

# Deploy
npx vercel                      # preview
npx vercel --prod               # production
```

Then in the Vercel dashboard → project → Settings → Environment Variables:

| Var | Value |
|-----|-------|
| `NEXT_PUBLIC_AGENT_URL` | the public URL of your FastAPI agent (NOT localhost) |

The agent must be reachable from the public internet. If it's still local-only, host it on Render / Fly / Railway first — see [`../platform/README.md`](../platform/README.md).

## Custom domain

Vercel dashboard → project → Settings → Domains → Add `chat.your-domain.com`. Vercel shows the DNS record to add (typically a CNAME). Add it at your DNS provider; SSL provisions automatically.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Failed to fetch` in browser console | Agent unreachable | `curl http://localhost:8001/healthz` should return 200; if not, `docker compose up -d` from `platform/deploy/` |
| Tokens stop mid-stream | Agent crashed | `docker compose logs api` from `platform/deploy/` |
| CORS error in production | Agent doesn't allow the Vercel origin | Add `CORSMiddleware` to `platform/api/main.py` allowing the production hostname |
| Build error on `npm run build` | Tailwind 4 plugin / type mismatch | `rm -rf .next node_modules && npm install` |
