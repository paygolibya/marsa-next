import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { subscriptionPeriods, type SubscriptionPeriod } from "@/lib/checkout-features";
import { isDpayConfigured, makeSubscriptionReference } from "@/lib/payment/dpay-client";

export type SubscriptionInitDb = {
  payment: {
    create: (args: {
      data: { merchantId: string; tier: string; periodMonths: number; amount: number; currency: string; status: string; method: string };
    }) => Promise<{ id: string }>;
    update: (args: {
      where: { id: string };
      data: { dpaySessionId: string; dpayPayMethod: string; dpayFeeCents: number };
    }) => Promise<unknown>;
  };
};

export type SubscriptionInitDeps = {
  db: SubscriptionInitDb;
  openDpaySession: (amountCents: number, ref: string, idempotencyKey: string) => Promise<{ sessionId: number; paymentLink: string; feeCents: number; expiresAt: string }>;
};

// POST /api/payments/dpay/subscription-init — { period } (Bearer auth).
// Creates a pending Payment row for the merchant's own subscription fee,
// opens a DPay `moamalat` session for it, and returns the hosted
// payment_link the browser redirects/opens to. Activation happens later,
// only via /api/dpay/webhook (DPay's signed server notification) —
// never here. The old client-relayed completion callback doesn't exist
// in this flow (no embedded widget to fire a JS callback from a
// full-page redirect/new-tab).
export async function handleSubscriptionInit(deps: SubscriptionInitDeps, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  if (!isDpayConfigured()) {
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

    const payment = await deps.db.payment.create({
      data: { merchantId, tier: "standard", periodMonths: plan.months, amount: plan.totalPriceLYD, currency: "LYD", status: "pending", method: "moamalat" },
    });

    const session = await deps.openDpaySession(amountCents, makeSubscriptionReference(payment.id), payment.id);
    await deps.db.payment.update({
      where: { id: payment.id },
      data: { dpaySessionId: String(session.sessionId), dpayPayMethod: "moamalat", dpayFeeCents: session.feeCents },
    });

    return NextResponse.json({ paymentId: payment.id, dpayPaymentLink: session.paymentLink, dpaySessionExpiresAt: session.expiresAt });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
