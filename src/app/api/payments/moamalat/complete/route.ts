import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMoamalatResponseHash } from "@/lib/payment/moamalat-client";
import { finalizeByMerchantReference } from "@/lib/payment/moamalat-dispatch";

// POST /api/payments/moamalat/complete — called by the browser the moment
// LightBox's own completeCallback fires, relaying whatever fields Moamalat
// handed back (docs.moamalat.net/lightBox.html: TxnDate, SystemReference,
// NetworkReference, MerchantReference, Amount, Currency, PaidThrough,
// PayerAccount, PayerName, ProviderSchemeName, SecureHash) so the customer
// gets an instant "paid" confirmation without waiting for Moamalat's own
// async server notification (/api/moamalat/webhook) to arrive — same
// "whichever confirms first" race the old DPay OTP-verify step handled,
// just triggered by the widget's own callback instead of an OTP form.
//
// This endpoint NEVER trusts the client's word alone — it re-verifies
// SecureHash itself using the server-side secret key before finalizing
// anything, exactly like the webhook does. A forged/tampered payload
// fails verification and changes nothing.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { SecureHash, MerchantReference, SystemReference, NetworkReference, ...rest } = body as Record<string, string | undefined>;
  if (!MerchantReference) {
    return NextResponse.json({ error: "Missing MerchantReference" }, { status: 400 });
  }

  // Hash covers every field Moamalat sent back except SecureHash itself —
  // rebuild that same field set from whatever was actually relayed,
  // rather than hardcoding one fixed list that might not match every
  // real response shape.
  const fieldsToHash: Record<string, string> = { MerchantReference };
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === "string" && value.length > 0) fieldsToHash[key] = value;
  }
  if (SystemReference) fieldsToHash.SystemReference = SystemReference;
  if (NetworkReference) fieldsToHash.NetworkReference = NetworkReference;

  const valid = verifyMoamalatResponseHash(fieldsToHash, SecureHash);
  if (!valid) {
    console.warn(`Moamalat complete-callback: SecureHash verification failed for MerchantReference ${MerchantReference}.`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const outcome = await finalizeByMerchantReference(MerchantReference, "paid");
  if (!outcome) {
    return NextResponse.json({ error: "Unknown MerchantReference" }, { status: 404 });
  }

  if (SystemReference) {
    if (outcome.kind === "order") {
      await prisma.order.update({ where: { id: outcome.id }, data: { moamalatSystemReference: SystemReference, moamalatNetworkReference: NetworkReference ?? null } });
    } else {
      await prisma.payment.update({ where: { id: outcome.id }, data: { moamalatSystemReference: SystemReference, moamalatNetworkReference: NetworkReference ?? null } });
    }
  }

  return NextResponse.json(
    outcome.kind === "order"
      ? { status: "paid", kind: "order", trackingId: outcome.result.trackingId, courier: outcome.result.courier }
      : { status: "paid", kind: "subscription" }
  );
}
