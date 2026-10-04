import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateCategory, handleListCategories, type CategoriesDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; existingSlugs?: string[] } = {}) {
  const calls: Record<string, unknown> = {};
  const db: CategoriesDb = {
    store: {
      findFirst: async (args) => {
        calls.storeFindFirst = args;
        return opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null;
      },
    },
    category: {
      findUnique: async (args) => {
        calls.categoryFindUnique = args;
        const slug = args.where.storeId_slug.slug;
        return (opts.existingSlugs ?? []).includes(slug) ? { id: "clash", storeId: "store-1", name: "x", slug, position: 0 } : null;
      },
      create: async (args) => {
        calls.categoryCreate = args;
        return { id: "category-1", storeId: args.data.storeId, name: args.data.name, slug: args.data.slug, position: 0 };
      },
      findMany: async (args) => {
        calls.categoryFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", name: "أحذية" };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateCategory(db, new Request("http://localhost/api/categories", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateCategory(db, authReq("http://localhost/api/categories", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.categoryCreate, undefined);
});

test("POST rejects a missing name with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateCategory(db, authReq("http://localhost/api/categories", { method: "POST", body: JSON.stringify({ storeId: "store-1" }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.categoryCreate, undefined);
});

test("POST derives a real slug from the name and creates the category", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateCategory(db, authReq("http://localhost/api/categories", { method: "POST", body: JSON.stringify({ storeId: "store-1", name: "Shoes" }) }));
  assert.equal(res.status, 201);
  const create = calls.categoryCreate as { data: { slug: string } };
  assert.equal(create.data.slug, "shoes");
});

test("POST appends a digits-only suffix when the slug already exists for this store", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", existingSlugs: ["shoes"] });
  const res = await handleCreateCategory(db, authReq("http://localhost/api/categories", { method: "POST", body: JSON.stringify({ storeId: "store-1", name: "Shoes" }) }));
  assert.equal(res.status, 201);
  const create = calls.categoryCreate as { data: { slug: string } };
  assert.match(create.data.slug, /^shoes-\d+$/);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListCategories(db, new Request("http://localhost/api/categories?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListCategories(db, authReq("http://localhost/api/categories"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListCategories(db, authReq("http://localhost/api/categories?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's categories ordered by position", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListCategories(db, authReq("http://localhost/api/categories?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.categoryFindMany as { where: { storeId: string }; orderBy: { position: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
  assert.deepEqual(findMany.orderBy, { position: "asc" });
});
