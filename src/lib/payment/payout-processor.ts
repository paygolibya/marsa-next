import { prisma } from "@/lib/prisma";
import { calculateCommission, findRecentEligibleOrders, isOrderEligibleForCommission } from "@/lib/payment/commission";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isUniqueConstraintError(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
}

/**
 * Calculates and stores the commission for a single order, if it's
 * eligible and hasn't been calculated already. Called two ways:
 *  - in real time, from the Vanex webhook the instant an order is marked
 *    delivered (src/app/api/vanex/webhook/route.ts)
 *  - from the daily cron's catch-up pass, for anything the webhook missed
 *
 * Both callers can race on the same order (e.g. a retried webhook
 * delivery overlapping the daily cron) — Commission.orderId is @unique,
 * so a concurrent duplicate always fails with P2002 here and is treated
 * as a no-op, not an error.
 */
export async function calculateCommissionForOrder(
  orderId: string
): Promise<{ created: boolean; reason?: "not_eligible" | "already_calculated" }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { store: { select: { merchantId: true } } },
  });
  if (!order || !isOrderEligibleForCommission(order)) {
    return { created: false, reason: "not_eligible" };
  }

  const { rifqaCommissionCents, merchantPayoutCents } = calculateCommission(order.totalCents);
  const now = new Date();

  try {
    await prisma.$transaction([
      prisma.commission.create({
        data: {
          orderId: order.id,
          merchantId: order.store.merchantId,
          orderTotalCents: order.totalCents,
          rifqaCommissionCents,
          merchantPayoutCents,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: {
          rifqaCommissionCents,
          merchantPayoutCents,
          payoutStatus: "ready_for_transfer",
          payoutCalculatedAt: now,
        },
      }),
    ]);
    return { created: true };
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { created: false, reason: "already_calculated" };
    }
    throw err;
  }
}

export type ProcessDeliveriesResult = {
  ordersProcessed: number;
  payoutsCreated: number;
  errors: string[];
};

/** Daily cron (8am) — catch-up pass over orders delivered in the last 24h. */
export async function processRecentDeliveries(hours = 24): Promise<ProcessDeliveriesResult> {
  const orders = await findRecentEligibleOrders(hours);
  const errors: string[] = [];
  let payoutsCreated = 0;

  for (const order of orders) {
    try {
      const result = await calculateCommissionForOrder(order.id);
      if (result.created) payoutsCreated++;
    } catch (err) {
      errors.push(`order ${order.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { ordersProcessed: orders.length, payoutsCreated, errors };
}

export type WeeklyBatchResult = {
  merchantsCount: number;
  commissionsCount: number;
  totalAmountCents: number;
  errors: string[];
};

/**
 * Weekly cron (Friday 9am) — bundles every not-yet-batched Commission
 * (status "calculated", payoutId still null — could be from any point
 * since the last run, not strictly "this week") into one Payout per
 * merchant, ready for an admin to transfer.
 */
export async function runWeeklyPayoutBatching(): Promise<WeeklyBatchResult> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - WEEK_MS);

  const commissions = await prisma.commission.findMany({
    where: { payoutId: null, status: "calculated" },
    include: { merchant: { select: { name: true } } },
  });

  if (commissions.length === 0) {
    return { merchantsCount: 0, commissionsCount: 0, totalAmountCents: 0, errors: [] };
  }

  const byMerchant = new Map<string, typeof commissions>();
  for (const c of commissions) {
    const group = byMerchant.get(c.merchantId);
    if (group) group.push(c);
    else byMerchant.set(c.merchantId, [c]);
  }

  const errors: string[] = [];
  let merchantsCount = 0;
  let totalAmountCents = 0;

  for (const [merchantId, merchantCommissions] of byMerchant) {
    try {
      const totalSalesCents = merchantCommissions.reduce((sum, c) => sum + c.orderTotalCents, 0);
      const commissionCents = merchantCommissions.reduce((sum, c) => sum + c.rifqaCommissionCents, 0);
      const amountCents = merchantCommissions.reduce((sum, c) => sum + c.merchantPayoutCents, 0);

      await prisma.$transaction(
        async (tx) => {
          const payout = await tx.payout.create({
            data: {
              merchantId,
              periodStart,
              periodEnd,
              orderCount: merchantCommissions.length,
              totalSalesCents,
              commissionCents,
              amountCents,
            },
          });
          await tx.commission.updateMany({
            where: { id: { in: merchantCommissions.map((c) => c.id) } },
            data: { payoutId: payout.id },
          });
        },
        { timeout: 20000, maxWait: 10000 }
      );

      merchantsCount++;
      totalAmountCents += amountCents;
    } catch (err) {
      errors.push(`merchant ${merchantId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { merchantsCount, commissionsCount: commissions.length, totalAmountCents, errors };
}

/** Retries a cron job's core work up to `retries` times with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export async function logCronRun(params: {
  jobName: string;
  status: "success" | "failed";
  ordersProcessed?: number;
  payoutsCreated?: number;
  errorMessage?: string | null;
  durationMs: number;
}) {
  await prisma.cronLog.create({
    data: {
      jobName: params.jobName,
      status: params.status,
      ordersProcessed: params.ordersProcessed ?? 0,
      payoutsCreated: params.payoutsCreated ?? 0,
      errorMessage: params.errorMessage ?? null,
      durationMs: params.durationMs,
    },
  });
}
