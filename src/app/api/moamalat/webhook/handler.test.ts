import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { handleMoamalatWebhook, type MoamalatWebhookDeps } from "./handler";

const SECRET = crypto.randomBytes(16).toString("hex");
process.env.MOAMALAT_MERCHANT_ID = "TESTMID";
process.env.MOAMALAT_TERMINAL_ID = "TESTTID";
process.env.MOAMALAT_SECRET_KEY = SECRET;

function req(body: unknown) {
  return new Request("http://localhost/api/moamalat/webhook", { method: "POST", body: JSON.stringify(body) });
}

// Same HMAC recipe as moamalat-client.ts's own (private) computeSecureHash
// — sort field names alphabetically, join "name=value" pairs with "&",
// HMAC-SHA256 with the hex-decoded secret, uppercase hex. Deliberately
// NOT reusing buildLightboxConfig here: that signs a DIFFERENT field set
// (includes MerchantReference, omits Currency) — the request-signing hash
// and the notification-verification hash cover different fields per
// Moamalat's docs, so a hash valid for one is NOT valid for the other.
function signNotificationFields(fields: Record<string, string>): string {
  const message = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${fields[k]}`)
    .join("&");
  return crypto.createHmac("sha256", Buffer.from(SECRET, "hex")).update(message, "utf8").digest("hex").toUpperCase();
}

function makeValidNotification(overrides: Record<string, unknown> = {}) {
  const base = { MerchantId: "TESTMID", TerminalId: "TESTTID", DateTimeLocalTrxn: "202601010000", Amount: "100000", Currency: "434" };
  const SecureHash = signNotificationFields(base);
  return { ...base, MerchantReference: "order:order-1", SecureHash, SystemReference: "SYS-1", NetworkReference: "NET-1", ...overrides };
}

function makeFakeDeps(finalizeResult: Awaited<ReturnType<MoamalatWebhookDeps["finalizeByMerchantReference"]>> = null) {
  const calls: { orderUpdate?: unknown; paymentUpdate?: unknown; finalizeArgs?: unknown } = {};
  const deps: MoamalatWebhookDeps = {
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

test("rejects invalid JSON with 400", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleMoamalatWebhook(
    deps,
    new Request("http://localhost/api/moamalat/webhook", { method: "POST", body: "not json" })
  );
  assert.equal(res.status, 400);
});

test("rejects a notification missing required fields with 400, before any signature check", async () => {
  const { deps } = makeFakeDeps();
  const res = await handleMoamalatWebhook(deps, req({ MerchantId: "X" }));
  assert.equal(res.status, 400);
});

test("rejects a notification with a tampered/invalid SecureHash with 401 — this IS the security boundary", async () => {
  const { deps, calls } = makeFakeDeps();
  const notification = makeValidNotification({ Amount: 999999 }); // amount changed after signing
  const res = await handleMoamalatWebhook(deps, req(notification));
  assert.equal(res.status, 401);
  assert.equal(calls.finalizeArgs, undefined, "must never finalize a payment on an unverified notification");
});

test("acknowledges (200) a validly-signed notification with no MerchantReference, without finalizing anything", async () => {
  const { deps, calls } = makeFakeDeps();
  const res = await handleMoamalatWebhook(deps, req(makeValidNotification({ MerchantReference: undefined })));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.Success, true);
  assert.equal(calls.finalizeArgs, undefined);
});

test("a valid order-payment notification finalizes as 'paid' and records both Moamalat references on the order", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "order", id: "order-1", result: { updated: true } });
  const res = await handleMoamalatWebhook(deps, req(makeValidNotification()));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.finalizeArgs, { ref: "order:order-1", outcome: "paid" });
  const orderUpdate = calls.orderUpdate as { where: { id: string }; data: { moamalatSystemReference: string; moamalatNetworkReference: string } };
  assert.equal(orderUpdate.where.id, "order-1");
  assert.equal(orderUpdate.data.moamalatSystemReference, "SYS-1");
  assert.equal(orderUpdate.data.moamalatNetworkReference, "NET-1");
  assert.equal(calls.paymentUpdate, undefined); // an order, not a subscription payment
});

test("a valid subscription-payment notification updates the Payment row, not an Order", async () => {
  const { deps, calls } = makeFakeDeps({ kind: "subscription", id: "payment-1", result: { updated: true } });
  const notification = makeValidNotification({ MerchantReference: "sub:payment-1" });
  await handleMoamalatWebhook(deps, req(notification));
  const paymentUpdate = calls.paymentUpdate as { where: { id: string } };
  assert.equal(paymentUpdate.where.id, "payment-1");
  assert.equal(calls.orderUpdate, undefined);
});

test("when finalizeByMerchantReference finds nothing (unknown/stale reference), still acknowledges 200 rather than erroring", async () => {
  const { deps } = makeFakeDeps(null);
  const res = await handleMoamalatWebhook(deps, req(makeValidNotification()));
  assert.equal(res.status, 200);
});

test("if finalizing throws, returns 500 so Moamalat retries — never silently swallowed", async () => {
  const { deps } = makeFakeDeps();
  deps.finalizeByMerchantReference = async () => {
    throw new Error("db down");
  };
  const res = await handleMoamalatWebhook(deps, req(makeValidNotification()));
  assert.equal(res.status, 500);
});
