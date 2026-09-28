import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleExpireSubscriptions, handleExpireSubscriptionsManualTrigger, type ExpireSubscriptionsDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function cronReq(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) headers.authorization = `Bearer ${secret}`;
  return new Request("http://localhost/api/cron/expire-subscriptions", { headers });
}

function adminReq() {
  return new Request("http://localhost/api/cron/expire-subscriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/cron/expire-subscriptions", { method: "POST" });
}

function makeFakeDeps(expiredCount: number) {
  const calls: { logCronRun?: unknown } = {};
  const deps: ExpireSubscriptionsDeps = {
    expireAllLapsed: async () => ({ expiredCount }),
    withRetry: async (fn) => fn(),
    logCronRun: async (params) => {
      calls.logCronRun = params;
    },
  };
  return { deps, calls };
}

test("GET rejects a request with the wrong CRON_SECRET", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps } = makeFakeDeps(0);
  const res = await handleExpireSubscriptions(deps, cronReq("wrong"));
  assert.equal(res.status, 401);
  delete process.env.CRON_SECRET;
});

test("logs a success run with the real expired count", async () => {
  const { deps, calls } = makeFakeDeps(7);
  const res = await handleExpireSubscriptions(deps, cronReq());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.expiredCount, 7);
  assert.equal((calls.logCronRun as any).status, "success");
  assert.equal((calls.logCronRun as any).payoutsCreated, 7);
});

test("if expireAllLapsed throws, logs a failed run and returns 500", async () => {
  const calls: { logCronRun?: unknown } = {};
  const deps: ExpireSubscriptionsDeps = {
    expireAllLapsed: async () => {
      throw new Error("db down");
    },
    withRetry: async (fn) => fn(),
    logCronRun: async (params) => {
      calls.logCronRun = params;
    },
  };
  const res = await handleExpireSubscriptions(deps, cronReq());
  assert.equal(res.status, 500);
  assert.equal((calls.logCronRun as any).status, "failed");
});

test("the admin manual-trigger POST rejects a non-admin/unauthenticated request with 403", async () => {
  const { deps } = makeFakeDeps(0);
  const res = await handleExpireSubscriptionsManualTrigger(deps, noTokenReq());
  assert.equal(res.status, 403);
});

// Same real bug as the other two cron routes: the old POST delegated to
// GET(req), which re-checked the admin's own Authorization header against
// CRON_SECRET and would always fail once that was configured.
test("the admin manual-trigger POST succeeds even when CRON_SECRET is configured", async () => {
  process.env.CRON_SECRET = "real-secret";
  const { deps } = makeFakeDeps(2);
  const res = await handleExpireSubscriptionsManualTrigger(deps, adminReq());
  assert.equal(res.status, 200);
  delete process.env.CRON_SECRET;
});
