import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { calculatePayoutsSchema } from "@/lib/validation";
import { calculateCommission, findEligibleOrders } from "@/lib/payment/commission";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

class DuplicateCommissionError extends Error {}

// POST /api/admin/calculate-payouts — { periodStart?, periodEnd? } (ISO
// datetimes; defaults to the last 7 days). Groups eligible delivered/paid
// wallet orders by merchant into one Payout per merchant for this run.
//
// Never trusts a client-computed total — commission/payout amounts are
// always derived here from Order.totalCents, the same principle already
// applied to prices/shipping/discounts in the order-creation route.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = calculatePayoutsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const periodEnd = parsed.data.periodEnd ? new Date(parsed.data.periodEnd) : new Date();
    const periodStart = parsed.data.periodStart ? new Date(parsed.data.periodStart) : new Date(periodEnd.getTime() - WEEK_MS);

    const orders = await findEligibleOrders(periodStart, periodEnd);

    if (orders.length === 0) {
      return NextResponse.json({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        merchantsCount: 0,
        ordersCount: 0,
        totalCommissionCents: 0,
        totalPayoutCents: 0,
        payouts: [],
      });
    }

    const byMerchant = new Map<string, { merchantName: string; orders: typeof orders }>();
    for (const order of orders) {
      const group = byMerchant.get(order.store.merchantId);
      if (group) {
        group.orders.push(order);
      } else {
        byMerchant.set(order.store.merchantId, { merchantName: order.store.merchant.name, orders: [order] });
      }
    }

    const payouts = await prisma.$transaction(
      async (tx) => {
        const created = [];
        for (const [merchantId, { merchantName, orders: merchantOrders }] of byMerchant) {
          let totalSalesCents = 0;
          let commissionCents = 0;
          let amountCents = 0;
          const commissionRows: { orderId: string; rifqaCommissionCents: number; merchantPayoutCents: number; orderTotalCents: number }[] = [];

          for (const order of merchantOrders) {
            const { rifqaCommissionCents, merchantPayoutCents } = calculateCommission(order.totalCents);
            totalSalesCents += order.totalCents;
            commissionCents += rifqaCommissionCents;
            amountCents += merchantPayoutCents;
            commissionRows.push({ orderId: order.id, rifqaCommissionCents, merchantPayoutCents, orderTotalCents: order.totalCents });
          }

          const payout = await tx.payout.create({
            data: {
              merchantId,
              periodStart,
              periodEnd,
              orderCount: merchantOrders.length,
              totalSalesCents,
              commissionCents,
              amountCents,
              status: "pending",
            },
          });

          for (const row of commissionRows) {
            // The unique constraint on orderId is the real guard against a
            // concurrent calculation run double-claiming the same order —
            // skip (not abort) if another run already claimed it between
            // our findEligibleOrders read and this write.
            try {
              await tx.commission.create({
                data: {
                  orderId: row.orderId,
                  merchantId,
                  payoutId: payout.id,
                  orderTotalCents: row.orderTotalCents,
                  rifqaCommissionCents: row.rifqaCommissionCents,
                  merchantPayoutCents: row.merchantPayoutCents,
                },
              });
            } catch (err: unknown) {
              if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
                throw new DuplicateCommissionError(row.orderId);
              }
              throw err;
            }
          }

          created.push({ ...payout, merchantName });
        }
        return created;
      },
      { timeout: 20000, maxWait: 10000 }
    );

    return NextResponse.json({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      merchantsCount: payouts.length,
      ordersCount: orders.length,
      totalCommissionCents: payouts.reduce((sum, p) => sum + p.commissionCents, 0),
      totalPayoutCents: payouts.reduce((sum, p) => sum + p.amountCents, 0),
      payouts,
    });
  } catch (err) {
    if (err instanceof DuplicateCommissionError) {
      return NextResponse.json(
        { error: "تم احتساب بعض الطلبات بالفعل في عملية أخرى، حاول مجددًا" },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
