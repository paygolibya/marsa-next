import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { normalizeSubscriptionTier, getPlanFeatureFlags } from "@/lib/checkout-features";
import { addMonths } from "@/lib/subscription/period";

const VALID_PERIOD_MONTHS = [1, 3, 12];

export type AcceptMerchantDb = {
  merchant: {
    findUnique: (args: { where: { id: string }; select: { subscriptionTier: true } }) => Promise<{ subscriptionTier: string | null } | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

// periodMonths defaults to 1 for backward compatibility with any caller
// that doesn't send it, but this route used to grant a flat 30 days
// regardless of what the admin actually meant to approve — the exact same
// class of bug fixed in admin/payments/[id]/approve/handler.ts (a real,
// paid-for period getting silently shortchanged to ~30 days, which drifts
// from a real calendar month/quarter/year by several days). This route
// has no Payment row to read a real period from (it's the manual/offline
// approval path — e.g. after reviewing a bank-transfer receipt), so the
// admin now picks the period explicitly in the same modal they already
// pick the tier from (see AcceptMerchantModal in admin/merchants/page.tsx).
export async function handleAcceptMerchant(db: AcceptMerchantDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId, tier, periodMonths } = await req.json();

    const resolvedPeriodMonths = VALID_PERIOD_MONTHS.includes(periodMonths) ? periodMonths : 1;

    const target = await db.merchant.findUnique({
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

    await db.merchant.update({
      where: { id: targetMerchantId },
      data: {
        subscriptionTier: resolvedTier,
        subscriptionPeriodMonths: resolvedPeriodMonths,
        subscriptionStatus: "active",
        subscriptionStartDate: new Date(),
        subscriptionEndDate: addMonths(new Date(), resolvedPeriodMonths),
        ...getPlanFeatureFlags(resolvedTier),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting merchant:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to accept merchant" }, { status: 500 });
  }
}
