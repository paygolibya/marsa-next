import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { verifyDpaySession, DpayApiError } from "@/lib/payment/dpay-client";
import { finalizeSubscriptionPayment } from "@/lib/payment/dpay-subscription";

// POST /api/payments/dpay-verify-otp — { paymentId, otp } (Bearer auth,
// must be the same merchant who owns the payment). Mirrors
// /api/dpay/verify-otp's design exactly: relays whatever DPay says back
// to the caller for immediate feedback, but never itself decides the
// payment succeeded — only finalizeSubscriptionPayment does that, shared
// with the webhook, so whichever confirms first wins and the other is a
// safe no-op. Same reasoning as that route for not recording a "failed"
// state here: DPay's per-gateway retryable errors (wrong PIN, etc.)
// aren't distinguishable from a truly dead session at this layer.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const paymentId = typeof body.paymentId === "string" ? body.paymentId : null;
    const otp = typeof body.otp === "string" ? body.otp : null;
    if (!paymentId || !otp) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.merchantId !== merchantId || payment.method !== "dpay" || !payment.dpaySessionId) {
      return NextResponse.json({ error: "الدفعة غير صالحة" }, { status: 404 });
    }
    if (payment.dpayPayMethod === "moamalat") {
      return NextResponse.json({ error: "لا حاجة لرمز تحقق مع هذه الطريقة" }, { status: 400 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ status: payment.status });
    }

    const result = await verifyDpaySession({ sessionId: Number(payment.dpaySessionId), otp });

    if (result.status === "paid") {
      await finalizeSubscriptionPayment(payment.id, "paid");
      return NextResponse.json({ status: "paid" });
    }
    return NextResponse.json({ status: result.status });
  } catch (err) {
    if (err instanceof DpayApiError) {
      console.warn("DPay subscription verify-otp rejected:", err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("DPay subscription verify-otp failed unexpectedly:", err);
    return NextResponse.json({ error: "تعذّر التحقق من رمز الدفع" }, { status: 502 });
  }
}
