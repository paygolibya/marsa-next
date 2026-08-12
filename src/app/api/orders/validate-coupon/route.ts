import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCouponDiscount } from "@/lib/coupons";

// POST /api/orders/validate-coupon — public, checkout-time preview only.
// The authoritative discount is recomputed server-side again inside
// POST /api/orders — never trust this response for the actual charge.
export async function POST(req: Request) {
  try {
    const { storeSlug, code, subtotalCents } = await req.json();
    if (!storeSlug || !code || typeof subtotalCents !== "number") {
      return NextResponse.json({ valid: false, discountCents: 0, message: "بيانات غير صالحة" }, { status: 400 });
    }

    const store = await prisma.store.findUnique({ where: { slug: storeSlug } });
    if (!store) return NextResponse.json({ valid: false, discountCents: 0, message: "المتجر غير موجود" }, { status: 404 });

    const coupon = await prisma.coupon.findUnique({
      where: { storeId_code: { storeId: store.id, code: String(code).trim().toUpperCase() } },
    });
    if (!coupon) {
      return NextResponse.json({ valid: false, discountCents: 0, message: "رمز الكوبون غير صحيح" });
    }

    const result = resolveCouponDiscount(coupon, subtotalCents);
    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ valid: false, discountCents: 0, message: "حدث خطأ" }, { status: 500 });
  }
}
