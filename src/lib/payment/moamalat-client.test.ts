import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  centsToMoamalatAmount,
  moamalatAmountToCents,
  buildLightboxConfig,
  verifyMoamalatResponseHash,
  makeOrderReference,
  makeSubscriptionReference,
  parseMerchantReference,
} from "./moamalat-client";

// Moamalat's AmountTrxn is 10x this app's LYD-cents convention (their docs:
// "1 Libyan dinar should be 1000"). Getting this conversion wrong either
// overcharges or undercharges a real customer by 10x.
test("centsToMoamalatAmount / moamalatAmountToCents round-trip on a whole conversion", () => {
  assert.equal(centsToMoamalatAmount(10000), 100000); // 100.00 LYD
  assert.equal(moamalatAmountToCents(100000), 10000);
});

test("moamalatAmountToCents rounds rather than truncating a fractional result", () => {
  assert.equal(moamalatAmountToCents(1007), 101); // 100.7 -> rounds to 101
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

test("buildLightboxConfig produces a hash verifyMoamalatResponseHash accepts, and rejects a tampered field", () => {
  process.env.MOAMALAT_MERCHANT_ID = "TESTMID";
  process.env.MOAMALAT_TERMINAL_ID = "TESTTID";
  // Must be valid hex — computeSecureHash hex-decodes it as the HMAC key.
  process.env.MOAMALAT_SECRET_KEY = crypto.randomBytes(16).toString("hex");

  const config = buildLightboxConfig(5000, "order:test-order-1");

  const fieldsBack = {
    Amount: String(config.AmountTrxn),
    DateTimeLocalTrxn: config.TrxDateTime,
    MerchantId: config.MID,
    MerchantReference: config.MerchantReference,
    TerminalId: config.TID,
  };
  assert.equal(verifyMoamalatResponseHash(fieldsBack, config.SecureHash), true);

  // Same hash, but a field value was altered in transit/tampered — must
  // fail, not silently accept a mismatched amount.
  const tampered = { ...fieldsBack, Amount: String(config.AmountTrxn + 1) };
  assert.equal(verifyMoamalatResponseHash(tampered, config.SecureHash), false);

  delete process.env.MOAMALAT_MERCHANT_ID;
  delete process.env.MOAMALAT_TERMINAL_ID;
  delete process.env.MOAMALAT_SECRET_KEY;
});

test("verifyMoamalatResponseHash fails closed when the secret key isn't configured", () => {
  delete process.env.MOAMALAT_SECRET_KEY;
  assert.equal(verifyMoamalatResponseHash({ Amount: "100" }, "ANYHASH"), false);
});

test("verifyMoamalatResponseHash fails closed when no hash was received", () => {
  process.env.MOAMALAT_SECRET_KEY = crypto.randomBytes(16).toString("hex");
  assert.equal(verifyMoamalatResponseHash({ Amount: "100" }, undefined), false);
  delete process.env.MOAMALAT_SECRET_KEY;
});
