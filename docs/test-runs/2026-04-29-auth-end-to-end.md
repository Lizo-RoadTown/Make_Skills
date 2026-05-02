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

### 3. Register OAuth apps (one app each, multiple callback URLs)

**GitHub** (https://github.com/settings/developers → New OAuth App):

- Application name: Make_Skills
- Homepage URL: `https://humancensys.com`
- Authorization callback URL: paste each on its own line
  - `https://humancensys.com/api/auth/callback/github`
  - the Vercel preview URL with `/api/auth/callback/github` appended

**Google** (https://console.cloud.google.com → APIs & Services → Credentials):

- Application type: Web application
- Authorized JavaScript origins:
  - `https://humancensys.com`
  - the Vercel preview URL (origin only)
- Authorized redirect URIs:
  - `https://humancensys.com/api/auth/callback/google`
  - the Vercel preview URL with `/api/auth/callback/google` appended

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

## Issues found

(empty — fill in if any test case fails)
