import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateBugReport, type BugReportUpdateDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/bug-reports/bug-1", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/admin/bug-reports/bug-1", { method: "PATCH", body: JSON.stringify(body) });
}

function makeFakeDb() {
  const calls: { update?: unknown } = {};
  const db: BugReportUpdateDb = {
    bugReport: {
      update: async (args) => {
        calls.update = args;
        return { id: args.where.id, status: args.data.status };
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403, before touching the database", async () => {
  const { db } = makeFakeDb();
  const res = await handleUpdateBugReport(db, noTokenReq({ status: "fixed" }), "bug-1");
  assert.equal(res.status, 403);
});

test("rejects an invalid status with 400", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleUpdateBugReport(db, adminReq({ status: "not-a-real-status" }), "bug-1");
  assert.equal(res.status, 400);
  assert.equal(calls.update, undefined);
});

test("updates the report's status when a valid one is given", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleUpdateBugReport(db, adminReq({ status: "investigating" }), "bug-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.report.status, "investigating");
  assert.equal((calls.update as any).where.id, "bug-1");
});

test("accepts every documented status value", async () => {
  for (const status of ["open", "investigating", "fixed", "wont_fix"]) {
    const { db } = makeFakeDb();
    const res = await handleUpdateBugReport(db, adminReq({ status }), "bug-1");
    assert.equal(res.status, 200, `expected ${status} to be accepted`);
  }
});
