import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { normalizeSubscriptionTier, getPlanFeatureFlags } from "@/lib/checkout-features";

export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId, tier } = await req.json();

    const target = await prisma.merchant.findUnique({
      where: { id: targetMerchantId },
      select: { subscriptionTier: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    // The admin can pick a tier explicitly; otherwise keep whatever the
    // merchant already had on file instead of silently falling back to
    // "basic". Purely a legacy label at this point — every tier gets the
    // same full feature set (see getPlanFeatureFlags).
    const resolvedTier = normalizeSubscriptionTier(tier ?? target.subscriptionTier);

    await prisma.merchant.update({
      where: { id: targetMerchantId },
      data: {
        subscriptionTier: resolvedTier,
        subscriptionStatus: "active",
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        ...getPlanFeatureFlags(resolvedTier),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting merchant:", error);
    return NextResponse.json({ error: "Failed to accept merchant" }, { status: 500 });
  }
}
