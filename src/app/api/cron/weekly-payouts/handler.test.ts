import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleWeeklyPayouts, handleWeeklyPayoutsManualTrigger, type WeeklyPayoutsDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function cronReq(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers.authorization = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/weekly-payouts", { headers });
}

function adminReq() {
  return new Request("http://localhost/api/cron/weekly-payouts", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/cron/weekly-payouts", { method: "POST" });
}

function makeFakeDeps(result: { merchantsCount: number; commissionsCount: number; totalAmountCents: number; errors: string[] }) {
  const calls: { logCronRun?: unknown } = {};
  const deps: WeeklyPayoutsDeps = {
    runWeeklyPayoutBatching: async () => result,
    withRetry: async (fn) => fn(),
    logCronRun: async (params) => {
      calls.logCronRun = params;
    },
  };
  return { deps, calls };
}

test("GET rejects a request with the wrong CRON_SECRET", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps } = makeFakeDeps({ merchantsCount: 0, commissionsCount: 0, totalAmountCents: 0, errors: [] });
  const res = await handleWeeklyPayouts(deps, cronReq("wrong-secret"));
  assert.equal(res.status, 401);
  delete process.env.CRON_SECRET;
});

test("GET accepts a request with the correct CRON_SECRET and runs the batching", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps, calls } = makeFakeDeps({ merchantsCount: 3, commissionsCount: 10, totalAmountCents: 50000, errors: [] });
  const res = await handleWeeklyPayouts(deps, cronReq("real-secret"));
  assert.equal(res.status, 200);
  assert.ok(calls.logCronRun);
  delete process.env.CRON_SECRET;
});

test("GET runs unauthenticated (with a warning) when CRON_SECRET isn't configured at all", async () => {
  delete process.env.CRON_SECRET;
  const { deps } = makeFakeDeps({ merchantsCount: 0, commissionsCount: 0, totalAmountCents: 0, errors: [] });
  const res = await handleWeeklyPayouts(deps, cronReq());
  assert.equal(res.status, 200);
});

test("logs a 'failed' run when batching reports errors for every merchant (merchantsCount 0 with errors present)", async () => {
  const { deps, calls } = makeFakeDeps({ merchantsCount: 0, commissionsCount: 5, totalAmountCents: 0, errors: ["merchant m1: db timeout"] });
  await handleWeeklyPayouts(deps, cronReq());
  assert.equal((calls.logCronRun as any).status, "failed");
});

test("logs 'success' when at least one merchant batched, even if some others errored", async () => {
  const { deps, calls } = makeFakeDeps({ merchantsCount: 2, commissionsCount: 5, totalAmountCents: 10000, errors: ["merchant m3: db timeout"] });
  await handleWeeklyPayouts(deps, cronReq());
  assert.equal((calls.logCronRun as any).status, "success");
});

test("if the batching call itself throws (even after retries), logs a failed run and returns 500", async () => {
  const calls: { logCronRun?: unknown } = {};
  const deps: WeeklyPayoutsDeps = {
    runWeeklyPayoutBatching: async () => {
      throw new Error("db down");
    },
    withRetry: async (fn) => fn(),
    logCronRun: async (params) => {
      calls.logCronRun = params;
    },
  };
  const res = await handleWeeklyPayouts(deps, cronReq());
  assert.equal(res.status, 500);
  assert.equal((calls.logCronRun as any).status, "failed");
});

test("the admin manual-trigger POST rejects a non-admin/unauthenticated request with 403", async () => {
  const { deps } = makeFakeDeps({ merchantsCount: 0, commissionsCount: 0, totalAmountCents: 0, errors: [] });
  const res = await handleWeeklyPayoutsManualTrigger(deps, noTokenReq());
  assert.equal(res.status, 403);
});

// This is the actual bug found while porting this route to DI: the old
// code had POST delegate to GET(req), which re-checked the SAME
// Authorization header against CRON_SECRET — but that header holds the
// admin's JWT here, never the cron secret, so the manual-recovery path
// was permanently unreachable the moment CRON_SECRET was configured.
test("the admin manual-trigger POST succeeds even when CRON_SECRET is configured — admin JWT auth doesn't need the cron secret too", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps } = makeFakeDeps({ merchantsCount: 1, commissionsCount: 1, totalAmountCents: 1000, errors: [] });
  const res = await handleWeeklyPayoutsManualTrigger(deps, adminReq());
  assert.equal(res.status, 200);
  delete process.env.CRON_SECRET;
});
