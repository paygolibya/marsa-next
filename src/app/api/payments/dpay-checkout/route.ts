import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { dpaySubscriptionCheckoutSchema } from "@/lib/validation";
import { subscriptionPlans } from "@/lib/checkout-features";
import { openDpaySession, DpayApiError } from "@/lib/payment/dpay-client";
import { finalizeSubscriptionPayment } from "@/lib/payment/dpay-subscription";

// POST /api/payments/dpay-checkout — { tier, dpayPayMethod, ... } (Bearer
// auth). Opens a real DPay session for the merchant's own subscription fee
// — the automatic counterpart to the manual receipt-upload flow
// (/api/payments/upload-receipt): same Payment row, same eventual
// activation (src/lib/payment/dpay-subscription.ts mirrors
// /api/admin/payments/[id]/approve exactly), just confirmed by DPay
// instead of an admin.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = dpaySubscriptionCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { tier, dpayPayMethod, dpayCustomerMobile, dpayBirthYear, dpayCardNumber } = parsed.data;

    const plan = subscriptionPlans[tier];
    const amountCents = plan.price * 100; // Payment.amount is whole LYD; DPay's client takes cents like everywhere else

    const payment = await prisma.payment.create({
      data: { merchantId, tier, amount: plan.price, currency: "LYD", status: "pending", method: "dpay" },
    });

    let session;
    try {
      session = await openDpaySession({
        payMethod: dpayPayMethod,
        totalCents: amountCents,
        data: { payment_id: payment.id },
        customerMobile: dpayCustomerMobile,
        birthYear: dpayBirthYear,
        cardNumber: dpayCardNumber,
      });
    } catch (err) {
      const message = err instanceof DpayApiError ? err.message : "تعذّر بدء الدفع الإلكتروني";
      console.error(`DPay subscription session open failed for payment ${payment.id}:`, err);
      // Leave the Payment row as "pending" (bank transfer still possible) rather than deleting it.
      return NextResponse.json({ error: message, paymentId: payment.id }, { status: 502 });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { dpaySessionId: String(session.sessionId), dpayPayMethod, dpayFeeCents: session.feeCents },
    });

    if (session.status === "paid") {
      // Mock mode (no DPAY_API_TOKEN) resolves instantly — activate now,
      // same as the webhook/verify path would.
      await finalizeSubscriptionPayment(payment.id, "paid");
      return NextResponse.json({ paymentId: payment.id, status: "paid" });
    }

    return NextResponse.json({
      paymentId: payment.id,
      status: "pending",
      dpay: {
        sessionId: session.sessionId,
        payMethod: dpayPayMethod,
        requiresOtp: dpayPayMethod !== "moamalat",
        paymentLink: session.paymentLink,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
