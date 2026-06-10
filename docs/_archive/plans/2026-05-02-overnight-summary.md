# Overnight summary — 2026-05-02

Liz went to bed after confirming sign-in works on the test-auth preview ("I am in"). This is the work that landed between then and ~04:00 UTC, all on the `test-auth` branch (production untouched).

## What's now true

### Auth flow — verified end-to-end on the preview

- TC-1 / TC-2 PASSED — Liz signed in via Google on the preview
- TC-3 PASSED — invite gate denies users without an unconsumed invitation row, redirects to `/auth/error?error=NoInvite`
- TC-4 / TC-5 still pending — both require flipping Render's api `PLATFORM_MODE=hosted` (a production action — your call)

### Sidebar — workflow-oriented restructure (your morning ask)

Replaced the content-typed Workspace / Library / Pillars groupings with five workflow stages:

```
THINK    Roadmap / Plans / Proposals
BUILD    Chat / Agents (P1) / Skills
TEST     Test runs / Sessions / Quests (P2)
OBSERVE  Dashboard / Memory / Docs
MANAGE   Credentials / Environments / Settings
```

Three new functional pages reuse the existing `/docs/tree` + `/docs/file` api endpoints:

- `/plans` — lists `docs/plans/*.md` with a side-pane viewer
- `/proposals` — lists `docs/proposals/*.md` with a side-pane viewer
- `/test-runs` — lists `docs/test-runs/*.md` with a side-pane viewer

Four labeled stub pages so the rest of the nav structure is visible:

- `/sessions` — Pillar 3a replay-with-trace surface
- `/credentials` — Pillar 0 stage 2 tenant_secrets UI
- `/environments` — self-host vs hosted workspace switcher
- `/settings` — account / profile / billing

### Three orchestrations captured

Per the orchestration-cataloging skill output, three patterns crossed their threshold during the auth wire-up:

1. **`subagents/researcher-coordinator/`** (score 80) — parallel-research-bursts. Decomposes an unfamiliar topic into 3-5 self-contained briefs, fans out, synthesizes into proposal-ready output.
2. **`skills/proposal-authoring/`** (score 80) — the canonical `docs/proposals/` template + project tone discipline + house rules learned from authoring 9 proposals.
3. **`subagents/schema-migrator/`** (score 45) — translates a plain-English migration intent into idempotent Python migration + Drizzle schema mirror + isolation test stub.

### Two new proposals

- [`sidebar-architecture.md`](../proposals/sidebar-architecture.md) — formalizes the workflow-oriented sidebar (P1 already shipped on test-auth)
- [`bootstrap-first-user-invite.md`](../proposals/bootstrap-first-user-invite.md) — fixes the chicken-and-egg gap (no workspace owner exists yet to issue the first invite). Recommended approach: `BOOTSTRAP_OPEN=1` env flag + `tenant_users` count check, both required.

### Updated artifacts

- `docs/test-runs/2026-04-29-auth-end-to-end.md` — TC-1/TC-3 marked PASSED, full eight-friction-surface journey log added at the bottom
- `docs/proposals/README.md` — indexes the two new proposals
- `scripts/insert-invite.py` — bootstrap helper (will be superseded by the bootstrap-first-user proposal once implemented)
- `.gitignore` — adds `render.exe` (per-machine binary)

## What's blocking, awaiting your call

### 1. Production redeploy

The Pillar 0 auth wire-up is on `main` but Vercel's last 2-3 production builds **failed** for the same import-time-throw bugs we already fixed on `test-auth`. Production humancensys.com is still on the older `8aa8b5c` deploy (skills + plans). To get production current:

- Merge PR #10 (`test-auth` → `main`) — this brings the build fixes plus the auth wire-up plus the sidebar restructure plus the orchestration captures into production
- Add `DATABASE_URL`, `AUTH_SECRET`, OAuth credentials to Vercel's **Production** scope (currently on Preview only for some)
- Create a separate `Make_Skills Production` GitHub OAuth App (GitHub allows only one callback URL per app — preview app stays as is)

I did NOT merge — that's a production action awaiting your authorization.

### 2. Api-side `PLATFORM_MODE=hosted` flip

The Render production api still runs `PLATFORM_MODE=self_host`, which means it ignores JWTs. Flipping it to `hosted` is what enables TC-4 (api JWT round-trip) and TC-5 (cross-tenant isolation across the wire) — and it's what makes humancensys.com's hosted-multitenant story actually go live.

**Side-effect of flipping** — every call to the api requires a Bearer token. Self-host users running their own instance of Make_Skills are unaffected (their `PLATFORM_MODE` stays `self_host`). But any anonymous tools currently hitting the production api (the backfill scripts, ad-hoc curl tests) will start getting 401s until they pass a JWT.

I did NOT flip — production env-var change awaiting your authorization.

### 3. Bootstrap-first-user implementation

The chicken-and-egg gap I hit during testing is documented in [`bootstrap-first-user-invite.md`](../proposals/bootstrap-first-user-invite.md). Implementation is small (~30 lines in `web/auth.ts`, optionally one column on `tenant_users` for role). Worth doing before production goes live so future tenants don't need a manual SQL insert.

## Recommended sequence when you wake up

1. **Skim** [`sidebar-architecture.md`](../proposals/sidebar-architecture.md) and [`bootstrap-first-user-invite.md`](../proposals/bootstrap-first-user-invite.md) — both are short and decide direction for the next two PRs
2. **Visit** the test-auth preview at `https://make-skills-git-test-auth-lizo-roadtowns-projects.vercel.app/` — the new sidebar is live there. Click around the Plans / Proposals / Test runs pages. The "what we are doing here" dogfooding you asked for is now visible
3. **Decide:** merge PR #10 to main? Or wait until bootstrap-first-user lands?
4. **Decide:** flip `PLATFORM_MODE=hosted` on Render's api now (gates TC-4/TC-5)? Or after the merge?

## Things I deliberately did NOT do

- Merge PR #10 to main (production)
- Flip Render's `PLATFORM_MODE` env var (production)
- Push to `main` (only `test-auth` was touched)
- Implement `bootstrap-first-user-invite` (the proposal recommends `BOOTSTRAP_OPEN=1` env-flag-gated; wanted your sign-off on the design before code)
- Cherry-pick fixes to a separate branch for production-only deploy (the cleanest path is merging the whole PR, not splitting it)

All those wait for you. The night's work was structural — capturing patterns, documenting state, surfacing the sidebar gap — so the next morning of work is informed.

## Friction memories saved this session

- `feedback_test_on_preview_not_local.md` — for OAuth/webhooks, push a feature branch, use Vercel + Render previews, AUTH_SECRET in dashboards
- `user_env_powershell_no_amp.md` — your terminal is PowerShell; `&&` parses as error; use `;` or two lines

## Branch state

- `test-auth` is `6935251` (latest), one merge-commit ahead of `main`'s `f06945d`
- PR #10 is open at https://github.com/Lizo-RoadTown/Make_Skills/pull/10
- Vercel preview is live at the stable branch alias
- Render preview environment exists (auto-created on PR open per render.yaml `previews: generation: automatic`)

## Word from the agent

The eight friction surfaces from yesterday's session aren't going to recur — most are now captured as memories or skills, the rest as proposals (bootstrap-first-user, sidebar-architecture). The orchestration captures mean the next research-heavy / proposal-heavy / migration-heavy task starts faster than the last one. That's the self-correcting loop you asked for last week. It's working.
