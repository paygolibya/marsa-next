import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { COMMISSION_RATE } from "@/lib/payment/commission";

// GET /api/merchant/payouts — the authenticated merchant's own payout
// history + pending amount. No admin required, scoped to the caller only.
//
// pendingAmountCents sums every Commission not yet paid — this includes
// orders calculated today (not yet batched into any weekly Payout) as
// well as ones already batched but not yet transferred, so a merchant
// always sees an up-to-date total, not just whatever the last weekly
// batch happened to catch.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const [pendingSum, payouts] = await Promise.all([
    // A database-side sum instead of fetching every uncleared Commission
    // row into app memory just to add one column — correct regardless of
    // how many rows exist, and doesn't get slower as they grow. In
    // practice this stays small anyway (commissions get swept into a
    // weekly Payout batch, so it only ever holds one cycle's worth), but
    // the aggregate is free and strictly better than the old findMany+reduce.
    prisma.commission.aggregate({ where: { merchantId, status: "calculated" }, _sum: { merchantPayoutCents: true } }),
    // This one IS capped — it's a monotonically-growing history list (one
    // row per week, forever), and both `lastPayout` and a future paginated
    // history view only ever need the most recent slice, not everything.
    prisma.payout.findMany({ where: { merchantId }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  const pendingAmountCents = pendingSum._sum.merchantPayoutCents ?? 0;
  const lastPayout = payouts.find((p) => p.status === "transferred") ?? null;

  return NextResponse.json({
    pendingAmountCents,
    commissionRate: COMMISSION_RATE,
    lastPayout,
    history: payouts,
  });
}
