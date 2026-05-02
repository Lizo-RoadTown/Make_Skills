/**
 * Next.js 16 proxy (renamed from middleware.ts).
 *
 * Re-exports the Auth.js `auth` function as `proxy`. Auth.js v5 returns
 * a Request handler from `auth()` that runs on the edge runtime, so we
 * cannot import the Drizzle adapter or pg pool here — the partial config
 * in auth.config.ts is what runs at this layer (providers + sign-in
 * pages only). The full config in auth.ts (with the adapter and DB
 * callbacks) runs in Node when API routes execute.
 *
 * The matcher excludes static assets and the auth API route itself.
 */
import NextAuth from "next-auth";
import authConfig from "./auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
