import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateCoupon, handleDeleteCoupon, type CouponByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function noTokenReq(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

function makeFakeDb(opts: { coupon?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: CouponByIdDb = {
    coupon: {
      findUnique: async (args) => {
        calls.findUnique = args;
        return opts.coupon && opts.coupon.id === args.where.id ? opts.coupon : null;
      },
      update: async (args) => {
        calls.update = args;
        return { id: args.where.id, storeId: opts.coupon!.storeId };
      },
      delete: async (args) => {
        calls.delete = args;
        return {};
      },
    },
    store: {
      findFirst: async (args) => {
        calls.storeFindFirst = args;
        return opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null;
      },
    },
  };
  return { db, calls };
}

test("PATCH rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleUpdateCoupon(db, noTokenReq("http://localhost/x", { method: "PATCH", body: "{}" }), "coupon-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a coupon that doesn't exist with 403", async () => {
  const { db, calls } = makeFakeDb({});
  const res = await handleUpdateCoupon(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false }) }), "coupon-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH rejects a coupon belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ coupon: { id: "coupon-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateCoupon(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false }) }), "coupon-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH updates an owned coupon", async () => {
  const { db, calls } = makeFakeDb({ coupon: { id: "coupon-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateCoupon(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false }) }), "coupon-1");
  assert.equal(res.status, 200);
  assert.equal((calls.update as any).data.active, false);
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteCoupon(db, noTokenReq("http://localhost/x", { method: "DELETE" }), "coupon-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a coupon the merchant doesn't own, and never calls delete", async () => {
  const { db, calls } = makeFakeDb({ coupon: { id: "coupon-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteCoupon(db, authReq("http://localhost/x", { method: "DELETE" }), "coupon-1");
  assert.equal(res.status, 403);
  assert.equal(calls.delete, undefined);
});

test("DELETE removes an owned coupon", async () => {
  const { db, calls } = makeFakeDb({ coupon: { id: "coupon-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteCoupon(db, authReq("http://localhost/x", { method: "DELETE" }), "coupon-1");
  assert.equal(res.status, 200);
  assert.equal((calls.delete as any).where.id, "coupon-1");
});
