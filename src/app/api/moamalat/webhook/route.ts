import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMoamalatResponseHash } from "@/lib/payment/moamalat-client";
import { finalizeByMerchantReference } from "@/lib/payment/moamalat-dispatch";

// POST /api/moamalat/webhook — Moamalat's server-to-server notification of
// a transaction's terminal state (docs.moamalat.net/notification.html).
// The sole authoritative confirmation source for a customer who closes
// the tab right after paying — a safety net alongside the client-relayed
// /api/payments/moamalat/complete call, same "whichever confirms first
// wins" atomic-guard pattern as the old DPay webhook.
//
// Fields per the docs (exact casing): MerchantId, TerminalId,
// DateTimeLocalTrxn, SecureHash, TxnType, Message, PaidThrough,
// SystemReference, NetworkReference, MerchantReference, Amount, Currency,
// PayerAccount, PayerName, ActionCode. The hash covers exactly
// DateTimeLocalTrxn, MerchantId, TerminalId, Amount, Currency — NOT
// MerchantReference, unlike the request-signing hash.
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

export async function POST(req: Request) {
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

  const valid = verifyMoamalatResponseHash(
    {
      DateTimeLocalTrxn,
      MerchantId,
      TerminalId,
      Amount: String(Amount),
      Currency,
    },
    SecureHash
  );
  if (!valid) {
    console.warn("Moamalat webhook: SecureHash verification failed — rejecting.");
    return NextResponse.json({ Message: "Invalid signature", Success: false }, { status: 401 });
  }

  if (!MerchantReference) {
    // A notification with no reference we ever sent — nothing in our
    // system to update, but the signature was valid, so acknowledge it
    // rather than making Moamalat retry forever.
    return NextResponse.json({ Message: "Success", Success: true });
  }

  try {
    // TxnType/Message aren't consistently documented enough to branch on
    // reliably — a valid, correctly-signed notification for a reference we
    // recognize is treated as a paid confirmation, matching how the old
    // DPay webhook's "payment.paid" case worked. A failed/expired attempt
    // never reaches this codebase at all (Moamalat only notifies on
    // completed transactions per their docs), so there's no "failed" case
    // to route here.
    const outcome = await finalizeByMerchantReference(MerchantReference, "paid");
    if (outcome && SystemReference) {
      if (outcome.kind === "order") {
        await prisma.order.update({ where: { id: outcome.id }, data: { moamalatSystemReference: SystemReference, moamalatNetworkReference: NetworkReference ?? null } });
      } else {
        await prisma.payment.update({ where: { id: outcome.id }, data: { moamalatSystemReference: SystemReference, moamalatNetworkReference: NetworkReference ?? null } });
      }
    }
  } catch (error) {
    console.error(`Moamalat webhook: failed to process MerchantReference ${MerchantReference}:`, error);
    return NextResponse.json({ Message: "Internal error", Success: false }, { status: 500 });
  }

  return NextResponse.json({ Message: "Success", Success: true });
}
