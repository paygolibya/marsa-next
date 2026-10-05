import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateRedirect, handleListRedirects, type RedirectsDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; createThrows?: { code: string } } = {}) {
  const calls: Record<string, unknown> = {};
  const db: RedirectsDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    redirect: {
      create: async (args) => {
        calls.redirectCreate = args;
        if (opts.createThrows) throw opts.createThrows;
        return { id: "redirect-1", storeId: args.data.storeId, fromPath: args.data.fromPath, toPath: args.data.toPath };
      },
      findMany: async (args) => {
        calls.redirectFindMany = args;
        return [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", fromPath: "/old-page", toPath: "/new-page" };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateRedirect(db, new Request("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateRedirect(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.redirectCreate, undefined);
});

test("POST rejects fromPath and toPath being identical with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateRedirect(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify({ ...validBody, toPath: "/old-page" }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.redirectCreate, undefined);
});

test("POST creates the redirect", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateRedirect(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 201);
  assert.ok(calls.redirectCreate);
});

test("POST maps a duplicate fromPath unique-constraint violation to a real 400, not a 500", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1", createThrows: { code: "P2002" } });
  const res = await handleCreateRedirect(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 400);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListRedirects(db, new Request("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListRedirects(db, authReq("http://localhost/x"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListRedirects(db, authReq("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's redirects", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListRedirects(db, authReq("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.redirectFindMany as { where: { storeId: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
});
