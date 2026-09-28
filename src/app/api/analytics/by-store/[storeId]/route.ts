import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { clampAnalyticsDays, mergeDailyBuckets, pickTopProducts, type DbDailyRow, type DbProductRow } from "@/lib/analytics";

// GET /api/analytics/by-store/:storeId?days=30 — orders/revenue over time +
// top products.
//
// Was: fetch every order (with every item) in the window and aggregate in
// JS — reasonable at the volumes this codebase actually had, until a real
// load test (scripts/load-test.mjs, seeded to 30k orders on one store)
// measured this at 2+ seconds. Now aggregates in Postgres via two GROUP BY
// queries instead of pulling every row into app memory — the ::int casts
// matter: Postgres COUNT/SUM return bigint, which Prisma's raw-query
// results surface as JS `bigint`, and `NextResponse.json()` can't
// serialize that at all (throws), so this isn't just a style choice.
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const { storeId } = await params;
  const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

  const url = new URL(req.url);
  const days = clampAnalyticsDays(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [dailyRows, productRows] = await Promise.all([
    prisma.$queryRaw<DbDailyRow[]>`
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date,
             COUNT(*)::int as orders,
             SUM(total_cents)::int as "revenueCents"
      FROM orders
      WHERE store_id = ${storeId} AND created_at >= ${since}
      GROUP BY date
    `,
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
  ]);

  const byDay = mergeDailyBuckets(dailyRows, days);
  const topProducts = pickTopProducts(productRows);

  return NextResponse.json({ byDay, topProducts });
}
