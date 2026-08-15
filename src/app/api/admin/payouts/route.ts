import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

// GET /api/admin/payouts?status=pending — list payouts with merchant names,
// optionally filtered by status. Also returns platform-wide stats.
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
    pendingPayoutCents: allPayouts.filter((p) => p.status !== "completed").reduce((sum, p) => sum + p.amountCents, 0),
    pendingPayoutCount: allPayouts.filter((p) => p.status !== "completed").length,
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
      markedPaidAt: p.markedPaidAt,
      note: p.note,
      createdAt: p.createdAt,
    })),
  });
}
