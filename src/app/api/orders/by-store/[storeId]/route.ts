import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

// GET /api/orders/by-store/:storeId — merchant view: see orders for one of
// their stores (needs auth).
// Ported from marsa-backend/src/routes/orders.js (GET /by-store/:storeId).
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { storeId } = await params;
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

    // Capped as a scale safety net — see admin/orders for the same
    // reasoning. The new (storeId, createdAt) index makes this query itself
    // cheap; the cap bounds the response size/render cost once a single
    // store has thousands of orders. A real paginated order list is a
    // separate, larger UI feature.
    const orders = await prisma.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
      take: 1000,
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
