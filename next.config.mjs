import path from "node:path";
import { fileURLToPath } from "node:url";
// withSentryConfig lives under the package's own /config subpath, separate
// from the main @sentry/nextjs entry (which resolves to different runtime
// builds — edge/browser/node — depending on context; the build-time config
// wrapper needs a stable entry regardless of target runtime).
import { withSentryConfig } from "@sentry/nextjs/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
};

// withSentryConfig wraps the build to (optionally) upload source maps and
// inject the instrumentation hooks. Source map upload needs
// SENTRY_AUTH_TOKEN/SENTRY_ORG/SENTRY_PROJECT — deliberately left unset
// here (no real Sentry project configured yet), and the plugin skips that
// step gracefully with a warning rather than failing the build, matching
// what the rest of this config assumes: `npm run build` must succeed with
// zero Sentry credentials, the same as it does for every other integration.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
