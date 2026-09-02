import { NextResponse } from "next/server";
import { verifyDpayWebhookSignature } from "@/lib/payment/dpay-webhook";
import { finalizeWalletOrder } from "@/lib/payment/dpay-order";
import { finalizeSubscriptionPayment } from "@/lib/payment/dpay-subscription";

// POST /api/dpay/webhook — DPay's signed, retried notification of a
// payment's terminal state. The sole authoritative confirmation for
// Moamalat sessions (which have no OTP-verify step at all), and a
// safety net for every other method in case the buyer/merchant closes
// the tab right after entering their OTP.
//
// Handles two entirely different kinds of session, told apart by which
// key is present in `data` (see openDpaySession's `data` param): a store
// order (data.order_id) or a merchant's own subscription payment
// (data.payment_id) — one DPay account, one webhook URL, both flows
// funnel through here.
//
// Must read the raw body before any JSON parsing — the HMAC is computed
// over the exact bytes DPay sent, and re-serializing a parsed object can
// silently reorder keys and break the signature.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-dpay-timestamp");
  const signature = req.headers.get("x-dpay-signature");
  const secret = process.env.DPAY_WEBHOOK_SECRET;

  if (!secret) {
    console.warn("DPAY_WEBHOOK_SECRET is not set — rejecting DPay webhook (cannot verify signature).");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!verifyDpayWebhookSignature(rawBody, timestamp, signature, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { event?: string; live?: boolean; data?: { order_id?: string; payment_id?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = payload.data?.order_id;
  const paymentId = payload.data?.payment_id;
  if (!orderId && !paymentId) {
    // webhook.test, or a session opened without our correlation metadata
    // (e.g. an invoice payment link) — nothing in our system to update.
    return NextResponse.json({ success: true });
  }
  const finalize = (outcome: "paid" | "failed") =>
    orderId ? finalizeWalletOrder(orderId, outcome) : finalizeSubscriptionPayment(paymentId!, outcome);
  const subjectLabel = orderId ? `order ${orderId}` : `subscription payment ${paymentId}`;

  try {
    switch (payload.event) {
      case "payment.paid":
        await finalize("paid");
        break;
      case "payment.failed":
      case "payment.expired":
        await finalize("failed");
        break;
      case "payment.refunded":
      case "payment.voided":
        // No automated refund/shipment-cancellation (orders) or
        // subscription-deactivation (payments) flow yet — see "Known
        // limitations" in docs/dpay.md. Logged for manual follow-up.
        console.warn(`DPay webhook: ${payload.event} for ${subjectLabel} — needs manual review, no automatic handling.`);
        break;
      default:
        console.warn(`DPay webhook: unhandled event "${payload.event}" for ${subjectLabel}`);
    }
  } catch (error) {
    // A genuine failure here (DB error, bug) is worth DPay's retry — up to
    // 5 attempts with backoff — so this deliberately does NOT swallow to a
    // 200 the way the Vanex webhook's per-package loop does; there's no
    // "one bad item in a batch" concern here, just one event to get right.
    console.error(`DPay webhook: failed to process ${subjectLabel}:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
