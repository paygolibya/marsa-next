import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { COMMISSION_RATE } from "@/lib/payment/commission";

// GET /api/merchant/payouts — the authenticated merchant's own payout
// history + pending amount. No admin required, scoped to the caller only.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const payouts = await prisma.payout.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
  });

  const pendingAmountCents = payouts.filter((p) => p.status !== "completed").reduce((sum, p) => sum + p.amountCents, 0);
  const lastPayout = payouts.find((p) => p.status === "completed") ?? null;

  return NextResponse.json({
    pendingAmountCents,
    commissionRate: COMMISSION_RATE,
    lastPayout,
    history: payouts,
  });
}
