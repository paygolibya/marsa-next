import test from "node:test";
import assert from "node:assert/strict";
import { resolveCouponDiscount, type CouponLike } from "./coupons";

function makeCoupon(overrides: Partial<CouponLike> = {}): CouponLike {
  return {
    active: true,
    discountType: "percent",
    discountValue: 10,
    minOrderCents: null,
    maxUsage: null,
    usageCount: 0,
    expiresAt: null,
    ...overrides,
  };
}

test("an inactive coupon is rejected regardless of other fields", () => {
  const result = resolveCouponDiscount(makeCoupon({ active: false }), 10000);
  assert.equal(result.valid, false);
  assert.equal(result.discountCents, 0);
});

test("an expired coupon is rejected", () => {
  const result = resolveCouponDiscount(makeCoupon({ expiresAt: new Date(Date.now() - 1000) }), 10000);
  assert.equal(result.valid, false);
});

test("a coupon at its usage limit is rejected", () => {
  const result = resolveCouponDiscount(makeCoupon({ maxUsage: 5, usageCount: 5 }), 10000);
  assert.equal(result.valid, false);
});

test("an order below the coupon's minimum is rejected", () => {
  const result = resolveCouponDiscount(makeCoupon({ minOrderCents: 20000 }), 10000);
  assert.equal(result.valid, false);
});

test("a percent coupon computes a rounded discount off the subtotal", () => {
  // 10% of 9999 cents = 999.9, must round to 1000, not truncate to 999.
  const result = resolveCouponDiscount(makeCoupon({ discountType: "percent", discountValue: 10 }), 9999);
  assert.equal(result.valid, true);
  assert.equal(result.discountCents, 1000);
});

test("a fixed coupon discounts the flat amount, uncapped by percent math", () => {
  const result = resolveCouponDiscount(makeCoupon({ discountType: "fixed", discountValue: 2500 }), 10000);
  assert.equal(result.valid, true);
  assert.equal(result.discountCents, 2500);
});

test("a fixed discount larger than the subtotal is clamped, never a negative total", () => {
  const result = resolveCouponDiscount(makeCoupon({ discountType: "fixed", discountValue: 50000 }), 10000);
  assert.equal(result.valid, true);
  assert.equal(result.discountCents, 10000);
});
