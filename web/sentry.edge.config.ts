// Sentry initialization for the Next.js Edge runtime (middleware,
// edge functions, edge route handlers).
//
// Edge runtime constraints: no Node APIs, smaller bundle, runs on
// Vercel's edge network. Sentry's @sentry/nextjs ships an edge-compatible
// subset that this config initializes.
//
// Gating mirrors the server config. DSN read from SENTRY_DSN.
//
// Pattern source: @sentry/nextjs documented convention (web/package.json:12).
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
