import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleRejectMerchant, type RejectMerchantDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/reject", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/admin/merchants/reject", { method: "POST", body: JSON.stringify(body) });
}

function makeFakeDb() {
  const calls: { update?: unknown } = {};
  const db: RejectMerchantDb = {
    merchant: {
      update: async (args) => {
        calls.update = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403, before touching the database", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleRejectMerchant(db, noTokenReq({ merchantId: "m1" }));
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("marks the target merchant as rejected and echoes the reason back", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleRejectMerchant(db, adminReq({ merchantId: "m1", reason: "بيانات غير مكتملة" }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.reason, "بيانات غير مكتملة");
  const update = calls.update as { where: { id: string }; data: { subscriptionStatus: string } };
  assert.equal(update.where.id, "m1");
  assert.equal(update.data.subscriptionStatus, "rejected");
});
