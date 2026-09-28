import test from "node:test";
import assert from "node:assert/strict";
import { mergeDailyBuckets, pickTopProducts, clampAnalyticsDays, type DbDailyRow, type DbProductRow } from "./analytics";

const NOW = new Date("2026-01-10T12:00:00.000Z");

test("clampAnalyticsDays enforces the 1..90 range and defaults to 30", () => {
  assert.equal(clampAnalyticsDays("30"), 30);
  assert.equal(clampAnalyticsDays("0"), 1);
  assert.equal(clampAnalyticsDays("-5"), 1);
  assert.equal(clampAnalyticsDays("500"), 90);
  assert.equal(clampAnalyticsDays("not-a-number"), 30);
  assert.equal(clampAnalyticsDays(null), 30);
});

test("byDay always has exactly `days` buckets, oldest first, even with no DB rows", () => {
  const byDay = mergeDailyBuckets([], 7, NOW);
  assert.equal(byDay.length, 7);
  assert.equal(byDay[0].date, "2026-01-04");
  assert.equal(byDay[6].date, "2026-01-10"); // today is the last bucket
  assert.ok(byDay.every((b) => b.orders === 0 && b.revenueCents === 0));
});

test("a DB row's totals land in the bucket matching its date", () => {
  const byDay = mergeDailyBuckets([{ date: "2026-01-08", orders: 2, revenueCents: 7000 }], 7, NOW);
  const jan8 = byDay.find((b) => b.date === "2026-01-08")!;
  assert.equal(jan8.orders, 2);
  assert.equal(jan8.revenueCents, 7000);
});

test("a DB row for a date outside the requested window is silently dropped", () => {
  // mergeDailyBuckets assumes the caller's SQL already filtered by `since`
  // — if a row's date isn't one of the scaffolded days, it must not be
  // able to corrupt any bucket's totals.
  const byDay = mergeDailyBuckets([{ date: "2025-01-01", orders: 5, revenueCents: 99999 }], 7, NOW);
  const total = byDay.reduce((sum, b) => sum + b.revenueCents, 0);
  assert.equal(total, 0);
});

test("pickTopProducts sorts by revenue descending", () => {
  const rows: DbProductRow[] = [
    { productId: "p1", name: "Cheap", quantity: 8, revenueCents: 800 },
    { productId: "p2", name: "Expensive", quantity: 1, revenueCents: 10000 },
  ];
  const topProducts = pickTopProducts(rows);
  assert.equal(topProducts[0].name, "Expensive");
  assert.equal(topProducts[1].name, "Cheap");
  assert.equal(topProducts[1].quantity, 8);
});

test("pickTopProducts is capped at 5 even with more distinct products", () => {
  const rows: DbProductRow[] = Array.from({ length: 8 }, (_, i) => ({
    productId: `p${i}`,
    name: `Product ${i}`,
    quantity: 1,
    revenueCents: (i + 1) * 100,
  }));
  const topProducts = pickTopProducts(rows);
  assert.equal(topProducts.length, 5);
  assert.equal(topProducts[0].name, "Product 7"); // highest revenueCents
});
