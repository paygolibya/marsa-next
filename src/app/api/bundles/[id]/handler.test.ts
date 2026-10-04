import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateBundle, handleDeleteBundle, type BundleByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { bundle?: { id: string; storeId: string }; ownedStoreId?: string; storeProductIds?: string[] }) {
  const calls: Record<string, unknown> = {};
  const db: BundleByIdDb = {
    bundle: {
      findUnique: async (args) => (opts.bundle && opts.bundle.id === args.where.id ? opts.bundle : null),
      update: async (args) => {
        calls.bundleUpdate = args;
        return { id: args.where.id, storeId: opts.bundle?.storeId ?? "", name: "x", priceCents: 1, imageUrl: null, active: true, createdAt: new Date(), items: [] };
      },
      delete: async (args) => {
        calls.bundleDelete = args;
        return {};
      },
    },
    bundleItem: {
      deleteMany: async (args) => {
        calls.bundleItemDeleteMany = args;
        return {};
      },
      createMany: async (args) => {
        calls.bundleItemCreateMany = args;
        return {};
      },
    },
    product: {
      findMany: async (args) => {
        const ids = args.where.id.in as string[];
        return (opts.storeProductIds ?? []).filter((id) => ids.includes(id)).map((id) => ({ id }));
      },
    },
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
  };
  return { db, calls };
}

test("PATCH rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleUpdateBundle(db, new Request("http://localhost/x", { method: "PATCH", body: "{}" }), "bundle-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a bundle belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateBundle(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "New Name" }) }), "bundle-1");
  assert.equal(res.status, 403);
  assert.equal(calls.bundleUpdate, undefined);
});

test("PATCH rejects a non-positive price with 400", async () => {
  const { db } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateBundle(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ priceCents: -1 }) }), "bundle-1");
  assert.equal(res.status, 400);
});

test("PATCH updates fields without touching items when items isn't part of the request", async () => {
  const { db, calls } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateBundle(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "Renamed" }) }), "bundle-1");
  assert.equal(res.status, 200);
  assert.equal(calls.bundleItemDeleteMany, undefined);
  assert.equal(calls.bundleItemCreateMany, undefined);
  assert.deepEqual((calls.bundleUpdate as { data: Record<string, unknown> }).data, { name: "Renamed" });
});

test("PATCH rejects a replacement productId that doesn't belong to this store with 400, without touching existing items", async () => {
  const { db, calls } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "store-1", storeProductIds: ["product-1"] });
  const res = await handleUpdateBundle(
    db,
    authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ items: [{ productId: "product-2", quantity: 1 }] }) }),
    "bundle-1"
  );
  assert.equal(res.status, 400);
  assert.equal(calls.bundleItemDeleteMany, undefined);
  assert.equal(calls.bundleUpdate, undefined);
});

test("PATCH replaces all items (delete then recreate) when items is part of the request", async () => {
  const { db, calls } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "store-1", storeProductIds: ["product-1", "product-2"] });
  const res = await handleUpdateBundle(
    db,
    authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ items: [{ productId: "product-1", quantity: 2 }, { productId: "product-2", quantity: 1 }] }) }),
    "bundle-1"
  );
  assert.equal(res.status, 200);
  assert.deepEqual(calls.bundleItemDeleteMany, { where: { bundleId: "bundle-1" } });
  const createMany = calls.bundleItemCreateMany as { data: { bundleId: string; productId: string; quantity: number }[] };
  assert.deepEqual(createMany.data, [
    { bundleId: "bundle-1", productId: "product-1", quantity: 2 },
    { bundleId: "bundle-1", productId: "product-2", quantity: 1 },
  ]);
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteBundle(db, new Request("http://localhost/x", { method: "DELETE" }), "bundle-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a bundle the merchant doesn't own with 403, without deleting it", async () => {
  const { db, calls } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteBundle(db, authReq("http://localhost/x", { method: "DELETE" }), "bundle-1");
  assert.equal(res.status, 403);
  assert.equal(calls.bundleDelete, undefined);
});

test("DELETE removes an owned bundle", async () => {
  const { db, calls } = makeFakeDb({ bundle: { id: "bundle-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteBundle(db, authReq("http://localhost/x", { method: "DELETE" }), "bundle-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.bundleDelete, { where: { id: "bundle-1" } });
});
