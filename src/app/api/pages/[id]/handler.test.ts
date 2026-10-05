import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdatePage, handleDeletePage, type PageByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { page?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: PageByIdDb = {
    page: {
      findUnique: async (args) => (opts.page && opts.page.id === args.where.id ? opts.page : null),
      update: async (args) => {
        calls.pageUpdate = args;
        return { id: args.where.id, storeId: opts.page?.storeId ?? "" };
      },
      delete: async (args) => {
        calls.pageDelete = args;
        return {};
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
  const res = await handleUpdatePage(db, new Request("http://localhost/x", { method: "PATCH", body: "{}" }), "page-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a page belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ page: { id: "page-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdatePage(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ title: "New" }) }), "page-1");
  assert.equal(res.status, 403);
  assert.equal(calls.pageUpdate, undefined);
});

test("PATCH updates title/content", async () => {
  const { db, calls } = makeFakeDb({ page: { id: "page-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdatePage(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ title: "New Title", content: "New content" }) }), "page-1");
  assert.equal(res.status, 200);
  assert.deepEqual((calls.pageUpdate as { data: Record<string, unknown> }).data, { title: "New Title", content: "New content" });
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeletePage(db, new Request("http://localhost/x", { method: "DELETE" }), "page-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a page the merchant doesn't own with 403, without deleting it", async () => {
  const { db, calls } = makeFakeDb({ page: { id: "page-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeletePage(db, authReq("http://localhost/x", { method: "DELETE" }), "page-1");
  assert.equal(res.status, 403);
  assert.equal(calls.pageDelete, undefined);
});

test("DELETE removes an owned page", async () => {
  const { db, calls } = makeFakeDb({ page: { id: "page-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeletePage(db, authReq("http://localhost/x", { method: "DELETE" }), "page-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.pageDelete, { where: { id: "page-1" } });
});
