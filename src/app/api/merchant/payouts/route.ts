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

  const [pendingCommissions, payouts] = await Promise.all([
    prisma.commission.findMany({ where: { merchantId, status: "calculated" }, select: { merchantPayoutCents: true } }),
    prisma.payout.findMany({ where: { merchantId }, orderBy: { createdAt: "desc" } }),
  ]);

  const pendingAmountCents = pendingCommissions.reduce((sum, c) => sum + c.merchantPayoutCents, 0);
  const lastPayout = payouts.find((p) => p.status === "transferred") ?? null;

  return NextResponse.json({
    pendingAmountCents,
    commissionRate: COMMISSION_RATE,
    lastPayout,
    history: payouts,
  });
}
