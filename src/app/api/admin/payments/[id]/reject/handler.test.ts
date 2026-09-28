import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleRejectPayment, type RejectPaymentDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/payments/payment-1/reject", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function makeFakeDb() {
  const calls: { update?: any } = {};
  const db: RejectPaymentDb = {
    payment: {
      update: async (args) => {
        calls.update = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 403, before touching the database", async () => {
  const { db } = makeFakeDb();
  const res = await handleRejectPayment(
    db,
    new Request("http://localhost/api/admin/payments/payment-1/reject", { method: "POST", body: "{}" }),
    "payment-1"
  );
  assert.equal(res.status, 403);
});

test("marks the payment rejected with the given reason", async () => {
  const { db, calls } = makeFakeDb();
  const res = await handleRejectPayment(db, adminReq({ reason: "الإيصال غير واضح" }), "payment-1");
  assert.equal(res.status, 200);
  assert.equal(calls.update.where.id, "payment-1");
  assert.equal(calls.update.data.status, "rejected");
  assert.equal(calls.update.data.rejectionReason, "الإيصال غير واضح");
});
