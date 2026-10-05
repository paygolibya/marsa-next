import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { handleAnalyticsEventsByStore, type AnalyticsEventsByStoreDb } from "./handler";

process.env.JWT_SECRET ||= "test-secret";

function authReq(url: string, merchantId = "merchant-1") {
  return new Request(url, { headers: { Authorization: `Bearer ${jwt.sign({ merchantId }, process.env.JWT_SECRET!)}` } });
}

function makeFakeDb(
  opts: {
    ownedStoreId?: string;
    funnelRows?: { type: string; count: number }[];
    deviceRows?: { device: string; count: number }[];
    referrerRows?: { referrer: string; count: number }[];
    pageviewRows?: { date: string; pageviews: number }[];
  } = {}
) {
  const calls: Record<string, unknown> = {};
  const db: AnalyticsEventsByStoreDb = {
    store: { findFirst: async (args) => (opts.ownedStoreId && args.where.id === opts.ownedStoreId ? { id: opts.ownedStoreId } : null) },
    queryFunnel: async (storeId, since) => {
      calls.queryFunnel = { storeId, since };
      return opts.funnelRows ?? [];
    },
    queryDeviceBreakdown: async () => opts.deviceRows ?? [],
    queryTopReferrers: async () => opts.referrerRows ?? [],
    queryDailyPageviews: async () => opts.pageviewRows ?? [],
  };
  return { db, calls };
}

test("rejects an unauthenticated request with 401", async () => {
  const { db } = makeFakeDb();
  const res = await handleAnalyticsEventsByStore(db, new Request("http://localhost/x"), "store-1");
  assert.equal(res.status, 401);
});

test("rejects a store the merchant doesn't own with 403", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "some-other-store" });
  const res = await handleAnalyticsEventsByStore(db, authReq("http://localhost/x"), "store-1");
  assert.equal(res.status, 403);
});

test("returns a complete 4-stage funnel even when Postgres returned rows for only some types", async () => {
  const { db } = makeFakeDb({ ownedStoreId: "store-1", funnelRows: [{ type: "pageview", count: 100 }, { type: "add_to_cart", count: 20 }] });
  const res = await handleAnalyticsEventsByStore(db, authReq("http://localhost/x"), "store-1");
  const body = await res.json();
  assert.deepEqual(body.funnel, { pageview: 100, add_to_cart: 20, checkout_started: 0, order_completed: 0 });
});

test("passes through device breakdown and top referrers as-is", async () => {
  const { db } = makeFakeDb({
    ownedStoreId: "store-1",
    deviceRows: [{ device: "mobile", count: 80 }, { device: "desktop", count: 20 }],
    referrerRows: [{ referrer: "https://facebook.com", count: 15 }],
  });
  const res = await handleAnalyticsEventsByStore(db, authReq("http://localhost/x"), "store-1");
  const body = await res.json();
  assert.deepEqual(body.deviceBreakdown, [{ device: "mobile", count: 80 }, { device: "desktop", count: 20 }]);
  assert.deepEqual(body.topReferrers, [{ referrer: "https://facebook.com", count: 15 }]);
});

test("fills in a full day-scaffold for visitsOverTime, overlaying real rows", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { db } = makeFakeDb({ ownedStoreId: "store-1", pageviewRows: [{ date: today, pageviews: 42 }] });
  const res = await handleAnalyticsEventsByStore(db, authReq("http://localhost/x?days=7"), "store-1");
  const body = await res.json();
  assert.equal(body.visitsOverTime.length, 7);
  assert.equal(body.visitsOverTime.find((d: { date: string }) => d.date === today).pageviews, 42);
});

test("clamps the days param and passes it through to since computation", async () => {
  const { db, calls } = makeFakeDb({ ownedStoreId: "store-1" });
  await handleAnalyticsEventsByStore(db, authReq("http://localhost/x?days=9999"), "store-1");
  const { since } = calls.queryFunnel as { since: Date };
  const daysDiff = Math.round((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(daysDiff, 90); // clamped to the 90-day max
});
