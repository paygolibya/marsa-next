import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleSubscriptionInit, type SubscriptionInitDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.MOAMALAT_MERCHANT_ID = "TESTMID";
process.env.MOAMALAT_TERMINAL_ID = "TESTTID";
process.env.MOAMALAT_SECRET_KEY = "abcd1234";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/payments/moamalat/subscription-init", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/payments/moamalat/subscription-init", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb() {
  const calls: { create?: unknown } = {};
  const db: SubscriptionInitDb = {
    payment: {
      create: async (args) => {
        calls.create = args;
        return { id: "payment-1" };
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleSubscriptionInit(db, noTokenReq({ period: "1m" }));
  assert.equal(res.status, 401);
});

test("rejects an invalid period with 400", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleSubscriptionInit(db, req({ period: "6m" }));
  assert.equal(res.status, 400);
  assert.equal(calls.create, undefined);
});

test("returns 503 when Moamalat isn't configured, before touching the database", async () => {
  const saved = { m: process.env.MOAMALAT_MERCHANT_ID, t: process.env.MOAMALAT_TERMINAL_ID, s: process.env.MOAMALAT_SECRET_KEY };
  delete process.env.MOAMALAT_MERCHANT_ID;
  const { db, calls } = makeFakeDb();
  const res = await handleSubscriptionInit(db, req({ period: "1m" }));
  assert.equal(res.status, 503);
  assert.equal(calls.create, undefined);
  process.env.MOAMALAT_MERCHANT_ID = saved.m;
  process.env.MOAMALAT_TERMINAL_ID = saved.t;
  process.env.MOAMALAT_SECRET_KEY = saved.s;
});

test("creates a pending payment for the authenticated merchant with the plan's own price and months", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleSubscriptionInit(db, req({ period: "12m" }, "merchant-42"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.paymentId, "payment-1");
  assert.ok(body.lightbox, "expected a signed LightBox config in the response");
  assert.ok(body.moamalatScriptUrl);

  const create = calls.create as { data: { merchantId: string; status: string; periodMonths: number } };
  assert.equal(create.data.merchantId, "merchant-42");
  assert.equal(create.data.status, "pending");
  assert.equal(create.data.periodMonths, 12);
});

test("the LightBox config's reference resolves back to this payment, not a hardcoded/placeholder id", async () => {
  const { db } = makeFakeDb();
  const res = await handleSubscriptionInit(db, req({ period: "1m" }));
  const body = await res.json();
  assert.equal(body.lightbox.MerchantReference, "sub:payment-1");
});
