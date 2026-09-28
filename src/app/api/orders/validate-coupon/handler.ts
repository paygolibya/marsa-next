import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { resolveCouponDiscount, type CouponLike } from "@/lib/coupons";

export type ValidateCouponDb = {
  store: { findUnique: (args: { where: { slug: string } }) => Promise<{ id: string } | null> };
  coupon: { findUnique: (args: { where: { storeId_code: { storeId: string; code: string } } }) => Promise<CouponLike | null> };
};

// POST /api/orders/validate-coupon — public, checkout-time preview only.
// The authoritative discount is recomputed server-side again inside
// POST /api/orders — never trust this response for the actual charge.
// resolveCouponDiscount itself (the actual discount math: percent/fixed,
// min order, usage cap, expiry) is pure and already covered in
// coupons.test.ts — this handler's own job is store/coupon lookup and
// response shaping, so only `db` needs to be injectable here.
export async function handleValidateCoupon(db: ValidateCouponDb, req: Request): Promise<Response> {
  try {
    const { storeSlug, code, subtotalCents } = await req.json();
    if (!storeSlug || !code || typeof subtotalCents !== "number") {
      return NextResponse.json({ valid: false, discountCents: 0, message: "بيانات غير صالحة" }, { status: 400 });
    }

    const store = await db.store.findUnique({ where: { slug: storeSlug } });
    if (!store) return NextResponse.json({ valid: false, discountCents: 0, message: "المتجر غير موجود" }, { status: 404 });

    const coupon = await db.coupon.findUnique({
      where: { storeId_code: { storeId: store.id, code: String(code).trim().toUpperCase() } },
    });
    if (!coupon) {
      return NextResponse.json({ valid: false, discountCents: 0, message: "رمز الكوبون غير صحيح" });
    }

    const result = resolveCouponDiscount(coupon, subtotalCents);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ valid: false, discountCents: 0, message: "حدث خطأ" }, { status: 500 });
  }
}
