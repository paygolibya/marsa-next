import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { buildAnalyticsSummary, clampAnalyticsDays } from "@/lib/analytics";

// GET /api/analytics/by-store/:storeId?days=30 — orders/revenue over time
// + top products, computed in application code (no raw SQL anywhere else
// in this codebase, and data volumes here are single-merchant scale).
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const { storeId } = await params;
  const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

  const url = new URL(req.url);
  const days = clampAnalyticsDays(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { storeId, createdAt: { gte: since } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const { byDay, topProducts } = buildAnalyticsSummary(orders, days);

  return NextResponse.json({ byDay, topProducts });
}
