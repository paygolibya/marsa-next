import { parseMerchantReference } from "@/lib/payment/moamalat-client";
import { finalizeWalletOrder } from "@/lib/payment/moamalat-order";
import { finalizeSubscriptionPayment } from "@/lib/payment/moamalat-subscription";

// Shared by both the client-relayed complete endpoint
// (/api/payments/moamalat/complete) and Moamalat's own server
// notification (/api/moamalat/webhook) — one MerchantReference format,
// one place that decides which of the two real finalize functions it
// actually points at.
export async function finalizeByMerchantReference(merchantReference: string, outcome: "paid" | "failed") {
  const parsed = parseMerchantReference(merchantReference);
  if (!parsed) return null;

  if (parsed.kind === "order") {
    return { kind: "order" as const, id: parsed.id, result: await finalizeWalletOrder(parsed.id, outcome) };
  }
  return { kind: "subscription" as const, id: parsed.id, result: await finalizeSubscriptionPayment(parsed.id, outcome) };
}
