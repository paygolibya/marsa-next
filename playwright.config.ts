import { defineConfig, devices } from "@playwright/test";

// Real browser tests — the one layer nothing else in this test suite
// covers. Everything else (node:test's pure-logic/rendering/integration
// tests) verifies server-side behavior; this is what actually clicks
// through the real UI in a real Chromium instance against a real running
// server, catching the class of bug none of that can: a button with no
// onClick wired up, a client-side JS error, a form that submits the wrong
// field. Runs against BASE_URL (defaults to a local dev server) — for
// real data to interact with, point it at a server whose DATABASE_URL is
// the staging database (never production; see docs/staging.md-equivalent
// reasoning in scripts/e2e-server.mjs).
export default defineConfig({
  testDir: "./e2e",
  // Generous: in Next dev mode, each route compiles on demand on its first
  // hit, and a single checkout-flow test can be the first hit for several
  // routes in a row (storefront, checkout, confirmation) — the default 30s
  // budget gets exhausted by cumulative cold compiles, not slow assertions.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Only auto-starts a server when E2E_BASE_URL isn't already pointing at
  // one — scripts/e2e-server.mjs owns the actual "start Next against the
  // staging DB" lifecycle (see that file for why this isn't just
  // `next dev`), reused identically for local runs and CI.
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: "node scripts/e2e-server.mjs",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      },
});
