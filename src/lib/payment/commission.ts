import { prisma } from "@/lib/prisma";

// Rifqa's cut of each eligible order. 0.03 = 3%.
export const COMMISSION_RATE = 0.03;

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

export type EligibleOrder = Awaited<ReturnType<typeof findEligibleOrders>>[number];

/**
 * The set of orders Rifqa can actually pay a merchant out for.
 *
 * Only wallet (DPay) orders that actually settled are eligible — COD cash
 * is collected by the courier directly from the buyer and never touches
 * Rifqa's account (paymentStatus for COD orders never flips to "paid"
 * anywhere in this codebase; see src/app/api/orders/route.ts), so there is
 * nothing to pay a merchant out of for a COD order through this system.
 * `commission: null` excludes orders already claimed by a previous
 * calculation run — the Commission.orderId unique constraint is the hard
 * guard against double-paying the same order even under a race.
 */
export async function findEligibleOrders(periodStart: Date, periodEnd: Date) {
  return prisma.order.findMany({
    where: {
      status: "delivered",
      paymentMethod: "wallet",
      paymentStatus: "paid",
      courierStatusAt: { gte: periodStart, lte: periodEnd },
      commission: null,
    },
    include: { store: { select: { merchantId: true, merchant: { select: { name: true } } } } },
  });
}
