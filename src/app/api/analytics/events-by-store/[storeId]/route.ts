import { prisma } from "@/lib/prisma";
import type { DbFunnelRow, DbDeviceRow, DbReferrerRow, DbPageviewRow } from "@/lib/analytics";
import { handleAnalyticsEventsByStore, type AnalyticsEventsByStoreDb } from "./handler";

// Four GROUP BY queries instead of pulling every event row into app
// memory — same ::int-cast reasoning as the order-derived endpoint's own
// $queryRaw calls: Postgres COUNT returns bigint, which Prisma's raw-query
// results surface as JS bigint, and NextResponse.json() can't serialize
// that (throws).
const db: AnalyticsEventsByStoreDb = {
  store: prisma.store,
  queryFunnel: (storeId, since) =>
    prisma.$queryRaw<DbFunnelRow[]>`
      SELECT type, COUNT(*)::int as count
      FROM analytics_events
      WHERE store_id = ${storeId} AND created_at >= ${since}
      GROUP BY type
    `,
  queryDeviceBreakdown: (storeId, since) =>
    prisma.$queryRaw<DbDeviceRow[]>`
      SELECT device, COUNT(*)::int as count
      FROM analytics_events
      WHERE store_id = ${storeId} AND type = 'pageview' AND created_at >= ${since}
      GROUP BY device
    `,
  queryTopReferrers: (storeId, since) =>
    prisma.$queryRaw<DbReferrerRow[]>`
      SELECT referrer, COUNT(*)::int as count
      FROM analytics_events
      WHERE store_id = ${storeId} AND type = 'pageview' AND created_at >= ${since} AND referrer IS NOT NULL
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 5
    `,
  queryDailyPageviews: (storeId, since) =>
    prisma.$queryRaw<DbPageviewRow[]>`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as pageviews
      FROM analytics_events
      WHERE store_id = ${storeId} AND type = 'pageview' AND created_at >= ${since}
      GROUP BY date
    `,
};

// GET /api/analytics/events-by-store/:storeId — see handler.ts for the
// actual logic (injectable there so it can be integration-tested with
// fakes; handler.test.ts).
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return handleAnalyticsEventsByStore(db, req, storeId);
}
