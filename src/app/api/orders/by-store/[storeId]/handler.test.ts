import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleOrdersByStore, type OrdersByStoreDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/orders/by-store/store-1", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/orders/by-store/store-1");
}

function makeFakeDb(opts: { ownedStoreId?: string; orders?: { id: string; createdAt: Date; items: unknown[] }[] }) {
  const calls: { orderWhere?: unknown } = {};
  const db: OrdersByStoreDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    order: {
      findMany: async (args) => {
        calls.orderWhere = args.where;
        return opts.orders ?? [];
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleOrdersByStore(db, noTokenReq(), "store-1");
  assert.equal(res.status, 401);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleOrdersByStore(db, req(), "store-1");
  assert.equal(res.status, 403);
});

test("returns the owned store's orders, scoped by the resolved store id", async () => {
  const orders = [{ id: "o1", createdAt: new Date(), items: [] }];
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", orders });
  const res = await handleOrdersByStore(db, req(), "store-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.deepEqual(calls.orderWhere, { storeId: "store-1" });
});
