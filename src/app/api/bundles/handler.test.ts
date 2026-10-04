import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateBundle, handleListBundles, type BundlesDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; storeProductIds?: string[] } = {}) {
  const calls: Record<string, unknown> = {};
  const db: BundlesDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    product: {
      findMany: async (args) => {
        calls.productFindMany = args;
        const ids = args.where.id.in as string[];
        return (opts.storeProductIds ?? []).filter((id) => ids.includes(id)).map((id) => ({ id }));
      },
    },
    bundle: {
      create: async (args) => {
        calls.bundleCreate = args;
        return {
          id: "bundle-1",
          storeId: args.data.storeId,
          name: args.data.name,
          priceCents: args.data.priceCents,
          imageUrl: args.data.imageUrl,
          active: true,
          createdAt: new Date(),
          items: args.data.items.create.map((i, idx) => ({ id: `item-${idx}`, productId: i.productId, quantity: i.quantity, product: { name: "x", priceCents: 1000, imageUrl: null } })),
        };
      },
      findMany: async (args) => {
        calls.bundleFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", name: "باقة العيد", priceCents: 10000, items: [{ productId: "product-1", quantity: 1 }, { productId: "product-2", quantity: 2 }] };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"] });
  const res = await handleCreateBundle(db, new Request("http://localhost/api/bundles", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateBundle(db, authReq("http://localhost/api/bundles", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.bundleCreate, undefined);
});

test("POST rejects a non-positive price with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"] });
  const res = await handleCreateBundle(db, authReq("http://localhost/api/bundles", { method: "POST", body: JSON.stringify({ ...validBody, priceCents: 0 }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.bundleCreate, undefined);
});

test("POST rejects an empty items array with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateBundle(db, authReq("http://localhost/api/bundles", { method: "POST", body: JSON.stringify({ ...validBody, items: [] }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.bundleCreate, undefined);
});

test("POST rejects a productId that doesn't belong to this store with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1"] }); // product-2 missing
  const res = await handleCreateBundle(db, authReq("http://localhost/api/bundles", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 400);
  assert.equal(calls.bundleCreate, undefined);
});

test("POST creates a bundle with its items when every product belongs to this store", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"] });
  const res = await handleCreateBundle(db, authReq("http://localhost/api/bundles", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 201);
  const create = calls.bundleCreate as { data: { items: { create: { productId: string; quantity: number }[] } } };
  assert.deepEqual(create.data.items.create, [{ productId: "product-1", quantity: 1 }, { productId: "product-2", quantity: 2 }]);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListBundles(db, new Request("http://localhost/api/bundles?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListBundles(db, authReq("http://localhost/api/bundles"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListBundles(db, authReq("http://localhost/api/bundles?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's bundles", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListBundles(db, authReq("http://localhost/api/bundles?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.bundleFindMany as { where: { storeId: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
});
