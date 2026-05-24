// Sentry initialization for the Next.js Node runtime (Server Components,
// Route Handlers, Server Actions, API routes).
//
// Gating mirrors sentry.client.config.ts. The server-side DSN is read
// from SENTRY_DSN (NOT prefixed NEXT_PUBLIC_) so it stays server-only.
//
// Pattern source: @sentry/nextjs documented convention (added in PR #35
// at web/package.json:12). See:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
const platformMode = process.env.PLATFORM_MODE ?? "self_host";

if (dsn && platformMode === "hosted") {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: platformMode,
  });
}
