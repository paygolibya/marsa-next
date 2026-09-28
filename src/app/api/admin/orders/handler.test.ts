import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListOrders, type ListOrdersDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(url: string) {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` } });
}

function noTokenReq(url: string) {
  return new Request(url);
}

function makeFakeDb(all: { id: string; createdAt: Date; store: unknown }[]) {
  const calls: { findManyArgs?: unknown } = {};
  const db: ListOrdersDb = {
    order: {
      findMany: async (args) => {
        calls.findManyArgs = args;
        const startIndex = args.cursor ? all.findIndex((o) => o.id === args.cursor!.id) + (args.skip ?? 0) : 0;
        return all.slice(startIndex, startIndex + args.take);
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const { db } = makeFakeDb([]);
  const res = await handleListOrders(db, noTokenReq("http://localhost/api/admin/orders"));
  assert.equal(res.status, 403);
});

test("returns nextCursor as null when fewer orders exist than a full page", async () => {
  const all = [{ id: "o1", createdAt: new Date(), store: {} }];
  const { db } = makeFakeDb(all);
  const res = await handleListOrders(db, adminReq("http://localhost/api/admin/orders"));
  const body = await res.json();
  assert.equal(body.orders.length, 1);
  assert.equal(body.nextCursor, null);
});

test("returns a real nextCursor when a full page (50) comes back", async () => {
  const all = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}`, createdAt: new Date(), store: {} }));
  const { db } = makeFakeDb(all);
  const res = await handleListOrders(db, adminReq("http://localhost/api/admin/orders"));
  const body = await res.json();
  assert.equal(body.orders.length, 50);
  assert.equal(body.nextCursor, "o49");
});

test("a cursor query resumes after that order, not from the start", async () => {
  const all = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, createdAt: new Date(), store: {} }));
  const { db, calls } = makeFakeDb(all);
  await handleListOrders(db, adminReq("http://localhost/api/admin/orders?cursor=o2"));
  assert.deepEqual((calls.findManyArgs as any).cursor, { id: "o2" });
  assert.equal((calls.findManyArgs as any).skip, 1);
});
