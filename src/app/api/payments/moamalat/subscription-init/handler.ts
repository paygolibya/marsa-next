import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { subscriptionPeriods, type SubscriptionPeriod } from "@/lib/checkout-features";
import { buildLightboxConfig, getLightboxScriptUrl, isMoamalatConfigured, makeSubscriptionReference } from "@/lib/payment/moamalat-client";

export type SubscriptionInitDb = {
  payment: {
    create: (args: {
      data: { merchantId: string; tier: string; periodMonths: number; amount: number; currency: string; status: string; method: string };
    }) => Promise<{ id: string }>;
  };
};

// POST /api/payments/moamalat/subscription-init — { period } (Bearer
// auth). Creates a pending Payment row for the merchant's own
// subscription fee and returns the signed LightBox config the browser
// needs to call Lightbox.Checkout.showLightbox() itself — replaces the
// old DPay session-open call. Activation happens later, via either
// /api/payments/moamalat/complete (the widget's own completeCallback,
// relayed) or /api/moamalat/webhook (Moamalat's server notification) —
// never here. buildLightboxConfig/subscriptionPeriods are pure and already
// covered elsewhere (moamalat-client.test.ts, checkout-features.test.ts) —
// this handler's own job is auth gating, period validation, and the
// pending-payment DB write, so only `db` needs to be injectable.
export async function handleSubscriptionInit(db: SubscriptionInitDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  if (!isMoamalatConfigured()) {
    return NextResponse.json({ error: "الدفع الإلكتروني غير مفعّل حاليًا" }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const period = body?.period;
    if (period !== "1m" && period !== "3m" && period !== "12m") {
      return NextResponse.json({ error: "مدة اشتراك غير صالحة" }, { status: 400 });
    }

    const plan = subscriptionPeriods[period as SubscriptionPeriod];
    const amountCents = plan.totalPriceLYD * 100;

    const payment = await db.payment.create({
      data: { merchantId, tier: "standard", periodMonths: plan.months, amount: plan.totalPriceLYD, currency: "LYD", status: "pending", method: "moamalat" },
    });

    const lightbox = buildLightboxConfig(amountCents, makeSubscriptionReference(payment.id));

    return NextResponse.json({ paymentId: payment.id, lightbox, moamalatScriptUrl: getLightboxScriptUrl() });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
