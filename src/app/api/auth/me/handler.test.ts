import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleMe, type AuthMeDeps } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/auth/me", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/auth/me");
}

const merchant = {
  id: "merchant-1",
  name: "Test",
  phone: "0912345678",
  subscriptionTier: "basic",
  subscriptionStatus: "active",
  phoneVerified: true,
};

function makeFakeDeps(merchantRow: typeof merchant | null) {
  const calls: { expireIfLapsedCalledWith?: string } = {};
  const deps: AuthMeDeps = {
    db: { merchant: { findUnique: async () => merchantRow } },
    expireIfLapsed: async (merchantId) => {
      calls.expireIfLapsedCalledWith = merchantId;
      return false;
    },
  };
  return { deps, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { deps } = makeFakeDeps(merchant);
  const res = await handleMe(deps, noTokenReq());
  assert.equal(res.status, 401);
});

test("returns 404 when the merchant doesn't exist", async () => {
  const { deps } = makeFakeDeps(null);
  const res = await handleMe(deps, req());
  assert.equal(res.status, 404);
});

test("triggers the lazy subscription-expiry check before reading the merchant back", async () => {
  const { deps, calls } = makeFakeDeps(merchant);
  await handleMe(deps, req("merchant-77"));
  assert.equal(calls.expireIfLapsedCalledWith, "merchant-77");
});

test("returns the merchant's current record", async () => {
  const { deps } = makeFakeDeps(merchant);
  const res = await handleMe(deps, req());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.merchant.id, "merchant-1");
});
