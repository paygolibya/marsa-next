import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateProduct, handleDeleteProduct, type ProductByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function noTokenReq(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

function makeFakeDb(opts: { product?: { id: string; storeId: string }; ownedStoreId?: string; existingCategoryId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: ProductByIdDb = {
    product: {
      findUnique: async (args) => (opts.product && opts.product.id === args.where.id ? opts.product : null),
      update: async (args) => {
        calls.update = args;
        return { id: args.where.id, ...(args.data as any) };
      },
    },
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    category: {
      findFirst: async (args) => (opts.existingCategoryId && args.where.id === opts.existingCategoryId ? { id: opts.existingCategoryId } : null),
    },
  };
  return { db, calls };
}

test("PATCH rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleUpdateProduct(db, noTokenReq("http://localhost/x", { method: "PATCH", body: "{}" }), "product-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a product belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateProduct(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "New Name" }) }), "product-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH rejects an invalid body (non-positive price) with 400", async () => {
  const { db } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateProduct(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ priceCents: -1 }) }), "product-1");
  assert.equal(res.status, 400);
});

test("PATCH updates imageUrl to images[0] only when images was part of the request", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  await handleUpdateProduct(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ images: ["https://x.com/a.jpg"] }) }), "product-1");
  const update = calls.update as { data: { imageUrl: string; images: string[] } };
  assert.equal(update.data.imageUrl, "https://x.com/a.jpg");
});

test("PATCH leaves imageUrl untouched when images isn't part of the request", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  await handleUpdateProduct(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "Renamed" }) }), "product-1");
  const update = calls.update as { data: Record<string, unknown> };
  assert.ok(!("imageUrl" in update.data));
});

test("PATCH rejects a categoryId that doesn't belong to this product's store with 400", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1", existingCategoryId: "some-other-category" });
  const res = await handleUpdateProduct(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ categoryId: "category-1" }) }), "product-1");
  assert.equal(res.status, 400);
  assert.equal(calls.update, undefined);
});

test("PATCH accepts a categoryId that belongs to this product's store", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1", existingCategoryId: "category-1" });
  const res = await handleUpdateProduct(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ categoryId: "category-1" }) }), "product-1");
  assert.equal(res.status, 200);
  assert.equal((calls.update as { data: { categoryId: string } }).data.categoryId, "category-1");
});

test("PATCH passes metaTitle/metaDescription/costPriceCents straight through when present", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  await handleUpdateProduct(
    db,
    authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ metaTitle: "عنوان SEO", metaDescription: "وصف SEO", costPriceCents: 2000 }) }),
    "product-1"
  );
  const update = calls.update as { data: { metaTitle: string; metaDescription: string; costPriceCents: number } };
  assert.equal(update.data.metaTitle, "عنوان SEO");
  assert.equal(update.data.metaDescription, "وصف SEO");
  assert.equal(update.data.costPriceCents, 2000);
});

test("PATCH passes translations straight through when present, and omits the key entirely when absent", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  await handleUpdateProduct(
    db,
    authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ translations: { en: { name: "English name" } } }) }),
    "product-1"
  );
  const update = calls.update as { data: { translations?: unknown } };
  assert.deepEqual(update.data.translations, { en: { name: "English name" } });

  const { db: db2, calls: calls2 } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  await handleUpdateProduct(db2, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "اسم جديد" }) }), "product-1");
  const update2 = calls2.update as { data: { translations?: unknown } };
  assert.equal("translations" in update2.data, false);
});

test("PATCH rejects a metaDescription over the length cap with 400", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateProduct(
    db,
    authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ metaDescription: "a".repeat(161) }) }),
    "product-1"
  );
  assert.equal(res.status, 400);
  assert.equal(calls.update, undefined);
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteProduct(db, noTokenReq("http://localhost/x", { method: "DELETE" }), "product-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a product the merchant doesn't own with 403, without touching it", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteProduct(db, authReq("http://localhost/x", { method: "DELETE" }), "product-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("DELETE soft-deletes (active:false + deletedAt set), not a hard delete", async () => {
  const { db, calls } = makeFakeDb({ product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteProduct(db, authReq("http://localhost/x", { method: "DELETE" }), "product-1");
  assert.equal(res.status, 200);
  const update = calls.update as { data: { active: boolean; deletedAt: Date } };
  assert.equal(update.data.active, false);
  assert.ok(update.data.deletedAt instanceof Date);
});
