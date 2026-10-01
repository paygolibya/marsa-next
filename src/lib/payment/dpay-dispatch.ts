import { parseMerchantReference } from "@/lib/payment/dpay-client";
import { finalizeWalletOrder } from "@/lib/payment/dpay-order";
import { finalizeSubscriptionPayment } from "@/lib/payment/dpay-subscription";

// Called from the DPay webhook (/api/dpay/webhook) — one reference
// format (echoed back via DPay's `data.ref`), one place that decides
// which of the two real finalize functions it actually points at.
export async function finalizeByMerchantReference(merchantReference: string, outcome: "paid" | "failed") {
  const parsed = parseMerchantReference(merchantReference);
  if (!parsed) return null;

  if (parsed.kind === "order") {
    return { kind: "order" as const, id: parsed.id, result: await finalizeWalletOrder(parsed.id, outcome) };
  }
  return { kind: "subscription" as const, id: parsed.id, result: await finalizeSubscriptionPayment(parsed.id, outcome) };
}
