import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

// GET /api/admin/payouts/ready?status=ready_for_transfer — lists automatically-
// calculated payout batches (optionally filtered by status) plus
// platform-wide stats. Nothing here is admin-triggered — every Payout row
// was created by the Friday weekly-payouts cron from Commission rows the
// real-time delivery trigger (or its daily-cron backstop) already
// calculated.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const payouts = await prisma.payout.findMany({
    where: status ? { status } : undefined,
    include: { merchant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const allPayouts = await prisma.payout.findMany({ select: { status: true, amountCents: true, commissionCents: true } });
  const stats = {
    totalSalesCents: allPayouts.reduce((sum, p) => sum + p.amountCents + p.commissionCents, 0),
    totalCommissionCents: allPayouts.reduce((sum, p) => sum + p.commissionCents, 0),
    pendingPayoutCents: allPayouts.filter((p) => p.status !== "transferred").reduce((sum, p) => sum + p.amountCents, 0),
    pendingPayoutCount: allPayouts.filter((p) => p.status !== "transferred").length,
  };

  return NextResponse.json({
    stats,
    payouts: payouts.map((p) => ({
      id: p.id,
      merchantId: p.merchantId,
      merchantName: p.merchant.name,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      orderCount: p.orderCount,
      totalSalesCents: p.totalSalesCents,
      commissionCents: p.commissionCents,
      amountCents: p.amountCents,
      status: p.status,
      transferredAt: p.transferredAt,
      transferredBy: p.transferredBy,
      transferReference: p.transferReference,
      note: p.note,
      createdAt: p.createdAt,
    })),
  });
}
