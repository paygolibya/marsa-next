import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import { clampAnalyticsDays, mergeDailyBuckets, pickTopProducts, type DbDailyRow, type DbProductRow } from "@/lib/analytics";

export type AnalyticsByStoreDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  queryDaily: (storeId: string, since: Date) => Promise<DbDailyRow[]>;
  queryTopProducts: (storeId: string, since: Date) => Promise<DbProductRow[]>;
};

// GET /api/analytics/by-store/:storeId?days=30 — orders/revenue over time +
// top products. Aggregates in Postgres via two GROUP BY queries instead of
// pulling every row into app memory — see route.ts for the real $queryRaw
// calls this wraps; kept as two named functions here (queryDaily/
// queryTopProducts) rather than a single injected $queryRaw, since faking
// a real tagged-template-literal function is far more awkward than faking
// two plain functions with the same real inputs/outputs.
export async function handleAnalyticsByStore(db: AnalyticsByStoreDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

  const url = new URL(req.url);
  const days = clampAnalyticsDays(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [dailyRows, productRows] = await Promise.all([db.queryDaily(storeId, since), db.queryTopProducts(storeId, since)]);

  const byDay = mergeDailyBuckets(dailyRows, days);
  const topProducts = pickTopProducts(productRows);

  return NextResponse.json({ byDay, topProducts });
}
