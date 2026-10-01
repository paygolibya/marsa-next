import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";
import { getPlanFeatureFlags } from "@/lib/checkout-features";
import { addMonths } from "@/lib/subscription/period";

export type ApprovePaymentDb = {
  payment: {
    update: (args: {
      where: { id: string };
      data: { status: string; approvedAt: Date; approvedBy: string };
    }) => Promise<{ id: string; merchantId: string; tier: string; periodMonths: number }>;
  };
  merchant: { update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> };
};

// POST /api/admin/payments/:id/approve — a real bug was found and fixed
// while adding this route's first test coverage: this used to activate
// every manually-approved payment for a flat 30 days, regardless of
// whether the merchant actually paid for a 1/3/12-month plan (periodMonths
// on the Payment row), and never updated subscriptionPeriodMonths at all —
// silently shortchanging anyone approved for a 3- or 12-month period via
// this admin path. The automatic Moamalat-confirmed path
// (finalizeSubscriptionPayment, moamalat-subscription.ts) already did this
// correctly; its own comment even said this route "mirrors exactly" that
// one, which wasn't true. Both now share addMonths (subscription/period.ts).
export async function handleApprovePayment(db: ApprovePaymentDb, req: Request, paymentId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const payment = await db.payment.update({
      where: { id: paymentId },
      data: { status: "approved", approvedAt: new Date(), approvedBy: merchantId! },
    });

    await db.merchant.update({
      where: { id: payment.merchantId },
      data: {
        subscriptionTier: payment.tier,
        subscriptionPeriodMonths: payment.periodMonths,
        subscriptionStatus: "active",
        subscriptionStartDate: new Date(),
        subscriptionEndDate: addMonths(new Date(), payment.periodMonths),
        ...getPlanFeatureFlags(payment.tier),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to approve payment" }, { status: 500 });
  }
}
