import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

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
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { storeId, createdAt: { gte: since } },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });

  const byDayMap = new Map<string, { orders: number; revenueCents: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
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

  const productTotals = new Map<string, { name: string; quantity: number; revenueCents: number }>();
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

  return NextResponse.json({
    byDay: Array.from(byDayMap.entries()).map(([date, v]) => ({ date, ...v })),
    topProducts,
  });
}
