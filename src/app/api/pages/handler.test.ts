import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreatePage, handleListPages, type PagesDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; existingSlugs?: string[] } = {}) {
  const calls: Record<string, unknown> = {};
  const db: PagesDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    page: {
      findUnique: async (args) => {
        const slug = args.where.storeId_slug.slug;
        return (opts.existingSlugs ?? []).includes(slug) ? { id: "clash", storeId: "store-1", slug, title: "x", content: "", createdAt: new Date() } : null;
      },
      create: async (args) => {
        calls.pageCreate = args;
        return { id: "page-1", storeId: args.data.storeId, slug: args.data.slug, title: args.data.title, content: args.data.content, createdAt: new Date() };
      },
      findMany: async (args) => {
        calls.pageFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", title: "عن المتجر", content: "نص الصفحة" };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreatePage(db, new Request("http://localhost/api/pages", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreatePage(db, authReq("http://localhost/api/pages", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.pageCreate, undefined);
});

test("POST rejects a missing title with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreatePage(db, authReq("http://localhost/api/pages", { method: "POST", body: JSON.stringify({ storeId: "store-1", content: "x" }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.pageCreate, undefined);
});

test("POST derives a real slug from the title and creates the page", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreatePage(db, authReq("http://localhost/api/pages", { method: "POST", body: JSON.stringify({ storeId: "store-1", title: "About Us", content: "x" }) }));
  assert.equal(res.status, 201);
  const create = calls.pageCreate as { data: { slug: string } };
  assert.equal(create.data.slug, "about-us");
});

test("POST appends a digits-only suffix when the slug already exists for this store", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1", existingSlugs: ["about-us"] });
  const res = await handleCreatePage(db, authReq("http://localhost/api/pages", { method: "POST", body: JSON.stringify({ storeId: "store-1", title: "About Us", content: "x" }) }));
  assert.equal(res.status, 201);
  const create = calls.pageCreate as { data: { slug: string } };
  assert.match(create.data.slug, /^about-us-\d+$/);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListPages(db, new Request("http://localhost/api/pages?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListPages(db, authReq("http://localhost/api/pages"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListPages(db, authReq("http://localhost/api/pages?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's pages", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListPages(db, authReq("http://localhost/api/pages?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.pageFindMany as { where: { storeId: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
});
