import { prisma } from "@/lib/prisma";
import { getPlanFeatureFlags } from "@/lib/checkout-features";

const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export type FinalizeSubscriptionPaymentResult = { updated: boolean };

/**
 * The single place a DPay-paid subscription Payment's status is ever
 * written, and the single place it actually activates the merchant's
 * subscription — same shape as finalizeWalletOrder (dpay-order.ts), and
 * for the same reason: called from two independent triggers that can
 * race each other (the merchant completing OTP verification, and DPay's
 * webhook), guarded by the same atomic `status: "pending"` updateMany so
 * whichever confirms first wins and the other is a safe no-op, not a
 * double-activation.
 *
 * Mirrors exactly what an admin's manual approval already does
 * (/api/admin/payments/[id]/approve) — this is the same activation,
 * just automatic instead of requiring a human to click a button.
 */
export async function finalizeSubscriptionPayment(paymentId: string, outcome: "paid" | "failed"): Promise<FinalizeSubscriptionPaymentResult> {
  const guarded = await prisma.payment.updateMany({
    where: { id: paymentId, method: "dpay", status: "pending" },
    data: {
      status: outcome === "paid" ? "approved" : "rejected",
      approvedAt: outcome === "paid" ? new Date() : null,
      rejectionReason: outcome === "paid" ? null : "فشلت عملية الدفع عبر DPay",
    },
  });
  if (guarded.count === 0) return { updated: false };
  if (outcome !== "paid") return { updated: true };

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { updated: true };

  await prisma.merchant.update({
    where: { id: payment.merchantId },
    data: {
      subscriptionTier: payment.tier,
      subscriptionStatus: "active",
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + SUBSCRIPTION_PERIOD_MS),
      ...getPlanFeatureFlags(payment.tier),
    },
  });

  return { updated: true };
}
