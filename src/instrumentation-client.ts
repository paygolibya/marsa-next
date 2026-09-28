import * as Sentry from "@sentry/nextjs";

// Browser-side error reporting. Needs the NEXT_PUBLIC_-prefixed variable
// specifically — Next.js only inlines NEXT_PUBLIC_* env vars into the
// client bundle; the server-side SENTRY_DSN (instrumentation.ts) is never
// exposed to the browser, so these are two separate variables even though
// they'd normally hold the same DSN value. Same optional/no-op-when-unset
// convention as the server side.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // No session replay — real user session recording is a meaningfully
  // bigger privacy/cost surface than error reporting, and nothing here
  // asked for it. Left at 0 rather than omitted, so this is a deliberate
  // "off," not an accidental default.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
