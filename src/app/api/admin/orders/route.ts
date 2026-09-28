import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    // Real cursor pagination, not just a cap — this was a full, unlimited
    // findMany across every order on the platform. A cap alone silently
    // hides everything past it with no way to see the rest; this instead
    // returns nextCursor so the admin page can page through the full
    // history via "load more".
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const PAGE_SIZE = 50;

    const orders = await prisma.order.findMany({
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
