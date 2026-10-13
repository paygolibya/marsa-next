import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handlePushUnsubscribe, type PushUnsubscribeDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/push/unsubscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/push/unsubscribe", { method: "POST", body: "{}" });
}

function makeFakeDb() {
  const calls: { deleteManyWhere?: unknown } = {};
  const db: PushUnsubscribeDb = {
    pushSubscription: {
      deleteMany: async (args) => {
        calls.deleteManyWhere = args.where;
        return { count: 1 };
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handlePushUnsubscribe(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("deletes only the authenticated merchant's own subscription for that endpoint", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handlePushUnsubscribe(db, req({ endpoint: "https://push.example.com/abc123" }, "merchant-77"));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.deleteManyWhere, { endpoint: "https://push.example.com/abc123", merchantId: "merchant-77" });
});
