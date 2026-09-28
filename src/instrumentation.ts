import * as Sentry from "@sentry/nextjs";

// Server + edge runtime error reporting. Sentry's SDK already no-ops
// safely with no DSN configured (nothing is sent, just a one-line console
// notice, no error) — this matches every other integration's mock-
// fallback convention in this codebase (SendGrid, Vanex, Moamalat,
// Anthropic) without needing extra guard code, so SENTRY_DSN is simply
// optional here the same way those are.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
    });
  }
}

// Reports errors Next.js itself catches at the framework boundary (a
// Server Component render error, a route handler throwing instead of
// returning a Response) — on top of the explicit Sentry.captureException
// calls added to specific route catch blocks, which already log-and-
// swallow into a formatted error response rather than rethrowing.
export const onRequestError = Sentry.captureRequestError;
