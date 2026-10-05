import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import {
  clampAnalyticsDays,
  buildFunnelCounts,
  mergeDailyPageviews,
  type DbFunnelRow,
  type DbDeviceRow,
  type DbReferrerRow,
  type DbPageviewRow,
} from "@/lib/analytics";

export type AnalyticsEventsByStoreDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  queryFunnel: (storeId: string, since: Date) => Promise<DbFunnelRow[]>;
  queryDeviceBreakdown: (storeId: string, since: Date) => Promise<DbDeviceRow[]>;
  queryTopReferrers: (storeId: string, since: Date) => Promise<DbReferrerRow[]>;
  queryDailyPageviews: (storeId: string, since: Date) => Promise<DbPageviewRow[]>;
};

// GET /api/analytics/events-by-store/:storeId?days=30 — the event-based
// sibling to /api/analytics/by-store (which stays order-derived and
// unchanged): funnel stage counts, device breakdown, top referrers, and
// visits-over-time, all aggregated in Postgres via GROUP BY (see
// route.ts for the real $queryRaw calls) rather than pulling every event
// row into app memory — same reasoning as the order-derived endpoint's
// own load-test-driven rewrite.
export async function handleAnalyticsEventsByStore(db: AnalyticsEventsByStoreDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

  const url = new URL(req.url);
  const days = clampAnalyticsDays(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [funnelRows, deviceRows, referrerRows, pageviewRows] = await Promise.all([
    db.queryFunnel(storeId, since),
    db.queryDeviceBreakdown(storeId, since),
    db.queryTopReferrers(storeId, since),
    db.queryDailyPageviews(storeId, since),
  ]);

  return NextResponse.json({
    funnel: buildFunnelCounts(funnelRows),
    deviceBreakdown: deviceRows,
    topReferrers: referrerRows,
    visitsOverTime: mergeDailyPageviews(pageviewRows, days),
  });
}
