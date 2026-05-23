// Sentry browser-side initialization for the Next.js client runtime.
//
// Gating:
//   - NEXT_PUBLIC_SENTRY_DSN unset → Sentry.init() not called → SDK inert
//   - DSN set AND PLATFORM_MODE=hosted → SDK active
//   - DSN set but PLATFORM_MODE!=hosted → still off (defense in depth)
//
// The DSN must be NEXT_PUBLIC_* so it's available in the browser bundle.
// Set it in Vercel's env vars dashboard for production. Leave unset for
// self-host installs.
//
// Convention reference: https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const platformMode = process.env.NEXT_PUBLIC_PLATFORM_MODE ?? "self_host";

if (dsn && platformMode === "hosted") {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    environment: platformMode,
    // Browser-only: session replay sampled at a fraction. Useful for debugging
    // user-visible errors but costs storage at scale. Tune as the project grows.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.0,
  });
}
