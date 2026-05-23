import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";
import { withSentryConfig } from "@sentry/nextjs";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  // Fumadocs needs MDX-aware page extensions
  pageExtensions: ["mdx", "ts", "tsx"],
};

// Wrap with fumadocs first (page-extension config), then Sentry
// (build-time source-map upload). Sentry's wrap is a no-op at runtime when
// SENTRY_DSN is unset; it ONLY affects build output when SENTRY_AUTH_TOKEN
// is set in CI. Self-host installs leave both unset.
//
// Pattern source: @sentry/nextjs documented convention (web/package.json:12).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export default withSentryConfig(withMDX(nextConfig), {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  disableLogger: true,
});
