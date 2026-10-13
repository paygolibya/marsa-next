import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleMarkAllRead, type MarkAllReadDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/notifications/mark-all-read", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/notifications/mark-all-read", { method: "PATCH" });
}

function makeFakeDb() {
  const calls: { updateManyArgs?: unknown } = {};
  const db: MarkAllReadDb = {
    notification: {
      updateMany: async (args) => {
        calls.updateManyArgs = args;
        return { count: 2 };
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleMarkAllRead(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("marks only the authenticated merchant's unread notifications read", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleMarkAllRead(db, req("merchant-77"));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.updateManyArgs, { where: { merchantId: "merchant-77", read: false }, data: { read: true } });
});
