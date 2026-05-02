# Proposal: Bootstrap-first-user invitation

**Status:** Open — surfaced 2026-05-02 during the test-auth sign-in test run
**Authors:** Liz, agent-assisted
**Date:** 2026-05-02

## Problem

Make_Skills is invite-only by design. The current flow:

1. A would-be user clicks Sign in with GitHub/Google.
2. Auth.js's signIn callback consumes a row in the `invitations` table matching their email.
3. If no unconsumed row matches, the user is redirected to `/auth/error?error=NoInvite`.
4. The error page reads: *"Sign-in is currently invite-only. Ask the workspace owner to issue one."*

But on a fresh deployment — humancensys.com or any self-host instance — **there is no workspace owner yet**. Liz hit this exact wall during the test-auth run: she's the workspace owner and the gate was politely telling her to ask the workspace owner. The bootstrap path was a manual SQL `INSERT` via a Python script (committed at `scripts/insert-invite.py`), which is the right answer for one person but not a long-term answer.

A future tenant signing up to the hosted multitenant deployment of Make_Skills would face the same gate with no recourse.

## Goal

Let the **first user** of a fresh deployment sign in without a pre-existing invitation row, get assigned `role='admin'` on a freshly-minted tenant, and from that point forward use the existing invitation flow to bring others in.

Subsequent users still need invitations — only the **first** sign-in is special.

## Decision: bootstrap when `tenants` row count is zero (or below a threshold)

Three options on the table:

- **A. `BOOTSTRAP_EMAIL` env var** — only the email matching this env var is auto-allowed on first sign-in. Simple, but bakes the workspace owner into deploy config and complicates rotation.
- **B. First-sign-in-wins** — if `tenant_users` has zero rows when a sign-in attempt lands, allow it and create the tenant. Race-prone (two users signing in simultaneously could both claim "first") but pragmatic for single-tenant per-instance deployments.
- **C. Hybrid: env-var-gated first-sign-in** — if `BOOTSTRAP_OPEN=1` env var is set AND `tenant_users` is empty, allow the first sign-in. After the first user is admitted, `BOOTSTRAP_OPEN` is irrelevant (the count check fails).

**Recommended: C.** Two locks (env var + count check) means:
- Default behavior stays invite-only (no env var means no bootstrap path even on a fresh DB)
- Workspace owner explicitly opts into the bootstrap window by setting the env var, then unsets it after first sign-in
- Race-safe enough for the academic/early-adopter use case
- No need to rotate or manage a "bootstrap email" in deploy config

For the hosted-multitenant deployment, this same flag enables the very first sign-up flow when humancensys.com goes public. Per-tenant later: each new tenant in the multitenant model gets its own "first-user" bootstrap when they sign up via a paid landing page or invite flow Liz issues from the admin console.

## Implementation sketch (web side)

Modify the `signIn` callback in `web/auth.ts`:

```typescript
async signIn({ user, account, profile }) {
  const email = user.email?.toLowerCase();
  if (!email || !account) return "/auth/error?error=Configuration";

  // Email verification (existing)
  const verified = ... ;
  if (!verified) return "/auth/error?error=EmailNotVerified";

  try {
    // 1. Try to consume an existing invitation (existing path)
    const claimed = await db
      .update(schema.invitations)
      .set({ consumedAt: sql`now()`, consumedByEmail: email })
      .where(and(
        eq(schema.invitations.email, email),
        isNull(schema.invitations.consumedAt),
      ))
      .returning({ tenantId: schema.invitations.tenantId });

    if (claimed.length > 0) {
      (user as { tenantId?: string }).tenantId = claimed[0].tenantId;
      return true;
    }

    // 2. Bootstrap path — only if BOOTSTRAP_OPEN=1 and no existing tenant_users
    if (process.env.BOOTSTRAP_OPEN === "1") {
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.tenantUsers);
      if (existing[0]?.count === 0) {
        // Create a fresh tenant; user becomes its admin via tenantUsers row
        const newTenant = await db
          .insert(schema.tenants)
          .values({ name: `${email}'s workspace` })
          .returning({ id: schema.tenants.id });
        if (newTenant[0]?.id) {
          (user as { tenantId?: string }).tenantId = newTenant[0].id;
          return true;
        }
      }
    }

    return "/auth/error?error=NoInvite";
  } catch (e) {
    console.error("signIn invite check failed", e);
    return "/auth/error?error=Configuration";
  }
},
```

The `jwt` callback already persists the user → tenant mapping via `tenant_users`, so the bootstrap user automatically gets a `tenant_users` row on first sign-in (and subsequent sign-in attempts will fail the count check).

### Optional refinement: explicit role

Add a `role TEXT` column to `tenant_users` with values `admin` / `member`. The bootstrap path sets `role='admin'`. The existing invite-consumption path sets `role='member'`. Future admin-only operations (issuing invites, managing the tenant, billing) check `role='admin'`. This is mostly for the hosted-multitenant flow but doesn't hurt to add now.

## Two-mode notes

| Mode | What changes |
|------|--------------|
| **Self-host** | Operator sets `BOOTSTRAP_OPEN=1` in `platform/deploy/.env` before first sign-in. After the first user lands, they remove or set to `0`. The check is per-instance, so each self-host deployment has its own bootstrap window. |
| **Hosted-multitenant** | At humancensys.com level, `BOOTSTRAP_OPEN` is set during initial setup. After Liz signs in (becoming the platform admin), it's removed. Subsequent tenants get their own admin via a separate "create tenant" flow that creates the `tenants` row + a starter `invitations` row for the email entered at signup. |

## Open questions

1. **Do we want a UI affordance for the bootstrap state?** A banner on `/auth/signin` that reads "Bootstrap mode active — the first user to sign in becomes the workspace owner." Adds clarity, slight code change.
2. **What happens if `BOOTSTRAP_OPEN=1` is set after users already exist?** The count check (`existing[0]?.count === 0`) fails, so no auto-creation. Safe but easy to misunderstand. Add a startup log entry: "BOOTSTRAP_OPEN is set but tenant_users already populated — the flag has no effect."
3. **Race conditions** — two users hitting Google sign-in within milliseconds of each other on a fresh DB. The count check + INSERT need to be atomic. Wrap in a transaction with `SERIALIZABLE` isolation, or use a sentinel row in `tenants` to lock. Probably fine for academic/MVP usage; tighten later.

## What this implies for the next action

This proposal can be implemented as a single PR after the test-auth flow merges to main. The change is ~30 lines in `web/auth.ts`, optionally one column added to `tenant_users` for the role field, and one env var documented in `platform/deploy/.env.template`. No schema migration needed for the bootstrap path itself.

Until this lands, the `scripts/insert-invite.py` workflow handles bootstrapping. The script is in the repo for reuse and re-documenting via the runbook pattern.

## Sources

- [Test-run journey log](../test-runs/2026-04-29-auth-end-to-end.md) — the chicken-and-egg surfaced as friction surface #7 during the auth wire-up
- [Pillar 0 proposal](pillar-0-tenant-abstraction.md) — the schema this proposal builds on
- Slack/conversation 2026-05-02: "the invite should just be an insert into the database no?" — yes, but the bootstrap of the first-ever invite is the gap
