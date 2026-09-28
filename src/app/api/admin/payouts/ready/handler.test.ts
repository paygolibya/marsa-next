import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handlePayoutsReady, type PayoutsReadyDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(query = "") {
  return new Request(`http://localhost/api/admin/payouts/ready${query}`, {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` },
  });
}

const ALL_PAYOUTS = [
  { id: "p1", merchantId: "m1", merchant: { name: "Store A" }, periodStart: new Date(), periodEnd: new Date(), orderCount: 5, totalSalesCents: 10000, commissionCents: 100, amountCents: 9900, status: "ready_for_transfer", transferredAt: null, transferredBy: null, transferReference: null, note: null, createdAt: new Date() },
  { id: "p2", merchantId: "m2", merchant: { name: "Store B" }, periodStart: new Date(), periodEnd: new Date(), orderCount: 3, totalSalesCents: 6000, commissionCents: 60, amountCents: 5940, status: "transferred", transferredAt: new Date(), transferredBy: "admin-1", transferReference: "REF", note: null, createdAt: new Date() },
];

function makeFakeDb() {
  const db: PayoutsReadyDb = {
    payout: {
      findManyWithMerchant: async (args) => (args.where ? ALL_PAYOUTS.filter((p) => p.status === args.where!.status) : ALL_PAYOUTS),
      findManyStatsOnly: async () => ALL_PAYOUTS,
    },
  };
  return { db };
}

test("rejects an unauthenticated request with 403, before touching the database", async () => {
  const { db } = makeFakeDb();
  const res = await handlePayoutsReady(db, new Request("http://localhost/x"));
  assert.equal(res.status, 403);
});

test("platform-wide stats always reflect EVERY payout, even when the list itself is filtered by status", async () => {
  // The stats card must not accidentally scope to the same status filter
  // as the list below it — that would silently under-report total sales
  // the moment an admin applies any filter.
  const { db } = makeFakeDb();
  const res = await handlePayoutsReady(db, adminReq("?status=ready_for_transfer"));
  const body = await res.json();
  assert.equal(body.payouts.length, 1); // filtered list: only the ready_for_transfer one
  assert.equal(body.stats.totalSalesCents, 9900 + 100 + (5940 + 60)); // BOTH payouts' amount+commission
  assert.equal(body.stats.totalCommissionCents, 100 + 60);
});

test("pendingPayoutCents/Count count everything NOT transferred, regardless of the list filter", async () => {
  const { db } = makeFakeDb();
  const res = await handlePayoutsReady(db, adminReq());
  const body = await res.json();
  assert.equal(body.stats.pendingPayoutCount, 1); // only p1 ("ready_for_transfer") — p2 is "transferred"
  assert.equal(body.stats.pendingPayoutCents, 9900);
});

test("the payout list is shaped for the client with a flat merchantName, not the nested merchant object", async () => {
  const { db } = makeFakeDb();
  const res = await handlePayoutsReady(db, adminReq());
  const body = await res.json();
  const p1 = body.payouts.find((p: any) => p.id === "p1");
  assert.equal(p1.merchantName, "Store A");
  assert.equal(p1.merchant, undefined);
});
