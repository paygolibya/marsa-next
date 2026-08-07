import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { getPlanFeatureFlags } from "@/lib/checkout-features";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await params;

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedBy: merchantId,
      },
    });

    await prisma.merchant.update({
      where: { id: payment.merchantId },
      data: {
        subscriptionTier: payment.tier,
        subscriptionStatus: "active",
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ...getPlanFeatureFlags(payment.tier),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json({ error: "Failed to approve payment" }, { status: 500 });
  }
}
