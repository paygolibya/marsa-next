import { prisma } from "@/lib/prisma";
import type { DbDailyRow, DbProductRow } from "@/lib/analytics";
import { handleAnalyticsByStore, type AnalyticsByStoreDb } from "./handler";

// Was: fetch every order (with every item) in the window and aggregate in
// JS — reasonable at the volumes this codebase actually had, until a real
// load test (scripts/load-test.mjs, seeded to 30k orders on one store)
// measured this at 2+ seconds. Now aggregates in Postgres via two GROUP BY
// queries instead of pulling every row into app memory — the ::int casts
// matter: Postgres COUNT/SUM return bigint, which Prisma's raw-query
// results surface as JS `bigint`, and `NextResponse.json()` can't
// serialize that at all (throws), so this isn't just a style choice.
const db: AnalyticsByStoreDb = {
  store: prisma.store,
  queryDaily: (storeId, since) =>
    prisma.$queryRaw<DbDailyRow[]>`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date,
             COUNT(*)::int as orders,
             SUM(total_cents)::int as "revenueCents"
      FROM orders
      WHERE store_id = ${storeId} AND created_at >= ${since}
      GROUP BY date
    `,
  queryTopProducts: (storeId, since) =>
    prisma.$queryRaw<DbProductRow[]>`
      SELECT oi.product_id as "productId",
             MAX(oi.product_name) as name,
             SUM(oi.quantity)::int as quantity,
             SUM(oi.unit_price_cents * oi.quantity)::int as "revenueCents"
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId} AND o.created_at >= ${since}
      GROUP BY oi.product_id
    `,
};

// GET /api/analytics/by-store/:storeId — see handler.ts for the actual
// logic (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  return handleAnalyticsByStore(db, req, storeId);
}
