import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleCreateAffiliate, handleListAffiliates, type AffiliatesDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, init: RequestInit = {}, merchantId = "merchant-1") {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}`);
  return new Request(url, { ...init, headers });
}

function makeFakeDb(opts: { ownedStoreId?: string; existingCodes?: string[]; affiliates?: unknown[]; pending?: { affiliateId: string; commissionCents: number }[] } = {}) {
  const calls: Record<string, unknown> = {};
  const db: AffiliatesDb = {
    store: {
      findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null),
    },
    affiliate: {
      findUnique: async (args) => ((opts.existingCodes ?? []).includes(args.where.storeId_code.code) ? { id: "clash" } : null),
      create: async (args) => {
        calls.affiliateCreate = args;
        return {
          id: "affiliate-1",
          storeId: args.data.storeId,
          name: args.data.name,
          phone: args.data.phone,
          code: args.data.code,
          commissionPercent: args.data.commissionPercent ?? 10,
          active: true,
          createdAt: new Date(),
        };
      },
      findMany: async (args) => {
        calls.affiliateFindMany = args;
        return (opts.affiliates ?? []) as never;
      },
    },
    affiliateCommission: {
      findMany: async (args) => {
        calls.affiliateCommissionFindMany = args;
        return opts.pending ?? [];
      },
    },
  };
  return { db, calls };
}

const validBody = { storeId: "store-1", name: "محمد", phone: "0912345678" };

test("POST rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateAffiliate(db, new Request("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 401);
});

test("POST rejects a store the merchant doesn't own with 403", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleCreateAffiliate(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 403);
  assert.equal(calls.affiliateCreate, undefined);
});

test("POST generates a real code and creates the affiliate, defaulting commissionPercent when omitted", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateAffiliate(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify(validBody) }));
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.ok(body.code && body.code.length >= 6);
  const create = calls.affiliateCreate as { data: { commissionPercent: number | undefined } };
  assert.equal(create.data.commissionPercent, undefined);
});

test("POST respects an explicit commissionPercent", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  await handleCreateAffiliate(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify({ ...validBody, commissionPercent: 15 }) }));
  const create = calls.affiliateCreate as { data: { commissionPercent: number } };
  assert.equal(create.data.commissionPercent, 15);
});

test("POST rejects a commissionPercent over 100 with 400", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleCreateAffiliate(db, authReq("http://localhost/x", { method: "POST", body: JSON.stringify({ ...validBody, commissionPercent: 150 }) }));
  assert.equal(res.status, 400);
  assert.equal(calls.affiliateCreate, undefined);
});

test("GET rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleListAffiliates(db, new Request("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 401);
});

test("GET requires a storeId query param", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListAffiliates(db, authReq("http://localhost/x"));
  assert.equal(res.status, 400);
});

test("GET rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleListAffiliates(db, authReq("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 403);
});

test("GET returns the owned store's affiliates", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  const res = await handleListAffiliates(db, authReq("http://localhost/x?storeId=store-1"));
  assert.equal(res.status, 200);
  const findMany = calls.affiliateFindMany as { where: { storeId: string } };
  assert.deepEqual(findMany.where, { storeId: "store-1" });
});

test("GET attaches each affiliate's pending commission total, summed from AffiliateCommission", async () => {
  const affiliates = [
    { id: "affiliate-1", storeId: "store-1", name: "A", phone: "0900000001", code: "ABC123", commissionPercent: 10, active: true, createdAt: new Date() },
    { id: "affiliate-2", storeId: "store-1", name: "B", phone: "0900000002", code: "XYZ999", commissionPercent: 10, active: true, createdAt: new Date() },
  ];
  const pending = [
    { affiliateId: "affiliate-1", commissionCents: 500 },
    { affiliateId: "affiliate-1", commissionCents: 300 },
  ];
  const { db } = makeFakeDb({ ownedStoreId: "store-1", affiliates, pending });
  const res = await handleListAffiliates(db, authReq("http://localhost/x?storeId=store-1"));
  const body = await res.json();
  assert.equal(body.find((a: { id: string }) => a.id === "affiliate-1").pendingCents, 800);
  assert.equal(body.find((a: { id: string }) => a.id === "affiliate-2").pendingCents, 0);
});
