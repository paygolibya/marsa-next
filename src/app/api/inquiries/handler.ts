import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createInquirySchema } from "@/lib/validation";

export type InquiriesDb = {
  store: {
    findUnique: (args: { where: { slug: string }; include: { merchant: true } }) => Promise<{
      id: string;
      merchant: { phone: string };
    } | null>;
  };
  product: { findFirst: (args: { where: { id: string; storeId: string } }) => Promise<{ id: string } | null> };
  inquiry: {
    create: (args: {
      data: { storeId: string; productId: string | null; buyerName: string; buyerPhone: string; message: string };
    }) => Promise<{ id: string }>;
  };
};

export type InquiriesDeps = {
  db: InquiriesDb;
  sendNewInquirySms: (merchantPhone: string, buyerName: string, buyerPhone: string) => Promise<unknown>;
};

// POST /api/inquiries — a buyer on a showcase store (no checkout at all,
// e.g. a car exhibition) sends an inquiry instead of placing an order. No
// auth required, same as /api/orders. Not restricted to store.type ===
// "showcase" server-side — any store can receive one, the storefront UI
// just doesn't surface the "inquire" button for other types.
export async function handleCreateInquiry(deps: InquiriesDeps, req: Request): Promise<Response> {
  const { db } = deps;
  try {
    const body = await req.json();
    const parsed = createInquirySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeSlug, productId, buyerName, buyerPhone, message } = parsed.data;

    const store = await db.store.findUnique({ where: { slug: storeSlug }, include: { merchant: true } });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    // A stale/wrong productId is dropped rather than rejected — the
    // inquiry itself (a buyer trying to reach the merchant) is the part
    // that matters, not a strict product reference.
    let validProductId: string | null = null;
    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, storeId: store.id } });
      if (product) validProductId = product.id;
    }

    const inquiry = await db.inquiry.create({
      data: { storeId: store.id, productId: validProductId, buyerName, buyerPhone, message },
    });

    // Best-effort — merchants have no email on file, so SMS is the only
    // notification channel; a delivery failure never fails the inquiry
    // itself (it's already recorded and visible in the dashboard).
    await deps.sendNewInquirySms(store.merchant.phone, buyerName, buyerPhone);

    return NextResponse.json({ id: inquiry.id }, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
