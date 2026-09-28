import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleProcessDeliveries, handleProcessDeliveriesManualTrigger, type ProcessDeliveriesDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function cronReq(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers.authorization = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/process-deliveries", { headers });
}

function adminReq() {
  return new Request("http://localhost/api/cron/process-deliveries", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/cron/process-deliveries", { method: "POST" });
}

function makeFakeDeps(result: { ordersProcessed: number; payoutsCreated: number; errors: string[] }) {
  const calls: { logCronRun?: unknown; processHours?: number } = {};
  const deps: ProcessDeliveriesDeps = {
    processRecentDeliveries: async (hours) => {
      calls.processHours = hours;
      return result;
    },
    withRetry: async (fn) => fn(),
    logCronRun: async (params) => {
      calls.logCronRun = params;
    },
  };
  return { deps, calls };
}

test("GET rejects a request with the wrong CRON_SECRET", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps } = makeFakeDeps({ ordersProcessed: 0, payoutsCreated: 0, errors: [] });
  const res = await handleProcessDeliveries(deps, cronReq("wrong"));
  assert.equal(res.status, 401);
  delete process.env.CRON_SECRET;
});

test("runs the daily catch-up window (24 hours), not some other window", async () => {
  const { deps, calls } = makeFakeDeps({ ordersProcessed: 5, payoutsCreated: 5, errors: [] });
  await handleProcessDeliveries(deps, cronReq());
  assert.equal(calls.processHours, 24);
});

test("logs 'failed' when nothing was processed successfully and errors are present", async () => {
  const { deps, calls } = makeFakeDeps({ ordersProcessed: 3, payoutsCreated: 0, errors: ["order o1: eligibility check failed"] });
  await handleProcessDeliveries(deps, cronReq());
  assert.equal((calls.logCronRun as any).status, "failed");
});

test("logs 'success' when at least one payout was created, even with some errors", async () => {
  const { deps, calls } = makeFakeDeps({ ordersProcessed: 5, payoutsCreated: 4, errors: ["order o5: already calculated"] });
  await handleProcessDeliveries(deps, cronReq());
  assert.equal((calls.logCronRun as any).status, "success");
});

test("the admin manual-trigger POST rejects a non-admin/unauthenticated request with 403", async () => {
  const { deps } = makeFakeDeps({ ordersProcessed: 0, payoutsCreated: 0, errors: [] });
  const res = await handleProcessDeliveriesManualTrigger(deps, noTokenReq());
  assert.equal(res.status, 403);
});

// Same real bug as weekly-payouts: the old POST delegated to GET(req),
// which re-checked the admin's own Authorization header against
// CRON_SECRET and would always fail once that was configured.
test("the admin manual-trigger POST succeeds even when CRON_SECRET is configured", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps } = makeFakeDeps({ ordersProcessed: 1, payoutsCreated: 1, errors: [] });
  const res = await handleProcessDeliveriesManualTrigger(deps, adminReq());
  assert.equal(res.status, 200);
  delete process.env.CRON_SECRET;
});
