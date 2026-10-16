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
  // sharp ships a native binary — bundling it through webpack (the default
  // for server code) breaks that binary. This keeps it as a real
  // node_modules import at runtime instead, the way Next expects for any
  // native dependency used in a Route Handler.
  serverExternalPackages: ["sharp"],
  // Baseline browser security headers on every response. Deliberately no
  // full script-src CSP yet — checkout loads Moamalat's LightBox, stores
  // load merchants' Facebook/TikTok/Google pixels, and images come from
  // Vercel Blob, so a strict policy needs its own careful rollout.
  // frame-ancestors alone is safe and closes clickjacking on the
  // dashboard and checkout (nothing in the app embeds its own pages).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
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
