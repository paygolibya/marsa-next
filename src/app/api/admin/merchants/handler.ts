import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type MerchantRow = {
  id: string;
  name: string;
  phone: string;
  subscriptionTier: string | null;
  subscriptionStatus: string;
  subscriptionEndDate: Date | null;
  trialEndsAt: Date | null;
  createdAt: Date;
  stores: { id: string; name: string; slug: string }[];
};

export type ListMerchantsDb = {
  merchant: {
    findMany: (args: {
      select: {
        id: true;
        name: true;
        phone: true;
        subscriptionTier: true;
        subscriptionStatus: true;
        subscriptionEndDate: true;
        trialEndsAt: true;
        createdAt: true;
        stores: { select: { id: true; name: true; slug: true } };
      };
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

    // Explicit select, never include/no-select — this endpoint used to
    // return every raw merchant column (passwordHash, otpCodeHash
    // included) straight to the client. Found live: a full password-hash
    // dump of every merchant on the platform via this one endpoint.
    const merchants = await db.merchant.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscriptionEndDate: true,
        trialEndsAt: true,
        createdAt: true,
        stores: { select: { id: true, name: true, slug: true } },
      },
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
