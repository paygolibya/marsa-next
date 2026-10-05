import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateUpsell, handleDeleteUpsell, type UpsellByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { upsell?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: UpsellByIdDb = {
    upsell: {
      findUnique: async (args) => (opts.upsell && opts.upsell.id === args.where.id ? opts.upsell : null),
      update: async (args) => {
        calls.upsellUpdate = args;
        return { id: args.where.id, storeId: opts.upsell?.storeId ?? "" };
      },
      delete: async (args) => {
        calls.upsellDelete = args;
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
  const res = await handleUpdateUpsell(db, new Request("http://localhost/x", { method: "PATCH", body: "{}" }), "upsell-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects an upsell belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ upsell: { id: "upsell-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateUpsell(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false }) }), "upsell-1");
  assert.equal(res.status, 403);
  assert.equal(calls.upsellUpdate, undefined);
});

test("PATCH toggles active", async () => {
  const { db, calls } = makeFakeDb({ upsell: { id: "upsell-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateUpsell(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false }) }), "upsell-1");
  assert.equal(res.status, 200);
  assert.deepEqual((calls.upsellUpdate as { data: Record<string, unknown> }).data, { active: false });
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteUpsell(db, new Request("http://localhost/x", { method: "DELETE" }), "upsell-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects an upsell the merchant doesn't own with 403, without deleting it", async () => {
  const { db, calls } = makeFakeDb({ upsell: { id: "upsell-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteUpsell(db, authReq("http://localhost/x", { method: "DELETE" }), "upsell-1");
  assert.equal(res.status, 403);
  assert.equal(calls.upsellDelete, undefined);
});

test("DELETE removes an owned upsell", async () => {
  const { db, calls } = makeFakeDb({ upsell: { id: "upsell-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteUpsell(db, authReq("http://localhost/x", { method: "DELETE" }), "upsell-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.upsellDelete, { where: { id: "upsell-1" } });
});
