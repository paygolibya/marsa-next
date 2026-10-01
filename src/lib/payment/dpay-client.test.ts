import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  isDpayConfigured,
  isDpayWebhookConfigured,
  verifyDpayWebhookSignature,
  makeOrderReference,
  makeSubscriptionReference,
  parseMerchantReference,
  DPAY_MIN_AMOUNT_CENTS,
} from "./dpay-client";

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const saved = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try {
    fn();
  } finally {
    if (saved === undefined) delete process.env[key];
    else process.env[key] = saved;
  }
}

test("isDpayConfigured reflects whether DPAY_API_TOKEN is set", () => {
  withEnv("DPAY_API_TOKEN", undefined, () => assert.equal(isDpayConfigured(), false));
  withEnv("DPAY_API_TOKEN", "some-token", () => assert.equal(isDpayConfigured(), true));
});

test("DPAY_MIN_AMOUNT_CENTS matches the real API's enforced minimum (5 LYD), not the docs' stated 0.01", () => {
  assert.equal(DPAY_MIN_AMOUNT_CENTS, 500);
});

test("makeOrderReference / makeSubscriptionReference are distinguishable and parse back to the original id", () => {
  const orderRef = makeOrderReference("order_abc123");
  const subRef = makeSubscriptionReference("pay_xyz789");

  assert.deepEqual(parseMerchantReference(orderRef), { kind: "order", id: "order_abc123" });
  assert.deepEqual(parseMerchantReference(subRef), { kind: "subscription", id: "pay_xyz789" });
});

test("parseMerchantReference returns null for a reference in neither known format", () => {
  assert.equal(parseMerchantReference("something-else"), null);
});

function sign(secret: string, timestamp: string, rawBody: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

test("verifyDpayWebhookSignature accepts a correctly-signed, fresh payload and rejects a tampered body", () => {
  withEnv("DPAY_WEBHOOK_SECRET", "test-webhook-secret", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ event: "payment.paid", session_id: 1 });
    const signature = sign("test-webhook-secret", timestamp, rawBody);

    assert.equal(verifyDpayWebhookSignature(timestamp, rawBody, signature), true);
    assert.equal(verifyDpayWebhookSignature(timestamp, rawBody + "tampered", signature), false);
  });
});

test("verifyDpayWebhookSignature rejects a timestamp older than 5 minutes (replay protection)", () => {
  withEnv("DPAY_WEBHOOK_SECRET", "test-webhook-secret", () => {
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 6 * 60);
    const rawBody = JSON.stringify({ event: "payment.paid" });
    const signature = sign("test-webhook-secret", staleTimestamp, rawBody);
    assert.equal(verifyDpayWebhookSignature(staleTimestamp, rawBody, signature), false);
  });
});

test("verifyDpayWebhookSignature fails closed when DPAY_WEBHOOK_SECRET isn't configured — never skips verification", () => {
  withEnv("DPAY_WEBHOOK_SECRET", undefined, () => {
    assert.equal(isDpayWebhookConfigured(), false);
    const timestamp = String(Math.floor(Date.now() / 1000));
    assert.equal(verifyDpayWebhookSignature(timestamp, "{}", "anyhash"), false);
  });
});

test("verifyDpayWebhookSignature fails closed when the timestamp or signature header is missing", () => {
  withEnv("DPAY_WEBHOOK_SECRET", "test-webhook-secret", () => {
    assert.equal(verifyDpayWebhookSignature(null, "{}", "anyhash"), false);
    assert.equal(verifyDpayWebhookSignature(String(Math.floor(Date.now() / 1000)), "{}", null), false);
  });
});

test("verifyDpayWebhookSignature rejects a signature of a different length rather than throwing", () => {
  withEnv("DPAY_WEBHOOK_SECRET", "test-webhook-secret", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    assert.equal(verifyDpayWebhookSignature(timestamp, "{}", "ab"), false);
  });
});
