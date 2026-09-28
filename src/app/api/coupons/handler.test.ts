import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateCoupon, handleListCoupons, type CouponsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; existingCoupon?: { id: string; storeId: string; code: string } } = {}) {
  const calls: Record<string, unknown> = {};
  const db: CouponsDb = {
    store: {
      findFirst: async (args) => {
        calls.storeFindFirst = args;
        return opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null;
      },
    },
    coupon: {
      findUnique: async (args) => {
        calls.couponFindUnique = args;
        return opts.existingCoupon ?? null;
      },
      create: async (args) => {
        calls.couponCreate = args;
        return { id: "coupon-1", storeId: (args.data as any).storeId, code: (args.data as any).code };
      },
      findMany: async (args) => {
        calls.couponFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", code: "save10", discountType: "percent", discountValue: 10 };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateCoupon(db, new Request("http://localhost/api/coupons", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403, before checking anything else", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateCoupon(db, authReq("http://localhost/api/coupons", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.couponCreate, undefined);
});

test("POST rejects a percent discount over 100%", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateCoupon(
    db,
    authReq("http://localhost/api/coupons", { method: "POST", body: JSON.stringify({ ...validBody, discountValue: 150 }) })
  );
  assert.equal(res.status, 400);
  assert.equal(calls.couponCreate, undefined);
});

test("POST rejects a duplicate code for the same store with 409", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", existingCoupon: { id: "existing", storeId: "store-1", code: "SAVE10" } });
  const res = await handleCreateCoupon(db, authReq("http://localhost/api/coupons", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 409);
  assert.equal(calls.couponCreate, undefined);
});

test("POST uppercases the code and creates the coupon when everything checks out", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateCoupon(db, authReq("http://localhost/api/coupons", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 201);
  const create = calls.couponCreate as { data: { code: string; storeId: string } };
  assert.equal(create.data.code, "SAVE10");
  assert.equal(create.data.storeId, "store-1");
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListCoupons(db, new Request("http://localhost/api/coupons?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListCoupons(db, authReq("http://localhost/api/coupons"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListCoupons(db, authReq("http://localhost/api/coupons?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's coupons", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListCoupons(db, authReq("http://localhost/api/coupons?storeId=store-1"));
  assert.equal(res.status, 200);
  assert.deepEqual((calls.couponFindMany as any).where, { storeId: "store-1" });
});
