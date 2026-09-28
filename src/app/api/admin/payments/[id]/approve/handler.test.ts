import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleApprovePayment, type ApprovePaymentDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq() {
  return new Request("http://localhost/api/admin/payments/payment-1/approve", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

// Deliberately "no token at all" rather than "a real non-admin merchant
// token" — isAdminMerchantId falls back to a real (unmocked)
// prisma.merchant.findUnique for any merchantId not in the env allowlist,
// which would either hit the real production DB or, in CI (no real
// Postgres at all), throw a connection error and break the test suite. A
// missing/invalid token short-circuits to `false` before that DB call, so
// this still genuinely exercises the "not authorized" branch without
// depending on a real database.
function noTokenReq() {
  return new Request("http://localhost/api/admin/payments/payment-1/approve", { method: "POST" });
}

function makeFakeDb(payment: { id: string; merchantId: string; tier: string; periodMonths: number }) {
  const calls: { paymentUpdate?: any; merchantUpdate?: any } = {};
  const db: ApprovePaymentDb = {
    payment: {
      update: async (args) => {
        calls.paymentUpdate = args;
        return payment;
      },
    },
    merchant: {
      update: async (args) => {
        calls.merchantUpdate = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 403, before touching the database", async () => {
  const { db } = makeFakeDb({ id: "payment-1", merchantId: "merchant-1", tier: "standard", periodMonths: 1 });
  const res = await handleApprovePayment(db, noTokenReq(), "payment-1");
  assert.equal(res.status, 403);
});

test("a 1-month payment activates the merchant for 1 real calendar month, not a flat 30 days", async () => {
  const { db, calls } = makeFakeDb({ id: "payment-1", merchantId: "merchant-1", tier: "standard", periodMonths: 1 });
  const before = new Date();
  const res = await handleApprovePayment(db, adminReq(), "payment-1");
  assert.equal(res.status, 200);

  const end = new Date(calls.merchantUpdate.data.subscriptionEndDate);
  const expected = new Date(before);
  expected.setMonth(expected.getMonth() + 1);
  // Within a few seconds of the expected calendar-month date — not
  // comparing to a flat +30-days value, which would drift from this by
  // several days depending on the month.
  assert.ok(Math.abs(end.getTime() - expected.getTime()) < 5000, `expected ~${expected.toISOString()}, got ${end.toISOString()}`);
});

test("a 12-month payment grants a full 12 calendar months, not the old hardcoded 30 days — the actual bug this test caught", async () => {
  const { db, calls } = makeFakeDb({ id: "payment-1", merchantId: "merchant-1", tier: "standard", periodMonths: 12 });
  const res = await handleApprovePayment(db, adminReq(), "payment-1");
  assert.equal(res.status, 200);

  const end = new Date(calls.merchantUpdate.data.subscriptionEndDate);
  const daysGranted = (end.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  // A flat 30-day grant would be ~30 days; 12 real months is ~365. Assert
  // it's nowhere near 30 — this is the exact bug that shortchanged anyone
  // manually approved for a 3- or 12-month plan.
  assert.ok(daysGranted > 300, `expected ~365 days for a 12-month plan, got ${daysGranted.toFixed(0)}`);
  assert.equal(calls.merchantUpdate.data.subscriptionPeriodMonths, 12);
});

test("activates the subscription with the payment's own tier and marks it active", async () => {
  const { db, calls } = makeFakeDb({ id: "payment-1", merchantId: "merchant-42", tier: "standard", periodMonths: 3 });
  await handleApprovePayment(db, adminReq(), "payment-1");
  assert.equal(calls.merchantUpdate.where.id, "merchant-42");
  assert.equal(calls.merchantUpdate.data.subscriptionTier, "standard");
  assert.equal(calls.merchantUpdate.data.subscriptionStatus, "active");
  assert.equal(calls.paymentUpdate.data.status, "approved");
  assert.equal(calls.paymentUpdate.data.approvedBy, "admin-1");
});
