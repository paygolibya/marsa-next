import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handlePushSubscribe, type PushSubscribeDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

const VALID_BODY = { endpoint: "https://push.example.com/abc123", keys: { p256dh: "p256dh-key", auth: "auth-key" } };

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/push/subscribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/push/subscribe", { method: "POST", body: "{}" });
}

function makeFakeDb() {
  const calls: { upsertArgs?: unknown } = {};
  const db: PushSubscribeDb = {
    pushSubscription: {
      upsert: async (args) => {
        calls.upsertArgs = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handlePushSubscribe(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("rejects a malformed subscription with 400", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handlePushSubscribe(db, req({ endpoint: "not-a-url" }));
  assert.equal(res.status, 400);
  assert.equal(calls.upsertArgs, undefined);
});

test("upserts the subscription keyed on endpoint, scoped to the authenticated merchant", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handlePushSubscribe(db, req(VALID_BODY, "merchant-77"));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.upsertArgs, {
    where: { endpoint: "https://push.example.com/abc123" },
    create: { merchantId: "merchant-77", endpoint: "https://push.example.com/abc123", p256dh: "p256dh-key", auth: "auth-key" },
    update: { merchantId: "merchant-77", p256dh: "p256dh-key", auth: "auth-key" },
  });
});
