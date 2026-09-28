import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListPayments, type ListPaymentsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(url: string) {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` } });
}

function noTokenReq(url: string) {
  return new Request(url);
}

function makeFakeDb() {
  const calls: { where?: unknown } = {};
  const db: ListPaymentsDb = {
    payment: {
      findMany: async (args) => {
        calls.where = args.where;
        return [];
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const { db } = makeFakeDb();
  const res = await handleListPayments(db, noTokenReq("http://localhost/api/admin/payments"));
  assert.equal(res.status, 403);
});

test("defaults to status=pending when no query param is given", async () => {
  const { db, calls } = makeFakeDb();
  await handleListPayments(db, adminReq("http://localhost/api/admin/payments"));
  assert.deepEqual(calls.where, { status: "pending" });
});

test("respects an explicit status query param", async () => {
  const { db, calls } = makeFakeDb();
  await handleListPayments(db, adminReq("http://localhost/api/admin/payments?status=approved"));
  assert.deepEqual(calls.where, { status: "approved" });
});
