import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateProduct, type CreateProductDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(body: unknown, merchantId = "merchant-1") {
  return new Request("http://localhost/api/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` },
    body: JSON.stringify(body),
  });
}

function noTokenReq(body: unknown) {
  return new Request("http://localhost/api/products", { method: "POST", body: JSON.stringify(body) });
}

const validBody = { storeId: "store-1", name: "Widget", priceCents: 5000, images: ["https://example.com/a.jpg"] };

function makeFakeDb(ownedStoreId?: string) {
  const calls: { create?: unknown } = {};
  const db: CreateProductDb = {
    store: { findFirst: async (args) => (ownedStoreId && args.where.id === ownedStoreId ? { id: ownedStoreId } : null) },
    product: {
      create: async (args) => {
        calls.create = args;
        return { id: "product-1", ...args.data };
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb("store-1");
  const res = await handleCreateProduct(db, noTokenReq(validBody));
  assert.equal(res.status, 401);
});

test("rejects invalid input (non-positive price) with 400", async () => {
  const { db } = makeFakeDb("store-1");
  const res = await handleCreateProduct(db, req({ ...validBody, priceCents: 0 }));
  assert.equal(res.status, 400);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb("some-other-store");
  const res = await handleCreateProduct(db, req(validBody));
  assert.equal(res.status, 403);
  assert.equal(calls.create, undefined);
});

test("sets imageUrl to images[0], keeping the two in sync", async () => {
  const { db, calls } = makeFakeDb("store-1");
  const res = await handleCreateProduct(db, req(validBody));
  assert.equal(res.status, 201);
  const create = calls.create as { data: { imageUrl: string | null; images: string[] } };
  assert.equal(create.data.imageUrl, "https://example.com/a.jpg");
});

test("a product with no images gets imageUrl null and an empty images array, not undefined", async () => {
  const { db, calls } = makeFakeDb("store-1");
  const res = await handleCreateProduct(db, req({ ...validBody, images: undefined }));
  assert.equal(res.status, 201);
  const create = calls.create as { data: { imageUrl: string | null; images: string[] } };
  assert.equal(create.data.imageUrl, null);
  assert.deepEqual(create.data.images, []);
});

test("returns the new product with an explicit empty variants array", async () => {
  const { db } = makeFakeDb("store-1");
  const res = await handleCreateProduct(db, req(validBody));
  const body = await res.json();
  assert.deepEqual(body.variants, []);
});

test("persists an optional description, or null when omitted", async () => {
  const { db, calls } = makeFakeDb("store-1");
  await handleCreateProduct(db, req({ ...validBody, description: "تفاصيل المنتج" }));
  assert.equal((calls.create as { data: { description: string | null } }).data.description, "تفاصيل المنتج");

  const { db: db2, calls: calls2 } = makeFakeDb("store-1");
  await handleCreateProduct(db2, req(validBody));
  assert.equal((calls2.create as { data: { description: string | null } }).data.description, null);
});

test("rejects a description over the length cap with 400", async () => {
  const { db, calls } = makeFakeDb("store-1");
  const res = await handleCreateProduct(db, req({ ...validBody, description: "a".repeat(5001) }));
  assert.equal(res.status, 400);
  assert.equal(calls.create, undefined);
});
