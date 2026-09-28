import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleMerchantPayouts, type MerchantPayoutsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/merchant/payouts", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/merchant/payouts");
}

function makeFakeDb(opts: { pendingCents: number | null; payouts: { id: string; status: string; createdAt: Date; amountCents: number }[] }) {
  const calls: { aggregateWhere?: unknown; findManyWhere?: unknown } = {};
  const db: MerchantPayoutsDb = {
    commission: {
      aggregate: async (args) => {
        calls.aggregateWhere = args.where;
        return { _sum: { merchantPayoutCents: opts.pendingCents } };
      },
    },
    payout: {
      findMany: async (args) => {
        calls.findManyWhere = args.where;
        return opts.payouts;
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ pendingCents: 0, payouts: [] });
  const res = await handleMerchantPayouts(db, noTokenReq());
  assert.equal(res.status, 401);
});

test("scopes both queries to the authenticated merchant only", async () => {
  const { db, calls } = makeFakeDb({ pendingCents: 0, payouts: [] });
  await handleMerchantPayouts(db, req("merchant-77"));
  assert.deepEqual(calls.aggregateWhere, { merchantId: "merchant-77", status: "calculated" });
  assert.deepEqual(calls.findManyWhere, { merchantId: "merchant-77" });
});

test("treats no calculated commissions (null sum) as zero pending, not an error", async () => {
  const { db } = makeFakeDb({ pendingCents: null, payouts: [] });
  const res = await handleMerchantPayouts(db, req());
  const body = await res.json();
  assert.equal(body.pendingAmountCents, 0);
});

test("returns the pending sum, commission rate, full history, and the most recent transferred payout as lastPayout", async () => {
  const payouts = [
    { id: "p3", status: "pending", createdAt: new Date("2026-03-01"), amountCents: 5000 },
    { id: "p2", status: "transferred", createdAt: new Date("2026-02-01"), amountCents: 4000 },
    { id: "p1", status: "transferred", createdAt: new Date("2026-01-01"), amountCents: 3000 },
  ];
  const { db } = makeFakeDb({ pendingCents: 12345, payouts });
  const res = await handleMerchantPayouts(db, req());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.pendingAmountCents, 12345);
  assert.ok(typeof body.commissionRate === "number");
  assert.equal(body.history.length, 3);
  // "most recent transferred" — p2, not p1, even though p3 (pending) is first in the list
  assert.equal(body.lastPayout.id, "p2");
});

test("lastPayout is null when nothing has ever been transferred", async () => {
  const payouts = [{ id: "p1", status: "pending", createdAt: new Date(), amountCents: 1000 }];
  const { db } = makeFakeDb({ pendingCents: 1000, payouts });
  const res = await handleMerchantPayouts(db, req());
  const body = await res.json();
  assert.equal(body.lastPayout, null);
});
