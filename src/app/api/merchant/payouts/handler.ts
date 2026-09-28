import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import { COMMISSION_RATE } from "@/lib/payment/commission";

type PayoutRow = { id: string; status: string; createdAt: Date; amountCents: number };

export type MerchantPayoutsDb = {
  commission: {
    aggregate: (args: {
      where: { merchantId: string; status: "calculated" };
      _sum: { merchantPayoutCents: true };
    }) => Promise<{ _sum: { merchantPayoutCents: number | null } }>;
  };
  payout: {
    findMany: (args: { where: { merchantId: string }; orderBy: { createdAt: "desc" }; take: 200 }) => Promise<PayoutRow[]>;
  };
};

// GET /api/merchant/payouts — the authenticated merchant's own payout
// history + pending amount. No admin required, scoped to the caller only.
//
// pendingAmountCents sums every Commission not yet paid — this includes
// orders calculated today (not yet batched into any weekly Payout) as
// well as ones already batched but not yet transferred, so a merchant
// always sees an up-to-date total, not just whatever the last weekly
// batch happened to catch.
export async function handleMerchantPayouts(db: MerchantPayoutsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const [pendingSum, payouts] = await Promise.all([
    db.commission.aggregate({ where: { merchantId, status: "calculated" }, _sum: { merchantPayoutCents: true } }),
    db.payout.findMany({ where: { merchantId }, orderBy: { createdAt: "desc" }, take: 200 }),
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
