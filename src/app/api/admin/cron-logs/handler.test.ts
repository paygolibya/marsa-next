import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCronLogs, type CronLogsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq() {
  return new Request("http://localhost/api/admin/cron-logs", { headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` } });
}

function noTokenReq() {
  return new Request("http://localhost/api/admin/cron-logs");
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const db: CronLogsDb = { cronLog: { findMany: async () => [] } };
  const res = await handleCronLogs(db, noTokenReq());
  assert.equal(res.status, 403);
});

test("returns the most recent 100 logs, newest first", async () => {
  let receivedArgs: unknown;
  const db: CronLogsDb = {
    cronLog: {
      findMany: async (args) => {
        receivedArgs = args;
        return [{ id: "log-1", jobName: "weekly-payouts", status: "success", executedAt: new Date() }];
      },
    },
  };
  const res = await handleCronLogs(db, adminReq());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.logs.length, 1);
  assert.deepEqual(receivedArgs, { orderBy: { executedAt: "desc" }, take: 100 });
});
