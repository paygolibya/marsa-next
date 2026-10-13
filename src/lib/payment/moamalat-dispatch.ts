import { parseMerchantReference } from "@/lib/payment/moamalat-client";
import { finalizeWalletOrder } from "@/lib/payment/moamalat-order";
import { finalizeSubscriptionPayment } from "@/lib/payment/moamalat-subscription";

// Shared by both the client-relayed complete endpoint
// (/api/payments/moamalat/complete) and Moamalat's own server
// notification (/api/moamalat/webhook) — one MerchantReference format,
// one place that decides which of the two real finalize functions it
// actually points at. gatewayAmountCents is required (not threaded
// through as optional) specifically so neither finalize function can be
// called without it — see finalizeWalletOrder's own comment for what it
// protects against.
export async function finalizeByMerchantReference(merchantReference: string, outcome: "paid" | "failed", gatewayAmountCents: number) {
  const parsed = parseMerchantReference(merchantReference);
  if (!parsed) return null;

  if (parsed.kind === "order") {
    return { kind: "order" as const, id: parsed.id, result: await finalizeWalletOrder(parsed.id, outcome, gatewayAmountCents) };
  }
  return { kind: "subscription" as const, id: parsed.id, result: await finalizeSubscriptionPayment(parsed.id, outcome, gatewayAmountCents) };
}
