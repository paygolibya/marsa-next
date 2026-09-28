import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleAnalyticsByStore, type AnalyticsByStoreDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function req(url: string, merchantId = "merchant-1") {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` } });
}

function noTokenReq(url: string) {
  return new Request(url);
}

function makeFakeDb(opts: { ownedStoreId?: string; daily?: any[]; products?: any[] }) {
  const calls: { queryDailyArgs?: unknown; queryTopProductsArgs?: unknown } = {};
  const db: AnalyticsByStoreDb = {
    store: { findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null) },
    queryDaily: async (storeId, since) => {
      calls.queryDailyArgs = { storeId, since };
      return opts.daily ?? [];
    },
    queryTopProducts: async (storeId, since) => {
      calls.queryTopProductsArgs = { storeId, since };
      return opts.products ?? [];
    },
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb({});
  const res = await handleAnalyticsByStore(db, noTokenReq("http://localhost/x?days=30"), "store-1");
  assert.equal(res.status, 401);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleAnalyticsByStore(db, req("http://localhost/x?days=30"), "store-1");
  assert.equal(res.status, 403);
});

test("clamps an out-of-range days param before querying (never an unbounded window)", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  await handleAnalyticsByStore(db, req("http://localhost/x?days=99999"), "store-1");
  const since = (calls.queryDailyArgs as any).since as Date;
  const daysSpanned = (Date.now() - since.getTime()) / (24 * 60 * 60 * 1000);
  assert.ok(daysSpanned < 100, `expected the days param to be clamped, got a ${daysSpanned.toFixed(0)}-day window`);
});

test("returns real daily buckets and top products from the two queries", async () => {
  const daily = [{ date: "2026-01-01", orders: 3, revenueCents: 5000 }];
  const products = [{ productId: "p1", name: "Widget", quantity: 2, revenueCents: 4000 }];
  const { db } = makeFakeDb({ ownedStoreId: "store-1", daily, products });
  const res = await handleAnalyticsByStore(db, req("http://localhost/x?days=7"), "store-1");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.byDay.length > 0);
  assert.equal(body.topProducts[0].name, "Widget");
});

test("scopes both queries to the requested store id", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  await handleAnalyticsByStore(db, req("http://localhost/x?days=7"), "store-1");
  assert.equal((calls.queryDailyArgs as any).storeId, "store-1");
  assert.equal((calls.queryTopProductsArgs as any).storeId, "store-1");
});
