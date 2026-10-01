import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { handleDpayWebhook, type DpayWebhookDeps } from "./handler";

const SECRET = "test-webhook-secret";
process.env.DPAY_WEBHOOK_SECRET = SECRET;

function sign(timestamp: string, rawBody: string): string {
  return crypto.createHmac("sha256", SECRET).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

function signedReq(payload: unknown, overrides: { timestamp?: string; signature?: string; rawBody?: string } = {}) {
  const rawBody = overrides.rawBody ?? JSON.stringify(payload);
  const timestamp = overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const signature = overrides.signature ?? sign(timestamp, rawBody);
  return new Request("http://localhost/api/dpay/webhook", {
    method: "POST",
    headers: { "x-dpay-timestamp": timestamp, "x-dpay-signature": signature },
    body: rawBody,
  });
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    event: "payment.paid",
    live: true,
    session_id: 42,
    status: "paid",
    amount: 100,
    pay_method: "moamalat",
    tx_id: "txn_abc123",
    system_reference: "SYS-1",
    network_reference: "NET-1",
    data: { ref: "order:order-1" },
    ...overrides,
  };
}

function makeFakeDeps(finalizeResult: Awaited<ReturnType<DpayWebhookDeps["finalizeByMerchantReference"]>> = null) {
  const calls: { orderUpdate?: unknown; paymentUpdate?: unknown; finalizeArgs?: unknown } = {};
  const deps: DpayWebhookDeps = {
    db: {
      order: {
        update: async (args) => {
          calls.orderUpdate = args;
          return {};
        },
      },
      payment: {
        update: async (args) => {
          calls.paymentUpdate = args;
          return {};
        },
      },
    },
    finalizeByMerchantReference: async (ref, outcome) => {
      calls.finalizeArgs = { ref, outcome };
      return finalizeResult;
    },
  };
  return { deps, calls };
}

test("fails closed with 500 when DPAY_WEBHOOK_SECRET isn't configured, before even checking the signature", async () => {
  const saved = process.env.DPAY_WEBHOOK_SECRET;
  delete process.env.DPAY_WEBHOOK_SECRET;
  const { deps, calls } = makeFakeDeps();
  const res = await handleDpayWebhook(deps, signedReq(makePayload()));
  assert.equal(res.status, 500);
  assert.equal(calls.finalizeArgs, undefined);
  process.env.DPAY_WEBHOOK_SECRET = saved;
});

test("rejects a request with a tampered/invalid signature with 401 — this IS the security boundary", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleDpayWebhook(deps, signedReq(makePayload(), { signature: "0".repeat(64) }));
  assert.equal(res.status, 401);
  assert.equal(calls.finalizeArgs, undefined, "must never finalize a payment on an unverified notification");
});

test("rejects a replayed request (timestamp older than 5 minutes) with 401", async () => {
  const { deps, calls } = makeFakeDeps();
  const staleTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60);
  const rawBody = JSON.stringify(makePayload());
  const res = await handleDpayWebhook(deps, signedReq(makePayload(), { timestamp: staleTimestamp, signature: sign(staleTimestamp, rawBody), rawBody }));
  assert.equal(res.status, 401);
  assert.equal(calls.finalizeArgs, undefined);
});

test("rejects invalid JSON with 400, even with a valid signature over the raw bytes", async () => {
  const { deps } = makeFakeDeps();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await handleDpayWebhook(deps, signedReq(null, { timestamp, signature: sign(timestamp, "not json"), rawBody: "not json" }));
  assert.equal(res.status, 400);
});

test("acknowledges (200) webhook.test without finalizing anything", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleDpayWebhook(deps, signedReq(makePayload({ event: "webhook.test", data: undefined })));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(calls.finalizeArgs, undefined);
});

test("acknowledges (200) an unrecognized future event type without finalizing anything", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleDpayWebhook(deps, signedReq(makePayload({ event: "payment.some_future_event" })));
  assert.equal(res.status, 200);
  assert.equal(calls.finalizeArgs, undefined);
});

test("acknowledges (200) a validly-signed payment.paid with no data.ref, without finalizing anything", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleDpayWebhook(deps, signedReq(makePayload({ data: {} })));
  assert.equal(res.status, 200);
  assert.equal(calls.finalizeArgs, undefined);
});

test("a valid order-payment event finalizes as 'paid' and records both references on the order", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "order", id: "order-1", result: { updated: true } });
  const res = await handleDpayWebhook(deps, signedReq(makePayload()));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.finalizeArgs, { ref: "order:order-1", outcome: "paid" });
  const orderUpdate = calls.orderUpdate as { where: { id: string }; data: { moamalatSystemReference: string; moamalatNetworkReference: string } };
  assert.equal(orderUpdate.where.id, "order-1");
  assert.equal(orderUpdate.data.moamalatSystemReference, "SYS-1");
  assert.equal(orderUpdate.data.moamalatNetworkReference, "NET-1");
  assert.equal(calls.paymentUpdate, undefined); // an order, not a subscription payment
});

test("a valid subscription-payment event updates the Payment row, not an Order", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "subscription", id: "payment-1", result: { updated: true } });
  const res = await handleDpayWebhook(deps, signedReq(makePayload({ data: { ref: "sub:payment-1" } })));
  assert.equal(res.status, 200);
  const paymentUpdate = calls.paymentUpdate as { where: { id: string } };
  assert.equal(paymentUpdate.where.id, "payment-1");
  assert.equal(calls.orderUpdate, undefined);
});

test("payment.failed/expired/voided/refunded all map to a 'failed' outcome", async () => {
  for (const event of ["payment.failed", "payment.expired", "payment.voided", "payment.refunded"]) {
    const { deps, calls } = makeFakeDeps({ kind: "order", id: "order-1", result: { updated: true } });
    await handleDpayWebhook(deps, signedReq(makePayload({ event })));
    assert.deepEqual(calls.finalizeArgs, { ref: "order:order-1", outcome: "failed" }, `event ${event} should map to 'failed'`);
  }
});

test("when finalizeByMerchantReference finds nothing (unknown/stale reference), still acknowledges 200 rather than erroring", async () => {
  const { deps } = makeFakeDeps(null);
  const res = await handleDpayWebhook(deps, signedReq(makePayload()));
  assert.equal(res.status, 200);
});

test("a duplicate/retried delivery (finalize is a safe no-op the second time) still acknowledges 200", async () => {
  const { deps } = makeFakeDeps({ kind: "order", id: "order-1", result: { updated: false } });
  const res = await handleDpayWebhook(deps, signedReq(makePayload()));
  assert.equal(res.status, 200);
});

test("if finalizing throws, returns 500 so DPay retries — never silently swallowed", async () => {
  const { deps } = makeFakeDeps();
  deps.finalizeByMerchantReference = async () => {
    throw new Error("db down");
  };
  const res = await handleDpayWebhook(deps, signedReq(makePayload()));
  assert.equal(res.status, 500);
});
