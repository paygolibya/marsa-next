import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateStore, type StoreByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function noTokenReq(url: string, init: RequestInit = {}) {
  return new Request(url, init);
}

function makeFakeDb(ownedStoreId?: string) {
  const calls: { update?: unknown } = {};
  const db: StoreByIdDb = {
    store: {
      findFirst: async (args) => (ownedStoreId && args.where.id === ownedStoreId ? { id: ownedStoreId } : null),
      update: async (args) => {
        calls.update = args;
        return { id: args.where.id, ...(args.data as any) };
      },
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb("store-1");
  const res = await handleUpdateStore(db, noTokenReq("http://localhost/x", { method: "PATCH", body: "{}" }), "store-1");
  assert.equal(res.status, 401);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb("some-other-store");
  const res = await handleUpdateStore(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ aboutText: "hi" }) }), "store-1");
  assert.equal(res.status, 403);
  assert.equal(calls.update, undefined);
});

test("updates an owned store's settings", async () => {
  const { db, calls } = makeFakeDb("store-1");
  const res = await handleUpdateStore(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ aboutText: "About us" }) }), "store-1");
  assert.equal(res.status, 200);
  assert.equal((calls.update as any).data.aboutText, "About us");
});
