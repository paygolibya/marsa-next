import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalyticsSummary, clampAnalyticsDays, type AnalyticsOrder } from "./analytics";

const NOW = new Date("2026-01-10T12:00:00.000Z");

function order(overrides: Partial<AnalyticsOrder> = {}): AnalyticsOrder {
  return { createdAt: NOW, totalCents: 1000, items: [], ...overrides };
}

test("clampAnalyticsDays enforces the 1..90 range and defaults to 30", () => {
  assert.equal(clampAnalyticsDays("30"), 30);
  assert.equal(clampAnalyticsDays("0"), 1);
  assert.equal(clampAnalyticsDays("-5"), 1);
  assert.equal(clampAnalyticsDays("500"), 90);
  assert.equal(clampAnalyticsDays("not-a-number"), 30);
  assert.equal(clampAnalyticsDays(null), 30);
});

test("byDay always has exactly `days` buckets, oldest first, even with zero orders", () => {
  const { byDay } = buildAnalyticsSummary([], 7, NOW);
  assert.equal(byDay.length, 7);
  assert.equal(byDay[0].date, "2026-01-04");
  assert.equal(byDay[6].date, "2026-01-10"); // today is the last bucket
  assert.ok(byDay.every((b) => b.orders === 0 && b.revenueCents === 0));
});

test("an order's revenue lands in the bucket matching its own createdAt date", () => {
  const { byDay } = buildAnalyticsSummary(
    [order({ createdAt: new Date("2026-01-08T23:59:00.000Z"), totalCents: 5000 }), order({ createdAt: new Date("2026-01-08T00:01:00.000Z"), totalCents: 2000 })],
    7,
    NOW
  );
  const jan8 = byDay.find((b) => b.date === "2026-01-08")!;
  assert.equal(jan8.orders, 2);
  assert.equal(jan8.revenueCents, 7000);
});

test("an order older than the requested window is silently dropped, not counted in the first bucket", () => {
  // buildAnalyticsSummary assumes the caller already filtered by `since` —
  // if it didn't, this order falls outside every bucket's date key and
  // must not corrupt day 0's totals.
  const { byDay } = buildAnalyticsSummary([order({ createdAt: new Date("2025-01-01T00:00:00.000Z"), totalCents: 99999 })], 7, NOW);
  const total = byDay.reduce((sum, b) => sum + b.revenueCents, 0);
  assert.equal(total, 0);
});

test("topProducts sums quantity/revenue across multiple orders and sorts by revenue descending", () => {
  const { topProducts } = buildAnalyticsSummary(
    [
      order({ items: [{ productId: "p1", productName: "Cheap", unitPriceCents: 100, quantity: 5 }] }),
      order({ items: [{ productId: "p2", productName: "Expensive", unitPriceCents: 10000, quantity: 1 }] }),
      order({ items: [{ productId: "p1", productName: "Cheap", unitPriceCents: 100, quantity: 3 }] }),
    ],
    7,
    NOW
  );
  assert.equal(topProducts[0].name, "Expensive");
  assert.equal(topProducts[1].name, "Cheap");
  assert.equal(topProducts[1].quantity, 8); // 5 + 3 summed across the two orders
  assert.equal(topProducts[1].revenueCents, 800);
});

test("topProducts is capped at 5 even with more distinct products", () => {
  const orders = Array.from({ length: 8 }, (_, i) =>
    order({ items: [{ productId: `p${i}`, productName: `Product ${i}`, unitPriceCents: (i + 1) * 100, quantity: 1 }] })
  );
  const { topProducts } = buildAnalyticsSummary(orders, 7, NOW);
  assert.equal(topProducts.length, 5);
  // Highest unitPriceCents (p7) should be first.
  assert.equal(topProducts[0].name, "Product 7");
});
