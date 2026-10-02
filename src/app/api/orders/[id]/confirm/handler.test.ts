import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleConfirmOrder, type ConfirmDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

type FakeOrder = NonNullable<Awaited<ReturnType<ConfirmDb["order"]["findFirst"]>>>;

function authHeader(merchantId: string) {
  return { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` };
}

function req(merchantId: string | null) {
  return new Request("http://localhost/api/orders/order-1/confirm", {
    method: "POST",
    headers: merchantId ? authHeader(merchantId) : {},
  });
}

function makeFakeDb(order: FakeOrder | null) {
  const calls: { orderUpdate?: unknown } = {};
  const db: ConfirmDb = {
    order: {
      findFirst: async (args) => {
        if (!order) return null;
        // Same ownership check as refund — a bug here would let a merchant
        // confirm another store's order.
        assert.equal(args.where.id, "order-1");
        assert.ok(args.where.store.merchantId, "must filter by the authenticated merchant's ownership");
        return order;
      },
      update: async (args) => {
        calls.orderUpdate = args;
        return {};
      },
    },
  };
  return { db, calls };
}

test("rejects with 401 when there is no auth token at all", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleConfirmOrder(db, req(null), "order-1");
  assert.equal(res.status, 401);
});

test("returns 403 when no order matches (wrong store, wrong merchant, or doesn't exist)", async () => {
  const { db } = makeFakeDb(null);
  const res = await handleConfirmOrder(db, req("merchant-1"), "order-1");
  assert.equal(res.status, 403);
});

test("rejects a non-pending order with 400, without updating anything", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "confirmed",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 1000,
    store: { slug: "test-store" },
  });
  const res = await handleConfirmOrder(db, req("merchant-1"), "order-1");
  assert.equal(res.status, 400);
  assert.equal(calls.orderUpdate, undefined);
});

test("confirms a pending order: status flips to confirmed", async () => {
  const { db, calls } = makeFakeDb({
    id: "order-1",
    status: "pending",
    buyerName: "Test",
    buyerEmail: null,
    totalCents: 5000,
    store: { slug: "test-store" },
  });
  const res = await handleConfirmOrder(db, req("merchant-1"), "order-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.deepEqual(calls.orderUpdate, { where: { id: "order-1" }, data: { status: "confirmed" } });
});
