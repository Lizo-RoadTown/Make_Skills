"use client";
import { SessionProvider } from "next-auth/react";

/**
 * Client-side wrapper so the rest of the app (Sidebar, hooks, etc.) can
 * use `useSession()`. Server-side route handlers use `auth()` directly
 * from @/auth and don't need this provider.
 */
export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
