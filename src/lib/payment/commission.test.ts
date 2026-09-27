import test from "node:test";
import assert from "node:assert/strict";
import { calculateCommission, isOrderEligibleForCommission, COMMISSION_RATE } from "./commission";

test("commission is 1% of the order total, rounded", () => {
  assert.equal(COMMISSION_RATE, 0.01);
  const { rifqaCommissionCents, merchantPayoutCents } = calculateCommission(10000);
  assert.equal(rifqaCommissionCents, 100);
  assert.equal(merchantPayoutCents, 9900);
});

test("commission cents are rounded, not truncated, and always reconcile to the original total", () => {
  // 1% of 12345 = 123.45 -> rounds to 123, payout must be exactly total - commission.
  const { rifqaCommissionCents, merchantPayoutCents } = calculateCommission(12345);
  assert.equal(rifqaCommissionCents, 123);
  assert.equal(rifqaCommissionCents + merchantPayoutCents, 12345);
});

test("a delivered, paid wallet order is eligible for commission", () => {
  assert.equal(isOrderEligibleForCommission({ status: "delivered", paymentMethod: "wallet", paymentStatus: "paid" }), true);
});

test("a COD order is never eligible, even if marked delivered", () => {
  // COD cash is collected by the courier directly — Rifqa never holds it,
  // so paymentStatus never flips to "paid" for COD, but this guards the
  // invariant explicitly rather than relying on that always being true.
  assert.equal(isOrderEligibleForCommission({ status: "delivered", paymentMethod: "cod", paymentStatus: "paid" }), false);
});

test("a wallet order not yet delivered is not eligible", () => {
  assert.equal(isOrderEligibleForCommission({ status: "processing", paymentMethod: "wallet", paymentStatus: "paid" }), false);
});

test("a wallet order that hasn't actually settled is not eligible", () => {
  assert.equal(isOrderEligibleForCommission({ status: "delivered", paymentMethod: "wallet", paymentStatus: "pending" }), false);
});
