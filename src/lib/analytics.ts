// Pure aggregation extracted from the analytics API route so the
// day-bucketing and top-products ranking can be unit tested without a
// database — the dashboard's revenue-over-time chart and "top products"
// list are exactly the kind of thing an off-by-one in the day range or a
// wrong sort direction would silently misreport to a merchant.

export type AnalyticsOrder = {
  createdAt: Date;
  totalCents: number;
  items: { productId: string; productName: string; unitPriceCents: number; quantity: number }[];
};

export type DailyBucket = { date: string; orders: number; revenueCents: number };
export type TopProduct = { name: string; quantity: number; revenueCents: number };

export function buildAnalyticsSummary(
  orders: AnalyticsOrder[],
  days: number,
  now: Date = new Date()
): { byDay: DailyBucket[]; topProducts: TopProduct[] } {
  const byDayMap = new Map<string, { orders: number; revenueCents: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    byDayMap.set(d.toISOString().slice(0, 10), { orders: 0, revenueCents: 0 });
  }
  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    const bucket = byDayMap.get(key);
    if (bucket) {
      bucket.orders += 1;
      bucket.revenueCents += order.totalCents;
    }
  }

  const productTotals = new Map<string, TopProduct>();
  for (const order of orders) {
    for (const item of order.items) {
      const entry = productTotals.get(item.productId) ?? { name: item.productName, quantity: 0, revenueCents: 0 };
      entry.quantity += item.quantity;
      entry.revenueCents += item.unitPriceCents * item.quantity;
      productTotals.set(item.productId, entry);
    }
  }
  const topProducts = Array.from(productTotals.values())
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5);

  return { byDay: Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v })), topProducts };
}

// The same days-param clamp the route applies before calling the above —
// extracted alongside it so the "1..90, default 30, non-numeric -> default"
// rule has its own test rather than only being exercised through a real
// HTTP request. Deliberately not `Number(rawDays) || 30` — that treats
// "0" as falsy and silently resets it to the default instead of clamping
// it to 1, which doesn't match the surrounding clamp's evident intent.
export function clampAnalyticsDays(rawDays: string | null): number {
  if (rawDays === null || rawDays.trim() === "") return 30;
  const parsed = Number(rawDays);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(90, parsed));
}
