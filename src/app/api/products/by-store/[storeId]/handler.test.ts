import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleProductsByStore, type ProductsByStoreDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(merchantId = "merchant-1") {
  return new Request("http://localhost/api/products/by-store/store-1", {
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
  });
}

function noTokenReq() {
  return new Request("http://localhost/api/products/by-store/store-1");
}

function makeFakeDb(opts: { ownedStoreId?: string; products?: { id: string; storeId: string; createdAt: Date; variants: unknown[] }[] }) {
  const calls: { where?: unknown } = {};
  const db: ProductsByStoreDb = {
    store: { findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null) },
    product: {
      findMany: async (args) => {
        calls.where = args.where;
        return opts.products ?? [];
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleProductsByStore(db, noTokenReq(), "store-1");
  assert.equal(res.status, 401);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleProductsByStore(db, req(), "store-1");
  assert.equal(res.status, 403);
});

test("excludes soft-deleted products (deletedAt: null filter)", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  await handleProductsByStore(db, req(), "store-1");
  assert.deepEqual(calls.where, { storeId: "store-1", deletedAt: null });
});

test("returns the owned store's products", async () => {
  const products = [{ id: "p1", storeId: "store-1", createdAt: new Date(), variants: [] }];
  const { db } = makeFakeDb({ ownedStoreId: "store-1", products });
  const res = await handleProductsByStore(db, req(), "store-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.length, 1);
});
