import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type MerchantRow = { id: string; createdAt: Date; stores: unknown[] };

export type ListMerchantsDb = {
  merchant: {
    findMany: (args: {
      include: { stores: true };
      orderBy: { createdAt: "desc" };
      take: number;
      cursor?: { id: string };
      skip?: number;
    }) => Promise<MerchantRow[]>;
  };
};

const PAGE_SIZE = 100;

// GET /api/admin/merchants — real cursor pagination (see admin/orders for
// the same pattern): a flat cap silently hides every merchant past it with
// no way to reach them; this returns nextCursor so the admin page can page
// through the full list via "load more".
export async function handleListMerchants(db: ListMerchantsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");

    const merchants = await db.merchant.findMany({
      include: { stores: true },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = merchants.length === PAGE_SIZE ? merchants[merchants.length - 1].id : null;

    return NextResponse.json({ merchants, nextCursor });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to fetch merchants" }, { status: 500 });
  }
}
