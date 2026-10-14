import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";
import { FIRST_PAYMENT_DISCOUNT_LYD } from "@/lib/checkout-features";

export type SubscriptionPricingDb = {
  payment: { count: (args: { where: { merchantId: string; status: string } }) => Promise<number> };
};

// GET /api/payments/subscription-pricing — tells the pricing/payment pages
// whether this merchant's next payment gets the first-paid-month discount,
// using the exact same rule subscription-init charges with (no approved
// payment yet). Display only — the server re-derives it at charge time.
export async function handleSubscriptionPricing(db: SubscriptionPricingDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const approvedCount = await db.payment.count({ where: { merchantId, status: "approved" } });
  const eligible = approvedCount === 0;
  return NextResponse.json({ firstPaymentDiscountEligible: eligible, discountLYD: eligible ? FIRST_PAYMENT_DISCOUNT_LYD : 0 });
}
