import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListCustomers, type CustomersDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, merchantId = "merchant-1") {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` } });
}

function makeFakeDb(opts: { ownedStoreId?: string; customers?: unknown[] } = {}) {
  const calls: Record<string, unknown> = {};
  const db: CustomersDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    customer: {
      findMany: async (args) => {
        calls.customerFindMany = args;
        return (opts.customers ?? []) as never;
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListCustomers(db, new Request("http://localhost/api/customers?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListCustomers(db, authReq("http://localhost/api/customers"));
  assert.equal(res.status, 400);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListCustomers(db, authReq("http://localhost/api/customers?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("returns the owned store's customers ordered by total spent, descending", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListCustomers(db, authReq("http://localhost/api/customers?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.customerFindMany as { where: { storeId: string }; orderBy: { totalSpentCents: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
  assert.deepEqual(findMany.orderBy, { totalSpentCents: "desc" });
});
