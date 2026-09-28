import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleAcceptMerchant, type AcceptMerchantDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/accept", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/accept", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb(existing: { subscriptionTier: string } | null) {
  const calls: { update?: unknown } = {};
  const db: AcceptMerchantDb = {
    merchant: {
      findUnique: async () => existing,
      update: async (args) => {
        calls.update = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const { db } = makeFakeDb({ subscriptionTier: "basic" });
  const res = await handleAcceptMerchant(db, noTokenReq({ merchantId: "m1" }));
  assert.equal(res.status, 403);
});

test("returns 404 for a merchant that doesn't exist", async () => {
  const { db, calls } = makeFakeDb(null);
  const res = await handleAcceptMerchant(db, adminReq({ merchantId: "m1" }));
  assert.equal(res.status, 404);
  assert.equal(calls.update, undefined);
});

test("activates the merchant with an explicitly chosen tier", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  const res = await handleAcceptMerchant(db, adminReq({ merchantId: "m1", tier: "professional" }));
  assert.equal(res.status, 200);
  const update = calls.update as { data: { subscriptionTier: string; subscriptionStatus: string } };
  assert.equal(update.data.subscriptionTier, "professional");
  assert.equal(update.data.subscriptionStatus, "active");
});

test("keeps the merchant's existing tier when the admin doesn't specify one, instead of resetting to basic", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "advanced" });
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1" }));
  const update = calls.update as { data: { subscriptionTier: string } };
  assert.equal(update.data.subscriptionTier, "advanced");
});

test("rejects an unrecognized tier by normalizing it to basic, rather than storing garbage", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1", tier: "made-up-tier" }));
  const update = calls.update as { data: { subscriptionTier: string } };
  assert.equal(update.data.subscriptionTier, "basic");
});

test("grants the full feature-flag set on activation", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1" }));
  const update = calls.update as { data: { codEnabled: boolean; dpayEnabled: boolean } };
  assert.equal(update.data.codEnabled, true);
  assert.equal(update.data.dpayEnabled, true);
});

// The actual bug found while auditing this route for test coverage: it
// used to grant a flat 30 days regardless of what period the admin meant
// to approve (e.g. after reviewing a bank-transfer receipt for a real
// paid period) — the same class of bug already fixed once in
// admin/payments/[id]/approve/handler.ts. These are the regression tests.
test("defaults to a real 1 calendar month, not a flat 30 days, when no periodMonths is given", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  const before = new Date();
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1" }));
  const update = calls.update as { data: { subscriptionEndDate: Date; subscriptionPeriodMonths: number } };
  const expected = new Date(before);
  expected.setMonth(expected.getMonth() + 1);
  assert.ok(
    Math.abs(update.data.subscriptionEndDate.getTime() - expected.getTime()) < 5000,
    `expected ~${expected.toISOString()}, got ${update.data.subscriptionEndDate.toISOString()}`
  );
  assert.equal(update.data.subscriptionPeriodMonths, 1);
});

test("grants a real 12 calendar months when the admin picks periodMonths: 12 — the actual bug this test catches", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1", periodMonths: 12 }));
  const update = calls.update as { data: { subscriptionEndDate: Date; subscriptionPeriodMonths: number } };
  const daysGranted = (update.data.subscriptionEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(daysGranted > 300, `expected ~365 days for a 12-month period, got ${daysGranted.toFixed(0)}`);
  assert.equal(update.data.subscriptionPeriodMonths, 12);
});

test("grants a real 3 calendar months when the admin picks periodMonths: 3", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1", periodMonths: 3 }));
  const update = calls.update as { data: { subscriptionPeriodMonths: number } };
  assert.equal(update.data.subscriptionPeriodMonths, 3);
});

test("rejects an unrecognized periodMonths value by falling back to 1, rather than storing garbage", async () => {
  const { db, calls } = makeFakeDb({ subscriptionTier: "basic" });
  await handleAcceptMerchant(db, adminReq({ merchantId: "m1", periodMonths: 7 }));
  const update = calls.update as { data: { subscriptionPeriodMonths: number } };
  assert.equal(update.data.subscriptionPeriodMonths, 1);
});
