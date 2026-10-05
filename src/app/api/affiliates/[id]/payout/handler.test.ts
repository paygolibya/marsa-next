import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateAffiliatePayout, type AffiliatePayoutDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: {
  affiliate?: { id: string; storeId: string } | null;
  ownedStoreId?: string;
  pending?: { id: string; commissionCents: number }[];
}) {
  const calls: Record<string, unknown> = {};
  const db: AffiliatePayoutDb = {
    affiliate: { findUnique: async (args) => (opts.affiliate && opts.affiliate.id === args.where.id ? opts.affiliate : null) },
    store: { findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null) },
    affiliateCommission: { findMany: async () => opts.pending ?? [] },
    $transaction: async (fn: (tx: unknown) => unknown) => {
      const tx = {
        affiliatePayout: {
          create: async (args: { data: { affiliateId: string; amountCents: number } }) => {
            calls.payoutCreate = args;
            return { id: "payout-1", affiliateId: args.data.affiliateId, amountCents: args.data.amountCents, status: "transferred", createdAt: new Date() };
          },
        },
        affiliateCommission: {
          updateMany: async (args: unknown) => {
            calls.commissionUpdateMany = args;
            return {};
          },
        },
      };
      return fn(tx);
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleCreateAffiliatePayout(db, new Request("http://localhost/x", { method: "POST" }), "affiliate-1");
  assert.equal(res.status, 401);
});

test("rejects an affiliate belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleCreateAffiliatePayout(db, authReq("http://localhost/x", { method: "POST" }), "affiliate-1");
  assert.equal(res.status, 403);
  assert.equal(calls.payoutCreate, undefined);
});

test("rejects with 400 when there are no pending commissions to pay out", async () => {
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "store-1", pending: [] });
  const res = await handleCreateAffiliatePayout(db, authReq("http://localhost/x", { method: "POST" }), "affiliate-1");
  assert.equal(res.status, 400);
  assert.equal(calls.payoutCreate, undefined);
});

test("creates a payout for the sum of pending commissions and marks them paid, in one transaction", async () => {
  const pending = [
    { id: "commission-1", commissionCents: 500 },
    { id: "commission-2", commissionCents: 300 },
  ];
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "store-1", pending });
  const res = await handleCreateAffiliatePayout(db, authReq("http://localhost/x", { method: "POST" }), "affiliate-1");
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.amountCents, 800);

  const payoutCreate = calls.payoutCreate as { data: { amountCents: number; status: string } };
  assert.equal(payoutCreate.data.amountCents, 800);
  assert.equal(payoutCreate.data.status, "transferred");

  const commissionUpdate = calls.commissionUpdateMany as { where: { id: { in: string[] } }; data: { status: string; payoutId: string } };
  assert.deepEqual(commissionUpdate.where.id.in.sort(), ["commission-1", "commission-2"]);
  assert.equal(commissionUpdate.data.status, "paid");
  assert.equal(commissionUpdate.data.payoutId, "payout-1");
});
