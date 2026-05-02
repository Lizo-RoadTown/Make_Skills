/**
 * Auth.js v5 — Node-runtime full config.
 *
 * Spreads the edge-safe partial config from auth.config.ts (providers,
 * pages, JWT HS256 override) and adds:
 *   - Drizzle adapter (postgres-backed; not edge-safe)
 *   - signIn callback with three paths:
 *       1. existing user → let them in (their tenant_users row stays the
 *          source of truth; no re-invite needed)
 *       2. new user with unconsumed invite → claim atomically
 *       3. bootstrap (no tenant_users in DB at all) → create the tenant,
 *          mark this user admin
 *   - jwt callback that injects tenant_id + role into the token
 *   - session callback that exposes user.tenantId to the client
 *
 * proxy.ts uses ONLY auth.config.ts so it can verify tokens at the edge
 * without the adapter or pg. API routes hit auth.ts via @/auth.
 */
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, isNull, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import { db, schema } from "./db";
import authConfig from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  callbacks: {
    /**
     * Three paths, in order:
     *
     *   1. Existing user — already has a tenant_users row keyed off their
     *      email. Let them in; the invitation was a one-time gate, not a
     *      recurring requirement.
     *
     *   2. New user with an unconsumed invite — claim it atomically. The
     *      consumed_at timestamp prevents re-use.
     *
     *   3. Bootstrap (no tenant_users row exists in the database AT ALL).
     *      The first user signing in becomes the workspace owner. A
     *      fresh tenant is created, this user is added as admin, and
     *      future sign-ins for this user follow path #1. Subsequent
     *      users hit path #2 (invite required).
     */
    async signIn({ user, account, profile }) {
      const email = user.email?.toLowerCase();
      if (!email || !account) return "/auth/error?error=Configuration";

      const verified =
        account.provider === "google"
          ? (profile as { email_verified?: boolean })?.email_verified === true
          : account.provider === "github"
            ? true
            : false;
      if (!verified) return "/auth/error?error=EmailNotVerified";

      try {
        // PATH 1: existing user — tenant_users → users by email.
        const existing = await db
          .select({
            tenantId: schema.tenantUsers.tenantId,
            role: schema.tenantUsers.role,
          })
          .from(schema.tenantUsers)
          .innerJoin(
            schema.users,
            eq(schema.tenantUsers.userId, schema.users.id),
          )
          .where(eq(schema.users.email, email))
          .limit(1);

        if (existing[0]) {
          (user as { tenantId?: string; role?: string }).tenantId =
            existing[0].tenantId;
          (user as { tenantId?: string; role?: string }).role =
            existing[0].role;
          return true;
        }

        // PATH 2: new user with an unconsumed invite. Atomic claim.
        const claimed = await db
          .update(schema.invitations)
          .set({ consumedAt: sql`now()`, consumedByEmail: email })
          .where(
            and(
              eq(schema.invitations.email, email),
              isNull(schema.invitations.consumedAt),
            ),
          )
          .returning({ tenantId: schema.invitations.tenantId });

        if (claimed[0]) {
          (user as { tenantId?: string; role?: string }).tenantId =
            claimed[0].tenantId;
          (user as { tenantId?: string; role?: string }).role = "member";
          return true;
        }

        // PATH 3: bootstrap. Only fires when tenant_users is empty —
        // i.e. the workspace has never had a user before. Race-prone in
        // theory (two simultaneous sign-ins on a fresh DB), but the
        // window is sub-second on a fresh deploy and a normal deploy
        // never has two pre-positioned users hitting at the same instant.
        const countRow = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.tenantUsers);
        const tenantUserCount = Number(countRow[0]?.c ?? 0);

        if (tenantUserCount === 0) {
          const newTenant = await db
            .insert(schema.tenants)
            .values({ name: `${email}'s workspace` })
            .returning({ id: schema.tenants.id });
          const newTenantId = newTenant[0]?.id;
          if (newTenantId) {
            (user as { tenantId?: string; role?: string }).tenantId =
              newTenantId;
            (user as { tenantId?: string; role?: string }).role = "admin";
            console.log(
              `[auth] bootstrap: created tenant ${newTenantId} for ${email} as admin`,
            );
            return true;
          }
        }

        return "/auth/error?error=NoInvite";
      } catch (e) {
        console.error("signIn check failed", e);
        return "/auth/error?error=Configuration";
      }
    },

    /**
     * Inject tenant_id and role into the JWT.
     *
     * On first sign-in (trigger === "signIn"):
     *   - If `user.tenantId` is set (paths 1 / 2 / 3 above), persist a
     *     tenant_users row if missing, then write tenant_id + role to
     *     the token.
     *   - For path 1 (existing user), the row already exists — onConflict
     *     leaves it alone.
     *
     * Subsequent calls just read the token through.
     */
    async jwt({ token, user, trigger }) {
      if (trigger === "signIn" && user) {
        token.sub = user.id as string;
        const incomingTenantId = (user as { tenantId?: string }).tenantId;
        const incomingRole = (user as { role?: string }).role || "member";

        if (incomingTenantId) {
          await db
            .insert(schema.tenantUsers)
            .values({
              userId: user.id as string,
              tenantId: incomingTenantId,
              role: incomingRole,
            })
            .onConflictDoNothing();
          token.tenant_id = incomingTenantId;
          token.role = incomingRole;
        } else {
          // Fallback (shouldn't fire after the new signIn paths, but
          // belt-and-braces for any code path that bypasses signIn):
          // look up the user's tenant_users row directly.
          const rows = await db
            .select({
              tenantId: schema.tenantUsers.tenantId,
              role: schema.tenantUsers.role,
            })
            .from(schema.tenantUsers)
            .where(eq(schema.tenantUsers.userId, user.id as string))
            .limit(1);
          if (rows[0]) {
            token.tenant_id = rows[0].tenantId;
            token.role = rows[0].role;
          }
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.tenant_id) {
        (session.user as { tenantId?: string; role?: string }).tenantId =
          token.tenant_id as string;
      }
      if (token.role) {
        (session.user as { tenantId?: string; role?: string }).role =
          token.role as string;
      }
      return session;
    },
  },
});
