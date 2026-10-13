import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateMerchantProfile, type MerchantProfileDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/merchant/profile", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/merchant/profile", { method: "PATCH", body: "{}" });
}

function impersonationReq(body: unknown, merchantId = "merchant-1", adminId = "admin-1") {
  return new Request("http://localhost/api/merchant/profile", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId, impersonatedBy: adminId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function makeFakeDb() {
  const calls: { updateArgs?: unknown } = {};
  const db: MerchantProfileDb = {
    merchant: {
      update: async (args) => {
        calls.updateArgs = args;
        return { id: args.where.id, email: args.data.email };
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleUpdateMerchantProfile(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("rejects an invalid email with 400, never touching the database", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleUpdateMerchantProfile(db, req({ email: "not-an-email" }));
  assert.equal(res.status, 400);
  assert.equal(calls.updateArgs, undefined);
});

test("sets a valid email, scoped to the authenticated merchant only", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleUpdateMerchantProfile(db, req({ email: "merchant@example.com" }, "merchant-77"));
  assert.equal(res.status, 200);
  assert.deepEqual(calls.updateArgs, { where: { id: "merchant-77" }, data: { email: "merchant@example.com" } });
});

test("an empty string clears the email (treated as null), not rejected as invalid", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleUpdateMerchantProfile(db, req({ email: "" }));
  assert.equal(res.status, 200);
  assert.deepEqual((calls.updateArgs as { data: { email: string | null } }).data, { email: null });
});

test("rejects an impersonated session with 403, never touching the database", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleUpdateMerchantProfile(db, impersonationReq({ email: "attacker@example.com" }));
  assert.equal(res.status, 403);
  assert.equal(calls.updateArgs, undefined);
});
