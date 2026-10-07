import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { buildLightboxConfig, getLightboxScriptUrl, isMoamalatConfigured, makeOrderReference } from "@/lib/payment/moamalat-client";

type OrderRow = {
  id: string;
  totalCents: number;
  shippingCents: number;
  paymentMethod: string;
  paymentStatus: string;
  store: { slug: string };
};

export type PayConfigDb = {
  order: {
    findUnique: (args: {
      where: { id: string };
      select: { id: true; totalCents: true; shippingCents: true; paymentMethod: true; paymentStatus: true; store: { select: { slug: true } } };
    }) => Promise<OrderRow | null>;
  };
};

// GET /api/payments/moamalat/pay-config/:orderId — public, no auth. Lets
// the apex-domain pay page (src/app/pay/[orderId]) rebuild the exact same
// signed LightBox config /api/orders already built at order-creation time,
// given just the orderId — needed because Moamalat's domain whitelist
// rejects buyer checkout on a store's own {slug}.rifqa.ly subdomain (see
// docs/moamalat.md's "Invalid Domain" note), so the widget now has to run
// from the bare apex domain instead, a separate page load that doesn't
// carry the original /api/orders response with it. Trust level matches
// the confirmation page's own existing orderId-only lookup (no phone/
// auth required there either) — the orderId itself (a cuid) is the only
// thing needed, same as it always was for viewing this order's own total.
export async function handleGetPayConfig(db: PayConfigDb, orderId: string): Promise<Response> {
  if (!isMoamalatConfigured()) {
    return NextResponse.json({ error: "الدفع الإلكتروني غير مفعّل حاليًا" }, { status: 503 });
  }

  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { id: true, totalCents: true, shippingCents: true, paymentMethod: true, paymentStatus: true, store: { select: { slug: true } } },
    });
    if (!order) return NextResponse.json({ error: "الطلب غير موجود" }, { status: 404 });
    if (order.paymentMethod !== "wallet") {
      return NextResponse.json({ error: "هذا الطلب لا يستخدم الدفع الإلكتروني" }, { status: 400 });
    }
    if (order.paymentStatus === "paid") {
      return NextResponse.json({ error: "تم دفع هذا الطلب بالفعل" }, { status: 400 });
    }

    const moamalat = buildLightboxConfig(order.totalCents, makeOrderReference(order.id));

    return NextResponse.json({
      storeSlug: order.store.slug,
      totalCents: order.totalCents,
      shippingCents: order.shippingCents,
      moamalat,
      moamalatScriptUrl: getLightboxScriptUrl(),
    });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
