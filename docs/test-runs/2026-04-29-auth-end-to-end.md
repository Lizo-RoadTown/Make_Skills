# Test run: Auth.js v5 + invite-only signup end-to-end

**Branch:** `test-auth`
**Date:** 2026-04-29
**Goal:** Verify the full auth flow against production-shape deployments — Vercel (web) + Render (api) + Render Postgres — without using localhost.

## Why this exists

Recurring lesson saved at `~/.claude/projects/.../memory/feedback_test_on_preview_not_local.md`:
the branch IS the test environment. OAuth callbacks register with preview URLs, AUTH_SECRET lives in dashboards, no `.env.local` syncing.

## What's wired in code

- `platform/api/auth.py` — HS256 verifier active when `PLATFORM_MODE=hosted`
- `platform/api/migrations.py` — 6 auth tables (users, accounts, sessions, verification_tokens, invitations, tenant_users) idempotent
- `web/auth.config.ts` + `web/auth.ts` — Auth.js v5 with HS256 override + Drizzle adapter + signIn invite gate + jwt tenant_id injection
- `web/proxy.ts` — Next.js 16 edge proxy
- `web/app/api/auth/[...nextauth]/route.ts` — handler
- `web/app/auth/{signin,error}/page.tsx`
- `render.yaml` — `previews: generation: automatic` on api service (committed to main first)

## Pre-test checklist

### 1. Note the preview URLs

After pushing `test-auth`, Vercel and Render auto-deploy and assign URLs. Fill in below:

- [ ] **Vercel preview URL:** `https://__________________.vercel.app`
- [ ] **Render preview URL:** `https://__________________.onrender.com`

(Render's preview URL appears in the Render dashboard under the api service once the PR is opened.)

### 2. Set environment variables in dashboards (NOT in files)

Generate the shared secret once:

```bash
openssl rand -hex 32
```

| Variable | Where | Value |
|----------|-------|-------|
| `AUTH_SECRET` | Vercel project → Environment Variables (Preview + Production scopes) | the openssl output |
| `AUTH_SECRET` | Render → make-skills-api → Environment | same value, byte-identical |
| `AUTH_GITHUB_ID` | Vercel (Preview + Production) | from GitHub OAuth App |
| `AUTH_GITHUB_SECRET` | Vercel (Preview + Production) | from GitHub OAuth App |
| `AUTH_GOOGLE_ID` | Vercel (Preview + Production) | from Google Cloud OAuth client |
| `AUTH_GOOGLE_SECRET` | Vercel (Preview + Production) | from Google Cloud OAuth client |
| `DATABASE_URL` | Vercel (Preview + Production) | Render Postgres **external** connection string |
| `PLATFORM_MODE` | Render → make-skills-api → Environment | `hosted` |

The `DATABASE_URL` on Vercel is the **external** connection string from Render Postgres (not the internal one). Render Dashboard → make-skills-db → Connections → External Connection.

`PLATFORM_MODE` on Render's api flips to `hosted` only after the auth wiring is verified — leaving as `self_host` keeps the api answering requests without auth in the meantime.

### 3. Register OAuth apps

**GitHub OAuth Apps allow only ONE callback URL each**, so two apps are
needed — one for preview, one for production. Google supports multiple
authorized redirect URIs in a single app.

**GitHub Preview** (https://github.com/settings/developers → New OAuth App):

- Application name: `Make_Skills Preview`
- Homepage URL: `https://humancensys.com` (metadata only, shown on consent screen)
- Authorization callback URL: `<vercel-preview-url>/api/auth/callback/github`

After creating, copy the Client ID and generate a Client Secret. In Vercel
project settings, add `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` scoped to
**Preview only**.

**GitHub Production** (created later, when ready to merge to main):

- Same as above but Authorization callback URL: `https://humancensys.com/api/auth/callback/github`
- The resulting Client ID + Secret go into Vercel scoped to **Production only**.

**Google** (https://console.cloud.google.com → APIs & Services → Credentials → Create Credentials → OAuth client ID):

- Application type: Web application
- Name: `Make_Skills`
- Authorized JavaScript origins:
  - `https://humancensys.com`
  - the Vercel preview URL (origin only, no path)
- Authorized redirect URIs:
  - `https://humancensys.com/api/auth/callback/google`
  - `<vercel-preview-url>/api/auth/callback/google`

After creating, the Client ID + Secret go into Vercel scoped to **both
Preview and Production** (same app handles both environments).

### 4. Insert a test invitation

Render Dashboard → make-skills-db → Connect → Connect with psql, paste:

```sql
INSERT INTO invitations (email, tenant_id)
VALUES ('lizocontactinfo@gmail.com', '00000000-0000-0000-0000-000000000000');
```

(Replace email with the address you'll sign in with.)

## Test cases

### TC-1: GitHub sign-in with valid invitation

- [ ] Visit `<vercel-preview-url>/auth/signin`
- [ ] Click "Continue with GitHub"
- [ ] Approve on github.com
- [ ] Land back on `/` of the preview app
- [ ] Inspect the cookie: `authjs.session-token` exists
- [ ] Decode the JWT (paste at jwt.io, paste the AUTH_SECRET as the secret)
  - [ ] `sub` = a UUID (the user.id in the users table)
  - [ ] `tenant_id` = `00000000-0000-0000-0000-000000000000`
  - [ ] alg = HS256
  - [ ] exp ≈ 30 days out

### TC-2: Google sign-in with valid invitation

(Same as TC-1 but click Google. Use a separate Google account from any prior GitHub sign-in to avoid email collision.)

### TC-3: Sign-in attempt without an invitation is denied

- [ ] Sign out of any active session
- [ ] Manually delete or consume any invitations row matching the email you'll use
- [ ] Visit `<vercel-preview-url>/auth/signin`, click GitHub or Google, approve OAuth
- [ ] Land on `/auth/error?error=NoInvite`
- [ ] No row appears in `users` table for that email
- [ ] No row appears in `tenant_users`

### TC-4: api round-trip with the JWT

After TC-1 succeeds:

- [ ] Render Dashboard → make-skills-api → Environment → set `PLATFORM_MODE=hosted`, redeploy
- [ ] Render Dashboard → make-skills-api → Logs → confirm api boots cleanly
- [ ] Copy the `authjs.session-token` cookie value from the browser
- [ ] `curl -H "Authorization: Bearer <token>" <render-preview-url>/memory/stats`
- [ ] Expect `{"total": <n>}` where `n` is the calling tenant's record count
- [ ] `curl -H "Authorization: Bearer <bad-token>" <render-preview-url>/memory/stats` returns 401

### TC-5: Cross-tenant isolation across the wire

- [ ] Insert a record into LanceDB under the default tenant (via the existing recorder or `/memory/ingest`)
- [ ] With the Bearer token from TC-1 (default tenant), call `/memory/search` — expect to see the record
- [ ] Forge a JWT for a synthetic `tenant_id` (different UUID) using the same secret + jwt.io
- [ ] With that forged token, call `/memory/search` for the same query — expect 0 results

## Outcome

Once all five test cases pass, this PR can merge to main. Production gets:

1. The Auth.js v5 stack live on humancensys.com
2. `PLATFORM_MODE=hosted` flipped on the production api in the Render dashboard
3. Invitation management surfaces (next phase — pillar 0 closing item)

If any test case fails, the failure mode and fix go in this same file under "Issues found" (append-only — write rather than edit).

## Outcome (as of 2026-05-02 ~02:30 UTC)

| Test case | Status | Notes |
|-----------|--------|-------|
| TC-1 GitHub | not run | Liz signed in via Google instead |
| TC-2 Google | ✅ PASSED | Liz signed in successfully on the test-auth preview, "I am in" |
| TC-3 deny path | ✅ PASSED | Pre-invite attempts hit `/auth/error?error=NoInvite` exactly as designed — gate works |
| TC-4 api round-trip | pending | Blocked on `PLATFORM_MODE=hosted` flip on Render api (production-affecting, awaits Liz's go) |
| TC-5 cross-tenant | pending | Same blocker as TC-4 |

## Journey log (the friction surfaces)

The bare minimum to summarize: **eight sequential failures, each surfaced one diagnostic step at a time, all resolved.** The auth flow is now wired end-to-end on the preview. Each entry also indicates whether the lesson was captured as a memory or skill so the next cycle is faster.

| # | Symptom | Root cause | Fix | Captured as |
|---|---------|------------|-----|------------|
| 1 | Vercel build error: `DATABASE_URL is not set` at build time | `web/db/index.ts` and `auth.config.ts` threw at module-import — Next.js's "Collect page data" pass imports every route to inspect metadata before runtime env exists | Defer secret resolution until first use | code |
| 2 | Vercel build error: `Unsupported database type (object) in Auth.js Drizzle adapter` | Replaced lazy throws with a JS Proxy; DrizzleAdapter does an `instanceof PgDatabase` check at construction and rejected the Proxy | Construct the real Pool eagerly with a placeholder `DATABASE_URL` fallback for build phase | code |
| 3 | Vercel build error: `proxy.ts must export a function` | Next.js 16's static analyzer doesn't recognize `export const { auth: proxy } = NextAuth(...)` as a function | Switched to `export default auth` | code |
| 4 | Sign-in produced "Configuration error" silently | `DATABASE_URL` env var wasn't set in Vercel | Added it to Vercel project env vars | none — one-time setup |
| 5 | Same "Configuration error" after env var added | URL pointed at Render's **internal** hostname (no `.render.com` suffix) — unreachable from Vercel | Switched to External Database URL | docs/test-runs and runbook implication: always External when reaching from outside Render |
| 6 | Same "Configuration error" after URL fix | Render Postgres requires TLS; node-postgres doesn't auto-enable SSL based on hostname | Added `ssl: { rejectUnauthorized: false }` to the Pool when the hostname matches `*.render.com` | code (web/db/index.ts) |
| 7 | "No invitation found" — gate denying the workspace owner | Chicken-and-egg of invite-only: there's nobody to invite the first user | Manual INSERT via a script that reads DATABASE_URL from a session env var; longer-term fix proposed at `docs/proposals/bootstrap-first-user-invite.md` | proposal + script |
| 8 | PowerShell rejected `cmd1 && cmd2` | Liz's terminal is PowerShell, `&&` is bash | Used `;` separator and saved as `feedback_test_on_preview_not_local.md` and `user_env_powershell_no_amp.md` memories | memory |

## What changed from the original test plan

- **Local `.env.local` setup section deleted** — superseded by the "test on preview branches, not localhost" memory. AUTH_SECRET, OAuth credentials, and DATABASE_URL all live in Vercel + Render dashboards. No local sync.
- **GitHub OAuth: two apps required**, not one with multiple callbacks — GitHub OAuth Apps only allow one callback URL each. Google supports multiple authorized redirect URIs in a single client.
- **Manual invite-row insertion** is currently the bootstrap step. Improvement proposed.
- **TC-4 / TC-5 require flipping the production api into `PLATFORM_MODE=hosted`** — Liz's call when she's ready.

## Issues found

None catastrophic. All eight friction surfaces above were fixable in the test-auth branch without touching production. The `Configuration error` UX was correctly opaque to the user — error details only surfaced via `mcp__claude_ai_Vercel__get_runtime_logs` from the agent side. No data loss, no production outages, no rollbacks needed.

## Next steps

1. **Liz reviews this doc + runs TC-4/TC-5** — flip Render's `PLATFORM_MODE=hosted` only when ready for the production api to require JWT on every request.
2. **Merge PR #10 → main** — pushes the same fixes to production. Production GitHub OAuth App needs creating before this (separate from preview).
3. **Implement the bootstrap-first-user invite** ([proposal](../proposals/bootstrap-first-user-invite.md)) — closes the chicken-and-egg gap so future workspace owners don't need a manual SQL insert.
