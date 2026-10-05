import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleUpdateAffiliate, handleDeleteAffiliate, type AffiliateByIdDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { affiliate?: { id: string; storeId: string }; ownedStoreId?: string }) {
  const calls: Record<string, unknown> = {};
  const db: AffiliateByIdDb = {
    affiliate: {
      findUnique: async (args) => (opts.affiliate && opts.affiliate.id === args.where.id ? opts.affiliate : null),
      update: async (args) => {
        calls.affiliateUpdate = args;
        return { id: args.where.id, storeId: opts.affiliate?.storeId ?? "" };
      },
      delete: async (args) => {
        calls.affiliateDelete = args;
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
  const res = await handleUpdateAffiliate(db, new Request("http://localhost/x", { method: "PATCH", body: "{}" }), "affiliate-1");
  assert.equal(res.status, 401);
});

test("PATCH rejects an affiliate belonging to a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleUpdateAffiliate(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false }) }), "affiliate-1");
  assert.equal(res.status, 403);
  assert.equal(calls.affiliateUpdate, undefined);
});

test("PATCH toggles active and updates commissionPercent", async () => {
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleUpdateAffiliate(db, authReq("http://localhost/x", { method: "PATCH", body: JSON.stringify({ active: false, commissionPercent: 20 }) }), "affiliate-1");
  assert.equal(res.status, 200);
  assert.deepEqual((calls.affiliateUpdate as { data: Record<string, unknown> }).data, { active: false, commissionPercent: 20 });
});

test("DELETE rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleDeleteAffiliate(db, new Request("http://localhost/x", { method: "DELETE" }), "affiliate-1");
  assert.equal(res.status, 401);
});

test("DELETE rejects an affiliate the merchant doesn't own with 403, without deleting it", async () => {
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "some-other-store" });
  const res = await handleDeleteAffiliate(db, authReq("http://localhost/x", { method: "DELETE" }), "affiliate-1");
  assert.equal(res.status, 403);
  assert.equal(calls.affiliateDelete, undefined);
});

test("DELETE removes an owned affiliate", async () => {
  const { db, calls } = makeFakeDb({ affiliate: { id: "affiliate-1", storeId: "store-1" }, ownedStoreId: "store-1" });
  const res = await handleDeleteAffiliate(db, authReq("http://localhost/x", { method: "DELETE" }), "affiliate-1");
  assert.equal(res.status, 200);
  assert.deepEqual(calls.affiliateDelete, { where: { id: "affiliate-1" } });
});
