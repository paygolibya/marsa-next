import { prisma } from "@/lib/prisma";

// Rifqa's cut of each eligible order. 0.01 = 1%.
export const COMMISSION_RATE = 0.01;

export function calculateCommission(orderTotalCents: number): {
  rifqaCommissionCents: number;
  merchantPayoutCents: number;
} {
  const rifqaCommissionCents = Math.round(orderTotalCents * COMMISSION_RATE);
  return {
    rifqaCommissionCents,
    merchantPayoutCents: orderTotalCents - rifqaCommissionCents,
  };
}

/**
 * Whether an order is eligible to have a commission calculated for it.
 *
 * Only wallet (DPay) orders that actually settled are eligible — COD cash
 * is collected by the courier directly from the buyer and never touches
 * Rifqa's account (paymentStatus for COD orders never flips to "paid"
 * anywhere in this codebase; see src/app/api/orders/route.ts), so there is
 * nothing to pay a merchant out of for a COD order through this system.
 */
export function isOrderEligibleForCommission(order: { status: string; paymentMethod: string; paymentStatus: string }): boolean {
  return order.status === "delivered" && order.paymentMethod === "wallet" && order.paymentStatus === "paid";
}

export type EligibleOrder = Awaited<ReturnType<typeof findRecentEligibleOrders>>[number];

/**
 * Orders delivered within the last `hours` that don't have a Commission
 * row yet — the daily cron's catch-up set, for orders the real-time
 * webhook trigger missed (failed send, order delivered outside a Vanex
 * webhook, etc). `commission: null` is a belt-and-suspenders check; the
 * actual guard against double-calculating is the orderId unique
 * constraint on Commission, enforced even under a race.
 */
export async function findRecentEligibleOrders(hours: number) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return prisma.order.findMany({
    where: {
      status: "delivered",
      paymentMethod: "wallet",
      paymentStatus: "paid",
      courierStatusAt: { gte: since },
      commission: null,
    },
    include: { store: { select: { merchantId: true, merchant: { select: { name: true } } } } },
  });
}
