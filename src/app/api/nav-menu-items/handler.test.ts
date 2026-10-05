import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateNavMenuItem, handleListNavMenuItems, type NavMenuItemsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; existingCount?: number } = {}) {
  const calls: Record<string, unknown> = {};
  const db: NavMenuItemsDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    navMenuItem: {
      count: async () => opts.existingCount ?? 0,
      create: async (args) => {
        calls.navMenuItemCreate = args;
        return { id: "item-1", storeId: args.data.storeId, label: args.data.label, url: args.data.url, position: args.data.position };
      },
      findMany: async (args) => {
        calls.navMenuItemFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", label: "عن المتجر", url: "/page/about" };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateNavMenuItem(db, new Request("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateNavMenuItem(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.navMenuItemCreate, undefined);
});

test("POST appends at the current count as the new position", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", existingCount: 3 });
  const res = await handleCreateNavMenuItem(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 201);
  const create = calls.navMenuItemCreate as { data: { position: number } };
  assert.equal(create.data.position, 3);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListNavMenuItems(db, new Request("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListNavMenuItems(db, authReq("http://localhost/x"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListNavMenuItems(db, authReq("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's items ordered by position", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListNavMenuItems(db, authReq("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.navMenuItemFindMany as { where: { storeId: string }; orderBy: { position: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
  assert.deepEqual(findMany.orderBy, { position: "asc" });
});
