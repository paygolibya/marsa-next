import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleListMerchants, type ListMerchantsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";
process.env.ADMIN_MERCHANT_IDS = "admin-1";

function adminReq(url: string) {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId: "admin-1" }, process.env.JWT_SECRET!)}` } });
}

function noTokenReq(url: string) {
  return new Request(url);
}

function makeFakeDb(all: { id: string; createdAt: Date; stores: unknown[] }[]) {
  const calls: { findManyArgs?: unknown } = {};
  const db: ListMerchantsDb = {
    merchant: {
      findMany: async (args) => {
        calls.findManyArgs = args;
        const startIndex = args.cursor ? all.findIndex((m) => m.id === args.cursor!.id) + (args.skip ?? 0) : 0;
        return all.slice(startIndex, startIndex + args.take);
      },
    },
  };
  return { db, calls };
}

test("rejects a non-admin/unauthenticated request with 403", async () => {
  const { db } = makeFakeDb([]);
  const res = await handleListMerchants(db, noTokenReq("http://localhost/api/admin/merchants"));
  assert.equal(res.status, 403);
});

test("returns nextCursor as null when fewer merchants exist than a full page", async () => {
  const all = [{ id: "m1", createdAt: new Date(), stores: [] }];
  const { db } = makeFakeDb(all);
  const res = await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants"));
  const body = await res.json();
  assert.equal(body.merchants.length, 1);
  assert.equal(body.nextCursor, null);
});

test("returns a real nextCursor (the last row's id) when a full page comes back, so the list can page further", async () => {
  const all = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, createdAt: new Date(), stores: [] }));
  const { db } = makeFakeDb(all);
  const res = await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants"));
  const body = await res.json();
  assert.equal(body.merchants.length, 100);
  assert.equal(body.nextCursor, "m99");
});

test("a cursor query resumes after that merchant, not from the start again", async () => {
  const all = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, createdAt: new Date(), stores: [] }));
  const { db, calls } = makeFakeDb(all);
  await handleListMerchants(db, adminReq("http://localhost/api/admin/merchants?cursor=m2"));
  assert.deepEqual((calls.findManyArgs as any).cursor, { id: "m2" });
  assert.equal((calls.findManyArgs as any).skip, 1);
});
