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
