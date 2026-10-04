import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateCategory, handleDeleteCategory, type CategoryByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function noTokenReq(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

function makeFakeDb(opts: { category?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: CategoryByIdDb = {
    category: {
      findUnique: async (args) => {
        calls.findUnique = args;
        return opts.category && opts.category.id === args.where.id ? opts.category : null;
      },
      update: async (args) => {
        calls.update = args;
        return { id: args.where.id, storeId: opts.category!.storeId };
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
  const res = await handleUpdateCategory(db, noTokenReq("http://localhost/x", { method: "PATCH", body: "{}" }), "category-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a category that doesn't exist with 403", async () => {
  const { db, calls } = makeFakeDb({});
  const res = await handleUpdateCategory(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "x" }) }), "category-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH rejects a category belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ category: { id: "category-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateCategory(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "x" }) }), "category-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("PATCH updates an owned category's name/position", async () => {
  const { db, calls } = makeFakeDb({ category: { id: "category-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateCategory(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ name: "أحذية رجالية", position: 2 }) }), "category-1");
  assert.equal(res.status, 200);
  assert.equal((calls.update as any).data.name, "أحذية رجالية");
  assert.equal((calls.update as any).data.position, 2);
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteCategory(db, noTokenReq("http://localhost/x", { method: "DELETE" }), "category-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a category the merchant doesn't own, and never calls delete", async () => {
  const { db, calls } = makeFakeDb({ category: { id: "category-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteCategory(db, authReq("http://localhost/x", { method: "DELETE" }), "category-1");
  assert.equal(res.status, 403);
  assert.equal(calls.delete, undefined);
});

test("DELETE removes an owned category", async () => {
  const { db, calls } = makeFakeDb({ category: { id: "category-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteCategory(db, authReq("http://localhost/x", { method: "DELETE" }), "category-1");
  assert.equal(res.status, 200);
  assert.equal((calls.delete as any).where.id, "category-1");
});
