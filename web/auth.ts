/**
 * Auth.js v5 — Node-runtime full config.
 *
 * Spreads the edge-safe partial config from auth.config.ts (providers,
 * pages, JWT HS256 override) and adds:
 *   - Drizzle adapter (postgres-backed; not edge-safe)
 *   - signIn callback that atomically consumes an unconsumed invitation
 *   - jwt callback that injects tenant_id from the consumed invite and
 *     persists the user → tenant mapping to tenant_users
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
     * Invite gate. The user must have an unconsumed invitations row
     * matching their verified OAuth email. Atomically claim it.
     *
     * Return values:
     *   true                            — allow sign-in
     *   "/auth/error?error=NoInvite"    — deny + redirect with reason
     *   "/auth/error?error=...other..." — other denial reasons
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

        if (claimed.length === 0) {
          return "/auth/error?error=NoInvite";
        }

        (user as { tenantId?: string }).tenantId = claimed[0].tenantId;
        return true;
      } catch (e) {
        console.error("signIn invite check failed", e);
        return "/auth/error?error=Configuration";
      }
    },

    /**
     * Inject tenant_id into the JWT. First sign-in: read tenantId from
     * consumed invite (set above) and persist the user → tenant mapping.
     * Subsequent calls: token already carries tenant_id.
     */
    async jwt({ token, user, trigger }) {
      if (trigger === "signIn" && user) {
        token.sub = user.id as string;
        const incomingTenantId = (user as { tenantId?: string }).tenantId;

        if (incomingTenantId) {
          await db
            .insert(schema.tenantUsers)
            .values({ userId: user.id as string, tenantId: incomingTenantId })
            .onConflictDoNothing();
          token.tenant_id = incomingTenantId;
        } else {
          const rows = await db
            .select({ tenantId: schema.tenantUsers.tenantId })
            .from(schema.tenantUsers)
            .where(eq(schema.tenantUsers.userId, user.id as string))
            .limit(1);
          if (rows[0]) token.tenant_id = rows[0].tenantId;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.tenant_id) {
        (session.user as { tenantId?: string }).tenantId =
          token.tenant_id as string;
      }
      return session;
    },
  },
});
