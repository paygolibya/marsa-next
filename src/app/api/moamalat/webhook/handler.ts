import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyMoamalatResponseHash } from "@/lib/payment/moamalat-client";

// See docs.moamalat.net/notification.html for the field list — the hash
// covers exactly DateTimeLocalTrxn, MerchantId, TerminalId, Amount,
// Currency — NOT MerchantReference, unlike the request-signing hash.
type MoamalatNotification = {
  MerchantId?: string;
  TerminalId?: string;
  DateTimeLocalTrxn?: string;
  SecureHash?: string;
  TxnType?: string;
  Message?: string;
  PaidThrough?: string;
  SystemReference?: string;
  NetworkReference?: string;
  MerchantReference?: string;
  Amount?: string | number;
  Currency?: string;
};

export type MoamalatWebhookDeps = {
  db: {
    order: { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> };
    payment: { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> };
  };
  finalizeByMerchantReference: (
    ref: string,
    outcome: "paid" | "failed"
  ) => Promise<{ kind: "order" | "subscription"; id: string; result: unknown } | null>;
};

// POST /api/moamalat/webhook — Moamalat's server-to-server notification of
// a transaction's terminal state. The sole authoritative confirmation
// source for a customer who closes the tab right after paying — a safety
// net alongside the client-relayed /api/payments/moamalat/complete call,
// same "whichever confirms first wins" atomic-guard pattern as the old
// DPay webhook. See route.ts for why this is injectable — it's the actual
// payment-confirmation path, arguably the single most security-sensitive
// route in the app (a forged notification here would mark unpaid orders
// as paid), so its signature verification and reference-routing logic get
// real test coverage.
export async function handleMoamalatWebhook(deps: MoamalatWebhookDeps, req: Request): Promise<Response> {
  let body: MoamalatNotification;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ Message: "Invalid JSON", Success: false }, { status: 400 });
  }

  const { MerchantId, TerminalId, DateTimeLocalTrxn, SecureHash, Amount, Currency, MerchantReference, SystemReference, NetworkReference } = body;

  if (!MerchantId || !TerminalId || !DateTimeLocalTrxn || !Amount || !Currency) {
    return NextResponse.json({ Message: "Missing required fields", Success: false }, { status: 400 });
  }

  const valid = verifyMoamalatResponseHash({ DateTimeLocalTrxn, MerchantId, TerminalId, Amount: String(Amount), Currency }, SecureHash);
  if (!valid) {
    console.warn("Moamalat webhook: SecureHash verification failed — rejecting.");
    return NextResponse.json({ Message: "Invalid signature", Success: false }, { status: 401 });
  }

  if (!MerchantReference) {
    return NextResponse.json({ Message: "Success", Success: true });
  }

  try {
    const outcome = await deps.finalizeByMerchantReference(MerchantReference, "paid");
    if (outcome && SystemReference) {
      if (outcome.kind === "order") {
        await deps.db.order.update({ where: { id: outcome.id }, data: { moamalatSystemReference: SystemReference, moamalatNetworkReference: NetworkReference ?? null } });
      } else {
        await deps.db.payment.update({ where: { id: outcome.id }, data: { moamalatSystemReference: SystemReference, moamalatNetworkReference: NetworkReference ?? null } });
      }
    }
  } catch (error) {
    console.error(`Moamalat webhook: failed to process MerchantReference ${MerchantReference}:`, error);
    Sentry.captureException(error);
    return NextResponse.json({ Message: "Internal error", Success: false }, { status: 500 });
  }

  return NextResponse.json({ Message: "Success", Success: true });
}
