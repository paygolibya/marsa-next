import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleRefund, type RefundDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

type FakeOrder = NonNullable<Awaited<ReturnType<RefundDb["order"]["findFirst"]>>>;

function authHeader(merchantId: string) {
  return { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` };
}

function req(body: unknown, merchantId: string | null) {
  return new Request("http://localhost/api/orders/order-1/refund", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(merchantId ? authHeader(merchantId) : {}) },
    body: JSON.stringify(body),
  });
}

// A fake implementing exactly the RefundDb surface — this is what makes
// this an integration test of the ROUTE's own logic (which methods it
// calls, with what arguments, in what order, mapped to what response) as
// opposed to the pure-function unit tests elsewhere: it exercises the real
// handleRefund code path end to end, just against a fake instead of a real
// Postgres connection.
function makeFakeDb(order: FakeOrder | null) {
  const calls: { orderUpdate?: unknown; commissionUpdate?: unknown } = {};
  const db: RefundDb = {
    order: {
      findFirst: async (args) => {
        if (!order) return null;
        // Verify the route actually scopes the lookup by the authenticated
        // merchant — a bug here (e.g. forgetting the store.merchantId
        // filter) would let a merchant refund another store's order.
        assert.equal(args.where.id, "order-1");
        assert.ok(args.where.store.merchantId, "must filter by the authenticated merchant's ownership");
        return order;
      },
    },
    $transaction: async (fn) => {
      await fn({
        order: {
          update: async (args) => {
            calls.orderUpdate = args;
            return {};
          },
        },
        commission: {
          update: async (args) => {
            calls.commissionUpdate = args;
            return {};
          },
        },
      });
    },
  };
  return { db, calls };
}

test("rejects with 401 when there is no auth token at all", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleRefund(db, req({}, null), "order-1");
  assert.equal(res.status, 401);
});

test("returns 403 when no order matches (wrong store, wrong merchant, or doesn't exist)", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleRefund(db, req({}, "merchant-1"), "order-1");
  assert.equal(res.status, 403);
});

test("rejects an already-refunded order with 400, without touching the transaction at all", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "refunded",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 1000,
    commission: null,
    store: { slug: "test-store" },
  });
  const res = await handleRefund(db, req({}, "merchant-1"), "order-1");
  assert.equal(res.status, 400);
  assert.equal(calls.orderUpdate, undefined); // never entered the transaction
});

test("a wallet order with an unbatched commission: order flips to refunded AND the commission is excluded from future payouts", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "delivered",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 10000,
    commission: { id: "comm-1", payoutId: null },
    store: { slug: "test-store" },
  });
  const res = await handleRefund(db, req({ reason: "buyer complaint" }, "merchant-1"), "order-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.note, null); // no clawback note — nothing to warn about

  const orderUpdate = calls.orderUpdate as { where: { id: string }; data: { status: string; refundedAt: Date; refundReason: string } };
  assert.equal(orderUpdate.where.id, "order-1");
  assert.equal(orderUpdate.data.status, "refunded");
  assert.ok(orderUpdate.data.refundedAt instanceof Date);
  assert.equal(orderUpdate.data.refundReason, "buyer complaint");
  assert.deepEqual(calls.commissionUpdate, { where: { id: "comm-1" }, data: { status: "refunded" } });
});

test("a wallet order whose commission is ALREADY batched: order refunds, but the commission is left untouched with a clawback note", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "delivered",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 10000,
    commission: { id: "comm-1", payoutId: "payout-1" },
    store: { slug: "test-store" },
  });
  const res = await handleRefund(db, req({}, "merchant-1"), "order-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.note && body.note.length > 0, "must return a non-empty clawback note");

  assert.ok(calls.orderUpdate, "the order itself must still be marked refunded");
  assert.equal(calls.commissionUpdate, undefined, "an already-batched commission must never be mutated");
});

test("a COD order (no commission at all) refunds cleanly with no clawback note", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "delivered",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 5000,
    commission: null,
    store: { slug: "test-store" },
  });
  const res = await handleRefund(db, req({}, "merchant-1"), "order-1");
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.note, null);
  assert.ok(calls.orderUpdate);
  assert.equal(calls.commissionUpdate, undefined);
});

test("a refund reason longer than 500 chars is truncated before being persisted", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "delivered",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 1000,
    commission: null,
    store: { slug: "test-store" },
  });
  const longReason = "a".repeat(1000);
  await handleRefund(db, req({ reason: longReason }, "merchant-1"), "order-1");
  assert.equal((calls.orderUpdate as { data: { refundReason: string } }).data.refundReason.length, 500);
});
