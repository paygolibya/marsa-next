import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleSubscriptionPricing, type SubscriptionPricingDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId?: string) {
  const headers = new Headers();
  if (merchantId) headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request("http://localhost/api/payments/subscription-pricing", { headers });
}

function db(approved: number): SubscriptionPricingDb {
  return { payment: { count: async () => approved } };
}

test("rejects an unauthenticated request with 401", async () => {
  const res = await handleSubscriptionPricing(db(0), req());
  assert.equal(res.status, 401);
});

test("a merchant with no approved payment yet is eligible for 75 LYD off", async () => {
  const body = await (await handleSubscriptionPricing(db(0), req("m1"))).json();
  assert.deepEqual(body, { firstPaymentDiscountEligible: true, discountLYD: 75 });
});

test("a merchant who has already paid once is not eligible", async () => {
  const body = await (await handleSubscriptionPricing(db(2), req("m1"))).json();
  assert.deepEqual(body, { firstPaymentDiscountEligible: false, discountLYD: 0 });
});
