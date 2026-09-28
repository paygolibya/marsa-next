import { NextResponse } from "next/server";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

type PayoutRow = {
  id: string;
  merchantId: string;
  merchant: { name: string };
  periodStart: Date;
  periodEnd: Date;
  orderCount: number;
  totalSalesCents: number;
  commissionCents: number;
  amountCents: number;
  status: string;
  transferredAt: Date | null;
  transferredBy: string | null;
  transferReference: string | null;
  note: string | null;
  createdAt: Date;
};

// Two distinct methods, not one overloaded/loosely-typed findMany — the
// two real calls this route makes genuinely return different shapes (one
// includes the related merchant's name, the other only selects three
// scalar columns for the stats reduce below). route.ts adapts the real
// prisma.payout.findMany into both, each with its own concrete args type,
// so Prisma's own generic correctly specializes per call instead of
// degrading to its base case the way a single `Any`-typed method would.
export type PayoutsReadyDb = {
  payout: {
    findManyWithMerchant: (args: {
      where: { status: string } | undefined;
      include: { merchant: { select: { name: true } } };
      orderBy: { createdAt: "desc" };
    }) => Promise<PayoutRow[]>;
    findManyStatsOnly: (args: {
      select: { status: true; amountCents: true; commissionCents: true };
    }) => Promise<Pick<PayoutRow, "status" | "amountCents" | "commissionCents">[]>;
  };
};

// GET /api/admin/payouts/ready?status=ready_for_transfer — lists
// automatically-calculated payout batches (optionally filtered by status)
// plus platform-wide stats computed from EVERY payout regardless of the
// status filter (the list can be filtered to just "ready to transfer", but
// the stats card above it always reflects the whole platform — a
// regression that accidentally scoped the stats query to the filtered set
// too would silently under-report total sales/commission whenever a
// filter was applied).
export async function handlePayoutsReady(db: PayoutsReadyDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  const payouts = await db.payout.findManyWithMerchant({
    where: status ? { status } : undefined,
    include: { merchant: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const allPayouts = await db.payout.findManyStatsOnly({ select: { status: true, amountCents: true, commissionCents: true } });
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
