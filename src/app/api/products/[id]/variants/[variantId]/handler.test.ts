import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateVariant, handleDeleteVariant, type VariantByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function noTokenReq(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

function makeFakeDb(opts: { variant?: { id: string; productId: string }; product?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: VariantByIdDb = {
    productVariant: {
      findFirst: async (args) =>
        opts.variant && opts.variant.id === args.where.id && opts.variant.productId === args.where.productId ? opts.variant : null,
      update: async (args) => {
        calls.update = args;
        return { id: args.where.id, ...(args.data as any) };
      },
      delete: async (args) => {
        calls.delete = args;
        return {};
      },
    },
    product: { findUnique: async (args) => (opts.product && opts.product.id === args.where.id ? opts.product : null) },
    store: { findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null) },
  };
  return { db, calls };
}

const owned = { variant: { id: "variant-1", productId: "product-1" }, product: { id: "product-1", storeId: "store-1" }, ownedStoreId: "store-1" };

test("PATCH rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb(owned);
  const res = await handleUpdateVariant(db, noTokenReq("http://localhost/x", { method: "PATCH", body: "{}" }), "product-1", "variant-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a variant that doesn't belong to the given product with 403", async () => {
  const { db, calls } = makeFakeDb({ ...owned, variant: { id: "variant-1", productId: "some-other-product" } });
  const res = await handleUpdateVariant(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ priceCents: 100 }) }), "product-1", "variant-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH rejects a variant belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ...owned, ownedStoreId: "some-other-store" });
  const res = await handleUpdateVariant(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ priceCents: 100 }) }), "product-1", "variant-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH rejects invalid input (negative stock) with 400", async () => {
  const { db } = makeFakeDb(owned);
  const res = await handleUpdateVariant(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ stockQty: -1 }) }), "product-1", "variant-1");
  assert.equal(res.status, 400);
});

test("PATCH updates an owned variant", async () => {
  const { db, calls } = makeFakeDb(owned);
  const res = await handleUpdateVariant(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ priceCents: 1500, active: false }) }), "product-1", "variant-1");
  assert.equal(res.status, 200);
  const update = calls.update as { data: { priceCents: number; active: boolean } };
  assert.equal(update.data.priceCents, 1500);
  assert.equal(update.data.active, false);
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb(owned);
  const res = await handleDeleteVariant(db, noTokenReq("http://localhost/x", { method: "DELETE" }), "product-1", "variant-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a variant the merchant doesn't own with 403, never deleting it", async () => {
  const { db, calls } = makeFakeDb({ ...owned, ownedStoreId: "some-other-store" });
  const res = await handleDeleteVariant(db, authReq("http://localhost/x", { method: "DELETE" }), "product-1", "variant-1");
  assert.equal(res.status, 403);
  assert.equal(calls.delete, undefined);
});

test("DELETE removes an owned variant without touching others (only this one)", async () => {
  const { db, calls } = makeFakeDb(owned);
  const res = await handleDeleteVariant(db, authReq("http://localhost/x", { method: "DELETE" }), "product-1", "variant-1");
  assert.equal(res.status, 200);
  assert.equal((calls.delete as any).where.id, "variant-1");
});
