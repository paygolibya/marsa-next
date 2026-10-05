// Pure aggregation extracted from the analytics API route so the
// day-bucketing and top-products ranking can be unit tested without a
// database — the dashboard's revenue-over-time chart and "top products"
// list are exactly the kind of thing an off-by-one in the day range or a
// wrong sort direction would silently misreport to a merchant.
//
// The route used to fetch every order (with every item) in the window and
// aggregate in JS — this was fine at the volumes this codebase actually
// had, but a real load test (scripts/load-test.mjs, seeded to 30k orders
// on one store) measured this at 2+ seconds. The route now aggregates in
// Postgres (GROUP BY, one raw query each — see route.ts) and only the
// final, already-small step (merge a day-scaffold, sort+cap top products)
// happens here in JS. These two functions are what stayed pure/testable;
// the SQL itself isn't something a unit test can usefully cover, but it's
// exercised for real by scripts/load-test.mjs.

export type DailyBucket = { date: string; orders: number; revenueCents: number };
export type TopProduct = { name: string; quantity: number; revenueCents: number };
export type DbDailyRow = { date: string; orders: number; revenueCents: number };
export type DbProductRow = { productId: string; name: string; quantity: number; revenueCents: number };

// Fills in every day in the window (even ones with zero orders) and
// overlays whatever Postgres actually returned — dbRows only ever contains
// days that had at least one order.
export function mergeDailyBuckets(dbRows: DbDailyRow[], days: number, now: Date = new Date()): DailyBucket[] {
  const byDayMap = new Map<string, DailyBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    byDayMap.set(date, { date, orders: 0, revenueCents: 0 });
  }
  for (const row of dbRows) {
    const bucket = byDayMap.get(row.date);
    if (bucket) {
      bucket.orders = row.orders;
      bucket.revenueCents = row.revenueCents;
    }
  }
  return Array.from(byDayMap.values());
}

// Postgres returns every distinct product sold in the window (bounded by
// catalog size, not order count) — this picks the top 5 by revenue.
export function pickTopProducts(dbRows: DbProductRow[], limit = 5): TopProduct[] {
  return [...dbRows]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, limit)
    .map(({ name, quantity, revenueCents }) => ({ name, quantity, revenueCents }));
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

// --- First-party event tracking (AnalyticsEvent) — a separate data
// source from the order-derived stats above, aggregated the same way
// (GROUP BY in Postgres, see route.ts; only the small final shaping step
// happens here in JS) for the same reason: pulling every raw event row
// into app memory doesn't scale any better than pulling every order did.

export const FUNNEL_EVENT_TYPES = ["pageview", "add_to_cart", "checkout_started", "order_completed"] as const;
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];
export type FunnelCounts = Record<FunnelEventType, number>;
export type DbFunnelRow = { type: string; count: number };
export type DbDeviceRow = { device: string; count: number };
export type DbReferrerRow = { referrer: string; count: number };
export type DbPageviewRow = { date: string; pageviews: number };
export type DailyPageviews = { date: string; pageviews: number };

// Always returns all 4 funnel stages, even ones Postgres returned no row
// for at all (zero events of that type in the window) — a missing key
// would otherwise read as undefined instead of 0 wherever the dashboard
// renders it.
export function buildFunnelCounts(dbRows: DbFunnelRow[]): FunnelCounts {
  const counts = Object.fromEntries(FUNNEL_EVENT_TYPES.map((t) => [t, 0])) as FunnelCounts;
  for (const row of dbRows) {
    if ((FUNNEL_EVENT_TYPES as readonly string[]).includes(row.type)) {
      counts[row.type as FunnelEventType] = row.count;
    }
  }
  return counts;
}

// Same day-scaffold-then-overlay approach as mergeDailyBuckets above, for
// the visits-over-time chart.
export function mergeDailyPageviews(dbRows: DbPageviewRow[], days: number, now: Date = new Date()): DailyPageviews[] {
  const byDayMap = new Map<string, DailyPageviews>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const date = d.toISOString().slice(0, 10);
    byDayMap.set(date, { date, pageviews: 0 });
  }
  for (const row of dbRows) {
    const bucket = byDayMap.get(row.date);
    if (bucket) bucket.pageviews = row.pageviews;
  }
  return Array.from(byDayMap.values());
}
