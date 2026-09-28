import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleTransferPayout, type TransferPayoutDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(body: unknown) {
  return new Request("http://localhost/api/admin/payouts/transfer", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function makeFakeDb(payout: { id: string; status: string; transferReference: string | null; note: string | null } | null) {
  const calls: { payoutUpdate?: any; commissionUpdateMany?: any; orderUpdateMany?: any } = {};
  const db: TransferPayoutDb = {
    payout: {
      findUnique: async () => payout,
      update: (args) => {
        calls.payoutUpdate = args;
        return Promise.resolve({ id: payout?.id, ...args.data });
      },
    },
    commission: {
      updateMany: (args) => {
        calls.commissionUpdateMany = args;
        return Promise.resolve({ count: 3 });
      },
    },
    order: {
      updateMany: (args) => {
        calls.orderUpdateMany = args;
        return Promise.resolve({ count: 5 });
      },
    },
    $transaction: (ops) => Promise.all(ops),
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 403, before touching the database", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleTransferPayout(db, new Request("http://localhost/x", { method: "POST", body: "{}" }));
  assert.equal(res.status, 403);
});

test("rejects a malformed body with 400", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleTransferPayout(db, adminReq({}));
  assert.equal(res.status, 400);
});

test("returns 404 when the payout doesn't exist", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleTransferPayout(db, adminReq({ payoutId: "payout-1" }));
  assert.equal(res.status, 404);
});

test("rejects a second transfer of the same payout with 409 — the actual money-safety guard", async () => {
  const { db, calls } = makeFakeDb({ id: "payout-1", status: "transferred", transferReference: "REF-OLD", note: null });
  const res = await handleTransferPayout(db, adminReq({ payoutId: "payout-1" }));
  assert.equal(res.status, 409);
  assert.equal(calls.payoutUpdate, undefined, "must never re-run the transaction on an already-transferred payout");
});

test("a successful transfer updates all three: the payout itself, every one of its commissions, and every affected order", async () => {
  const { db, calls } = makeFakeDb({ id: "payout-1", status: "ready_for_transfer", transferReference: null, note: null });
  const res = await handleTransferPayout(db, adminReq({ payoutId: "payout-1", transferReference: "BANK-REF-123", note: "paid via wire" }));
  assert.equal(res.status, 200);

  assert.equal(calls.payoutUpdate.where.id, "payout-1");
  assert.equal(calls.payoutUpdate.data.status, "transferred");
  assert.equal(calls.payoutUpdate.data.transferredBy, "admin-1");
  assert.equal(calls.payoutUpdate.data.transferReference, "BANK-REF-123");

  assert.deepEqual(calls.commissionUpdateMany.where, { payoutId: "payout-1" });
  assert.equal(calls.commissionUpdateMany.data.status, "paid");

  assert.deepEqual(calls.orderUpdateMany.where, { commission: { payoutId: "payout-1" } });
  assert.equal(calls.orderUpdateMany.data.payoutStatus, "transferred");
});

test("an omitted transferReference/note keeps the payout's existing values rather than clearing them", async () => {
  const { db, calls } = makeFakeDb({ id: "payout-1", status: "ready_for_transfer", transferReference: "OLD-REF", note: "old note" });
  await handleTransferPayout(db, adminReq({ payoutId: "payout-1" }));
  assert.equal(calls.payoutUpdate.data.transferReference, "OLD-REF");
  assert.equal(calls.payoutUpdate.data.note, "old note");
});
