import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDpaySession, DpayApiError } from "@/lib/payment/dpay-client";
import { finalizeWalletOrder } from "@/lib/payment/dpay-order";

// POST /api/dpay/verify-otp — { orderId, otp }. No auth: the buyer isn't
// logged in during checkout, same as /api/orders itself. Only the buyer
// who just placed this exact order (and thus knows its id) can call this,
// same trust model as order tracking (src/lib/verify-buyer.ts's sibling).
//
// This never itself decides the order is "paid" in a vacuum — it calls
// DPay's own verify endpoint and only records what DPay actually confirms,
// via the same finalizeWalletOrder the webhook uses. Not used for
// Moamalat sessions at all — those redirect to a hosted page and are
// confirmed exclusively by the webhook.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId : null;
    const otp = typeof body.otp === "string" ? body.otp : null;
    if (!orderId || !otp) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentMethod !== "wallet" || !order.dpaySessionId) {
      return NextResponse.json({ error: "الطلب غير صالح" }, { status: 404 });
    }
    if (order.dpayPayMethod === "moamalat") {
      return NextResponse.json({ error: "لا حاجة لرمز تحقق مع هذه الطريقة" }, { status: 400 });
    }
    if (order.paymentStatus !== "pending") {
      // Already finalized (by a previous verify call or the webhook) — echo
      // the real state rather than calling DPay again for nothing.
      return NextResponse.json({ status: order.paymentStatus });
    }

    const result = await verifyDpaySession({ sessionId: Number(order.dpaySessionId), otp });

    if (result.status === "paid") {
      const outcome = await finalizeWalletOrder(order.id, "paid");
      return NextResponse.json({ status: "paid", trackingId: outcome.trackingId, courier: outcome.courier });
    }
    // Anything other than "paid" here is surfaced to the buyer as feedback
    // only — it does NOT record a failure. DPay's docs list per-gateway
    // retryable errors (e.g. EDFali's "Wrong PIN") that aren't terminal,
    // and never document verify()'s exact non-success response shape, so
    // there's no reliable way to tell "retry with a fresh OTP" apart from
    // "this session is truly dead" from here. Only the webhook's own
    // documented terminal events (payment.failed / payment.expired) ever
    // write a failure — see /api/dpay/webhook.
    return NextResponse.json({ status: result.status });
  } catch (err) {
    // A DpayApiError here is usually just a wrong OTP or similar — an
    // expected, retryable outcome of normal checkout traffic, not a
    // server problem, so it's a 400 and a warn, not a 502/error.
    if (err instanceof DpayApiError) {
      console.warn("DPay verify-otp rejected:", err.message);
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("DPay verify-otp failed unexpectedly:", err);
    return NextResponse.json({ error: "تعذّر التحقق من رمز الدفع" }, { status: 502 });
  }
}
