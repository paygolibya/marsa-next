import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";

type InquiryRow = {
  id: string;
  productId: string | null;
  buyerName: string;
  buyerPhone: string;
  message: string;
  handled: boolean;
  createdAt: Date;
  product: { name: string } | null;
};

export type InquiriesByStoreDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  inquiry: {
    findMany: (args: {
      where: { storeId: string };
      orderBy: { createdAt: "desc" };
      include: { product: { select: { name: true } } };
      take: 1000;
    }) => Promise<InquiryRow[]>;
  };
};

// GET /api/inquiries/by-store/:storeId — merchant view of their store's
// inquiries (showcase stores' equivalent of the orders list). Same
// ownership-check + 1000-row cap pattern as /api/orders/by-store.
export async function handleInquiriesByStore(db: InquiriesByStoreDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not your store" }, { status: 403 });

    const inquiries = await db.inquiry.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      include: { product: { select: { name: true } } },
      take: 1000,
    });

    return NextResponse.json(inquiries);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
