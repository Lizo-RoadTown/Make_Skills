// Next.js instrumentation entry point. Next.js 15+ calls register() once
// per runtime at boot, before any application code runs. We use this to
// load the runtime-appropriate Sentry config (server or edge).
//
// The client-side config (sentry.client.config.ts) is loaded automatically
// by the Sentry webpack plugin during the client bundle build — no
// import needed here.
//
// Pattern source: Sentry @sentry/nextjs convention + Next.js
// instrumentation hook docs.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Optional hook that lets Sentry capture errors thrown during React
// component rendering on the server. Recommended by Sentry's Next.js docs.
export const onRequestError = (await import("@sentry/nextjs")).captureRequestError;
