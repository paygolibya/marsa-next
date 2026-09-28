import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type OrderRow = { id: string; createdAt: Date; store: unknown };

export type ListOrdersDb = {
  order: {
    findMany: (args: {
      include: { store: true };
      orderBy: { createdAt: "desc" };
      take: number;
      cursor?: { id: string };
      skip?: number;
    }) => Promise<OrderRow[]>;
  };
};

const PAGE_SIZE = 50;

// GET /api/admin/orders — real cursor pagination, not just a cap — this
// was a full, unlimited findMany across every order on the platform. A
// cap alone silently hides everything past it with no way to see the
// rest; this instead returns nextCursor so the admin page can page
// through the full history via "load more".
export async function handleListOrders(db: ListOrdersDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");

    const orders = await db.order.findMany({
      include: { store: true },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = orders.length === PAGE_SIZE ? orders[orders.length - 1].id : null;

    return NextResponse.json({ orders, nextCursor });
  } catch (error) {
    console.error("Error fetching orders:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
