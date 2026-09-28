import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";

type OrderRow = { id: string; createdAt: Date; items: unknown[] };

export type OrdersByStoreDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  order: {
    findMany: (args: {
      where: { storeId: string };
      orderBy: { createdAt: "desc" };
      include: { items: true };
      take: 1000;
    }) => Promise<OrderRow[]>;
  };
};

// GET /api/orders/by-store/:storeId — merchant view: see orders for one of
// their stores (needs auth). Capped as a scale safety net — see
// admin/orders for the same reasoning.
export async function handleOrdersByStore(db: OrdersByStoreDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

    const orders = await db.order.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
      take: 1000,
    });

    return NextResponse.json(orders);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
