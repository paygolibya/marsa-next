import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleSubscriptionInit, type SubscriptionInitDb, type SubscriptionInitDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.DPAY_API_TOKEN = "test-dpay-token";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/payments/dpay/subscription-init", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/payments/dpay/subscription-init", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDeps() {
  const calls: { create?: unknown; update?: unknown; openDpaySession?: unknown } = {};
  const db: SubscriptionInitDb = {
    payment: {
      create: async (args) => {
        calls.create = args;
        return { id: "payment-1" };
      },
      update: async (args) => {
        calls.update = args;
        return {};
      },
    },
  };
  const deps: SubscriptionInitDeps = {
    db,
    openDpaySession: async (amountCents, ref, idempotencyKey) => {
      calls.openDpaySession = { amountCents, ref, idempotencyKey };
      return { sessionId: 42, paymentLink: "https://dpay.ly/moamalat-pay/42", feeCents: 250, expiresAt: "2026-01-01T00:00:00.000000Z" };
    },
  };
  return { deps, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleSubscriptionInit(deps, noTokenReq({ period: "1m" }));
  assert.equal(res.status, 401);
});

test("rejects an invalid period with 400", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleSubscriptionInit(deps, req({ period: "6m" }));
  assert.equal(res.status, 400);
  assert.equal(calls.create, undefined);
});

test("returns 503 when DPay isn't configured, before touching the database", async () => {
  const saved = process.env.DPAY_API_TOKEN;
  delete process.env.DPAY_API_TOKEN;
  const { deps, calls } = makeFakeDeps();
  const res = await handleSubscriptionInit(deps, req({ period: "1m" }));
  assert.equal(res.status, 503);
  assert.equal(calls.create, undefined);
  process.env.DPAY_API_TOKEN = saved;
});

test("creates a pending payment for the authenticated merchant with the plan's own price and months, then opens a DPay session for it", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleSubscriptionInit(deps, req({ period: "12m" }, "merchant-42"));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.paymentId, "payment-1");
  assert.equal(body.dpayPaymentLink, "https://dpay.ly/moamalat-pay/42");
  assert.ok(body.dpaySessionExpiresAt);

  const create = calls.create as { data: { merchantId: string; status: string; periodMonths: number; amount: number } };
  assert.equal(create.data.merchantId, "merchant-42");
  assert.equal(create.data.status, "pending");
  assert.equal(create.data.periodMonths, 12);
  assert.equal(create.data.amount, 1500); // 12m plan's totalPriceLYD
});

test("opens the DPay session with the payment's own reference and amount in cents, using the payment id as the idempotency key", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleSubscriptionInit(deps, req({ period: "1m" }));
  const openArgs = calls.openDpaySession as { amountCents: number; ref: string; idempotencyKey: string };
  assert.equal(openArgs.ref, "sub:payment-1");
  assert.equal(openArgs.idempotencyKey, "payment-1");
  assert.equal(openArgs.amountCents, 150 * 100); // 1m plan's totalPriceLYD
});

test("stores the DPay session id, pay method, and fee on the payment row", async () => {
  const { deps, calls } = makeFakeDeps();
  await handleSubscriptionInit(deps, req({ period: "1m" }));
  const update = calls.update as { where: { id: string }; data: { dpaySessionId: string; dpayPayMethod: string; dpayFeeCents: number } };
  assert.equal(update.where.id, "payment-1");
  assert.equal(update.data.dpaySessionId, "42");
  assert.equal(update.data.dpayPayMethod, "moamalat");
  assert.equal(update.data.dpayFeeCents, 250);
});
