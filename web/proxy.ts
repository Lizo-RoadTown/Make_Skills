/**
 * Next.js 16 proxy (renamed from middleware.ts).
 *
 * Default-exports the Auth.js `auth` function. Auth.js v5 returns a
 * Request handler that runs on the edge runtime, so we cannot import
 * the Drizzle adapter or pg pool here — the partial config in
 * auth.config.ts is what runs at this layer (providers + sign-in
 * pages + the HS256 jwt encode/decode override). The full config in
 * auth.ts (with the adapter and DB callbacks) runs in Node when API
 * routes execute.
 *
 * Default export form is required for Next.js 16's static analysis
 * to detect the function correctly. The earlier `export const { auth:
 * proxy } = NextAuth(...)` destructuring pattern produced a
 * "must export a function" build error.
 */
import NextAuth from "next-auth";
import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
