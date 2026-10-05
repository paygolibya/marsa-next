import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateRedirect, handleDeleteRedirect, type RedirectByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { redirect?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: RedirectByIdDb = {
    redirect: {
      findUnique: async (args) => (opts.redirect && opts.redirect.id === args.where.id ? opts.redirect : null),
      update: async (args) => {
        calls.redirectUpdate = args;
        return { id: args.where.id, storeId: opts.redirect?.storeId ?? "" };
      },
      delete: async (args) => {
        calls.redirectDelete = args;
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
  const res = await handleUpdateRedirect(db, new Request("http://localhost/x", { method: "PATCH", body: "{}" }), "redirect-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects a redirect belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ redirect: { id: "redirect-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateRedirect(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ toPath: "/new" }) }), "redirect-1");
  assert.equal(res.status, 403);
  assert.equal(calls.redirectUpdate, undefined);
});

test("PATCH updates toPath", async () => {
  const { db, calls } = makeFakeDb({ redirect: { id: "redirect-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateRedirect(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ toPath: "/new" }) }), "redirect-1");
  assert.equal(res.status, 200);
  assert.deepEqual((calls.redirectUpdate as { data: Record<string, unknown> }).data, { toPath: "/new" });
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteRedirect(db, new Request("http://localhost/x", { method: "DELETE" }), "redirect-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects a redirect the merchant doesn't own with 403, without deleting it", async () => {
  const { db, calls } = makeFakeDb({ redirect: { id: "redirect-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteRedirect(db, authReq("http://localhost/x", { method: "DELETE" }), "redirect-1");
  assert.equal(res.status, 403);
  assert.equal(calls.redirectDelete, undefined);
});

test("DELETE removes an owned redirect", async () => {
  const { db, calls } = makeFakeDb({ redirect: { id: "redirect-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteRedirect(db, authReq("http://localhost/x", { method: "DELETE" }), "redirect-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.redirectDelete, { where: { id: "redirect-1" } });
});
