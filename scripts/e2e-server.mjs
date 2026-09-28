// Starts the real Next.js app for E2E tests, pointed at the STAGING
// database (never production — real browser tests click real buttons that
// place real orders, which is exactly the kind of side effect that must
// never land in production data). Requires STAGING_DATABASE_URL to be set
// by whoever runs this (locally: export it yourself; in CI: the
// STAGING_DATABASE_URL repository secret in .github/workflows/e2e.yml).
import { spawn } from "node:child_process";

const stagingUrl = process.env.STAGING_DATABASE_URL;
if (!stagingUrl) {
  console.error(
    "STAGING_DATABASE_URL is not set — refusing to start. " +
      "E2E tests run real browser interactions that place real orders; " +
      "this must point at the staging database, never production, and " +
      "there is no safe default to fall back to."
  );
  process.exit(1);
}
if (stagingUrl.includes("thomas.proxy.rlwy.net")) {
  // The known production host, per this session's own setup — a hard
  // stop, not a warning, if this ever gets pointed at it by mistake.
  console.error("STAGING_DATABASE_URL appears to point at the production database host — refusing to start.");
  process.exit(1);
}

const child = spawn("npx", ["next", "dev"], {
  env: { ...process.env, DATABASE_URL: stagingUrl },
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
