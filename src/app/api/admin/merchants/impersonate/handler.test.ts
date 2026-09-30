import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleImpersonateMerchant, type ImpersonateMerchantDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/impersonate", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/impersonate", { method: "POST", body: JSON.stringify(body) });
}

const targetMerchant = {
  id: "merchant-1",
  name: "Test Merchant",
  phone: "0912345678",
  subscriptionTier: "basic",
  subscriptionStatus: "pending",
  phoneVerified: false,
  subscriptionEndDate: null,
  trialEndsAt: null,
};

function makeFakeDb(opts: { merchant?: (typeof targetMerchant & { stores: { id: string }[] }) | null }) {
  const calls: { create?: unknown } = {};
  const db: ImpersonateMerchantDb = {
    merchant: {
      findUnique: async (args) => (opts.merchant && opts.merchant.id === args.where.id ? opts.merchant : null),
    },
    impersonationSession: {
      create: async (args) => {
        calls.create = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403, before touching the database", async () => {
  const { db, calls } = makeFakeDb({});
  const res = await handleImpersonateMerchant(db, noTokenReq({ merchantId: "merchant-1" }));
  assert.equal(res.status, 403);
  assert.equal(calls.create, undefined);
});

test("returns 404 for a merchant that doesn't exist", async () => {
  const { db, calls } = makeFakeDb({ merchant: null });
  const res = await handleImpersonateMerchant(db, adminReq({ merchantId: "merchant-1" }));
  assert.equal(res.status, 404);
  assert.equal(calls.create, undefined);
});

test("logs a real audit row scoped to the admin, target merchant, and their first store", async () => {
  const { db, calls } = makeFakeDb({ merchant: { ...targetMerchant, stores: [{ id: "store-1" }, { id: "store-2" }] } });
  const res = await handleImpersonateMerchant(db, adminReq({ merchantId: "merchant-1" }));
  assert.equal(res.status, 200);
  const create = calls.create as { data: { adminId: string; merchantId: string; storeId: string | null } };
  assert.equal(create.data.adminId, "admin-1");
  assert.equal(create.data.merchantId, "merchant-1");
  assert.equal(create.data.storeId, "store-1"); // the first store, not all of them
});

test("logs storeId: null for a merchant with no stores yet — a valid, expected case (mid-onboarding)", async () => {
  const { db, calls } = makeFakeDb({ merchant: { ...targetMerchant, stores: [] } });
  await handleImpersonateMerchant(db, adminReq({ merchantId: "merchant-1" }));
  assert.equal((calls.create as any).data.storeId, null);
});

test("returns a real token that decodes to the target merchant's id, marked with who impersonated them", async () => {
  const { db } = makeFakeDb({ merchant: { ...targetMerchant, stores: [] } });
  const res = await handleImpersonateMerchant(db, adminReq({ merchantId: "merchant-1" }));
  const body = await res.json();
  const payload = jwt.verify(body.token, process.env.JWT_SECRET!) as { merchantId: string; impersonatedBy: string };
  assert.equal(payload.merchantId, "merchant-1");
  assert.equal(payload.impersonatedBy, "admin-1");
});

test("returns the target merchant's own real data (not the admin's), via the standard toMerchantDTO shape", async () => {
  const { db } = makeFakeDb({ merchant: { ...targetMerchant, stores: [] } });
  const res = await handleImpersonateMerchant(db, adminReq({ merchantId: "merchant-1" }));
  const body = await res.json();
  assert.equal(body.merchant.id, "merchant-1");
  assert.equal(body.merchant.name, "Test Merchant");
  assert.equal(body.merchant.subscriptionStatus, "pending");
});
