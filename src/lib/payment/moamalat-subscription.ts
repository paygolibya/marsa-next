import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getPlanFeatureFlags } from "@/lib/checkout-features";
import { paidPeriodEnd } from "@/lib/subscription/period";

export type FinalizeSubscriptionPaymentResult = { updated: boolean };

/**
 * The single place a Moamalat-paid subscription Payment's status is ever
 * written, and the single place it actually activates the merchant's
 * subscription — same shape as finalizeWalletOrder (moamalat-order.ts),
 * and for the same reason: called from two independent triggers that can
 * race each other (the client-relayed complete callback, and Moamalat's
 * server notification), guarded by the same atomic `status: "pending"`
 * updateMany so whichever confirms first wins and the other is a safe
 * no-op, not a double-activation.
 *
 * Mirrors exactly what an admin's manual approval already does
 * (/api/admin/payments/[id]/approve) — this is the same activation,
 * just automatic instead of requiring a human to click a button.
 *
 * gatewayAmountCents — see finalizeWalletOrder's own comment for why this
 * is required and checked before activating anything. Payment.amount is
 * stored in whole LYD (an existing, separate convention on this one
 * model), hence the ×100 below to compare in cents like everything else.
 */
export async function finalizeSubscriptionPayment(paymentId: string, outcome: "paid" | "failed", gatewayAmountCents: number): Promise<FinalizeSubscriptionPaymentResult> {
  if (outcome === "paid") {
    const expected = await prisma.payment.findUnique({ where: { id: paymentId }, select: { amount: true } });
    if (!expected) return { updated: false };
    if (expected.amount * 100 !== gatewayAmountCents) {
      console.error(`finalizeSubscriptionPayment: amount mismatch for payment ${paymentId} — gateway reported ${gatewayAmountCents}, payment amount is ${expected.amount} LYD. Refusing to approve.`);
      Sentry.captureMessage(`Moamalat amount mismatch for payment ${paymentId}: gateway=${gatewayAmountCents} payment=${expected.amount * 100}`, "error");
      return { updated: false };
    }
  }

  const guarded = await prisma.payment.updateMany({
    where: { id: paymentId, method: "moamalat", status: "pending" },
    data: {
      status: outcome === "paid" ? "approved" : "rejected",
      approvedAt: outcome === "paid" ? new Date() : null,
      rejectionReason: outcome === "paid" ? null : "فشلت عملية الدفع عبر Moamalat",
    },
  });
  if (guarded.count === 0) return { updated: false };
  if (outcome !== "paid") return { updated: true };

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return { updated: true };
  const current = await prisma.merchant.findUnique({ where: { id: payment.merchantId }, select: { subscriptionEndDate: true } });

  await prisma.merchant.update({
    where: { id: payment.merchantId },
    data: {
      subscriptionTier: payment.tier,
      subscriptionPeriodMonths: payment.periodMonths,
      subscriptionStatus: "active",
      subscriptionStartDate: new Date(),
      subscriptionEndDate: paidPeriodEnd(current?.subscriptionEndDate, payment.periodMonths),
      ...getPlanFeatureFlags(payment.tier),
    },
  });

  return { updated: true };
}
