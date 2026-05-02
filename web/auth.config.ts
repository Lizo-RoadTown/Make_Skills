/**
 * Edge-safe partial Auth.js config.
 *
 * proxy.ts (Next.js 16's middleware-replacement) runs on the edge runtime
 * and cannot access the database adapter or the node-postgres pool.
 * This file holds:
 *   - providers (need clientId/clientSecret only — no DB)
 *   - pages
 *   - the HS256 jwt.encode/decode override (uses `jose` which IS edge-safe)
 *
 * The full config (adapter, signIn callback that consumes invites, jwt
 * callback that writes tenant_users) lives in auth.ts and runs in Node.
 *
 * The JWT override must be on BOTH layers so the edge proxy can verify
 * the same HS256 tokens the Node-side issues. See:
 * https://authjs.dev/guides/edge-compatibility
 */
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { SignJWT, jwtVerify } from "jose";
import type { NextAuthConfig } from "next-auth";

const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET is not set. Generate with `openssl rand -hex 32` and add to .env.local.",
  );
}
const secretBytes = new TextEncoder().encode(AUTH_SECRET);

export default {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: "read:user user:email" } },
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: { signIn: "/auth/signin", error: "/auth/error" },
  session: { strategy: "jwt" },

  // HS256 override — same on both layers so the proxy can decode the
  // tokens the Node-side issues. The FastAPI side (python-jose) verifies
  // with the same AUTH_SECRET.
  jwt: {
    encode: async ({ token }) => {
      return await new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(secretBytes);
    },
    decode: async ({ token }) => {
      if (!token) return null;
      const { payload } = await jwtVerify(token, secretBytes, {
        algorithms: ["HS256"],
      });
      return payload as Record<string, unknown>;
    },
  },
} satisfies NextAuthConfig;
