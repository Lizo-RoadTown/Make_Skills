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

/**
 * Secret resolved lazily so Next.js's build-time "collect page data"
 * pass can import this module without AUTH_SECRET set in the build env.
 * Throws clearly at first sign/verify call if missing at runtime.
 */
let _secretBytes: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (_secretBytes) return _secretBytes;
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET is not set. Generate with `openssl rand -hex 32` and set in Vercel project env vars (Preview + Production scopes).",
    );
  }
  _secretBytes = new TextEncoder().encode(s);
  return _secretBytes;
}

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
        .sign(getSecret());
    },
    decode: async ({ token }) => {
      if (!token) return null;
      const { payload } = await jwtVerify(token, getSecret(), {
        algorithms: ["HS256"],
      });
      return payload as Record<string, unknown>;
    },
  },
} satisfies NextAuthConfig;
