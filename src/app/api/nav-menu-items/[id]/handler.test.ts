import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateNavMenuItem, handleDeleteNavMenuItem, type NavMenuItemByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { item?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: NavMenuItemByIdDb = {
    navMenuItem: {
      findUnique: async (args) => (opts.item && opts.item.id === args.where.id ? opts.item : null),
      update: async (args) => {
        calls.navMenuItemUpdate = args;
        return { id: args.where.id, storeId: opts.item?.storeId ?? "" };
      },
      delete: async (args) => {
        calls.navMenuItemDelete = args;
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
  const res = await handleUpdateNavMenuItem(db, new Request("http://localhost/x", { method: "PATCH", body: "{}" }), "item-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects an item belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ item: { id: "item-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateNavMenuItem(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ label: "New" }) }), "item-1");
  assert.equal(res.status, 403);
  assert.equal(calls.navMenuItemUpdate, undefined);
});

test("PATCH updates label/url/position", async () => {
  const { db, calls } = makeFakeDb({ item: { id: "item-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateNavMenuItem(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ label: "New", url: "/x", position: 2 }) }), "item-1");
  assert.equal(res.status, 200);
  assert.deepEqual((calls.navMenuItemUpdate as { data: Record<string, unknown> }).data, { label: "New", url: "/x", position: 2 });
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteNavMenuItem(db, new Request("http://localhost/x", { method: "DELETE" }), "item-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects an item the merchant doesn't own with 403, without deleting it", async () => {
  const { db, calls } = makeFakeDb({ item: { id: "item-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteNavMenuItem(db, authReq("http://localhost/x", { method: "DELETE" }), "item-1");
  assert.equal(res.status, 403);
  assert.equal(calls.navMenuItemDelete, undefined);
});

test("DELETE removes an owned item", async () => {
  const { db, calls } = makeFakeDb({ item: { id: "item-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteNavMenuItem(db, authReq("http://localhost/x", { method: "DELETE" }), "item-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.navMenuItemDelete, { where: { id: "item-1" } });
});
