import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isDpayWebhookConfigured, verifyDpayWebhookSignature } from "@/lib/payment/dpay-client";

type DpayWebhookPayload = {
  event?: string;
  live?: boolean;
  session_id?: number;
  status?: string;
  amount?: number;
  pay_method?: string;
  tx_id?: string;
  system_reference?: string | null;
  network_reference?: string | null;
  data?: { ref?: string } & Record<string, unknown>;
};

// Maps every documented terminal event to the two-state outcome
// finalizeByMerchantReference understands. `null` means "acknowledge,
// don't touch any payment/order row" — webhook.test (the dashboard's
// "send test event" button) and anything not in this list (forward
// compatibility with a future event type) both land here.
const EVENT_OUTCOME: Record<string, "paid" | "failed" | null> = {
  "payment.paid": "paid",
  "payment.failed": "failed",
  "payment.expired": "failed",
  "payment.voided": "failed",
  "payment.refunded": "failed",
  "webhook.test": null,
};

export type DpayWebhookDeps = {
  db: {
    order: { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> };
    payment: { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> };
  };
  finalizeByMerchantReference: (
    ref: string,
    outcome: "paid" | "failed"
  ) => Promise<{ kind: "order" | "subscription"; id: string; result: unknown } | null>;
};

// POST /api/dpay/webhook — DPay's signed server-to-server notification of
// a `moamalat` payment session reaching a terminal state. The sole
// authoritative confirmation source now that there's no embedded widget
// to relay a browser-side completion callback from (the old
// /api/payments/moamalat/complete is gone). Arguably the single most
// security-sensitive route in the app — a forged notification here would
// mark unpaid orders as paid — so signature verification and
// event-routing get real test coverage, and the route fails CLOSED
// (rejects everything) if DPAY_WEBHOOK_SECRET isn't configured yet,
// rather than ever skipping verification.
export async function handleDpayWebhook(deps: DpayWebhookDeps, req: Request): Promise<Response> {
  const rawBody = await req.text();

  if (!isDpayWebhookConfigured()) {
    console.error("DPay webhook: DPAY_WEBHOOK_SECRET is not configured — rejecting all requests until it is.");
    return NextResponse.json({ message: "Webhook not configured", success: false }, { status: 500 });
  }

  const timestamp = req.headers.get("x-dpay-timestamp");
  const signature = req.headers.get("x-dpay-signature");
  const validSignature = verifyDpayWebhookSignature(timestamp, rawBody, signature);
  if (!validSignature) {
    console.warn("DPay webhook: signature verification failed — rejecting.");
    return NextResponse.json({ message: "Invalid signature", success: false }, { status: 401 });
  }

  let body: DpayWebhookPayload;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON", success: false }, { status: 400 });
  }

  const { event, data, system_reference: systemReference, network_reference: networkReference } = body;
  const outcome = event ? EVENT_OUTCOME[event] : undefined;
  if (outcome === undefined || outcome === null) {
    // webhook.test, or an event type this route doesn't (yet) recognize —
    // acknowledged so DPay doesn't retry it, but nothing to finalize.
    return NextResponse.json({ message: "Success", success: true });
  }

  const ref = data?.ref;
  if (!ref) {
    return NextResponse.json({ message: "Success", success: true });
  }

  try {
    const finalized = await deps.finalizeByMerchantReference(ref, outcome);
    if (finalized && (systemReference || networkReference)) {
      const referenceData = { moamalatSystemReference: systemReference ?? null, moamalatNetworkReference: networkReference ?? null };
      if (finalized.kind === "order") {
        await deps.db.order.update({ where: { id: finalized.id }, data: referenceData });
      } else {
        await deps.db.payment.update({ where: { id: finalized.id }, data: referenceData });
      }
    }
  } catch (error) {
    console.error(`DPay webhook: failed to process ref ${ref}:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ message: "Internal error", success: false }, { status: 500 });
  }

  return NextResponse.json({ message: "Success", success: true });
}
