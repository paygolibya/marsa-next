// Shared coupon-discount math, used by both the checkout preview endpoint
// and the authoritative calculation inside order creation — the two must
// never diverge, since the preview is only ever advisory.

export type CouponLike = {
  active: boolean;
  discountType: string; // 'percent' | 'fixed'
  discountValue: number;
  minOrderCents: number | null;
  maxUsage: number | null;
  usageCount: number;
  expiresAt: Date | null;
};

export function resolveCouponDiscount(
  coupon: CouponLike,
  subtotalCents: number
): { valid: boolean; discountCents: number; message?: string } {
  if (!coupon.active) return { valid: false, discountCents: 0, message: "هذا الكوبون غير مفعّل" };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { valid: false, discountCents: 0, message: "انتهت صلاحية الكوبون" };
  }
  if (coupon.maxUsage != null && coupon.usageCount >= coupon.maxUsage) {
    return { valid: false, discountCents: 0, message: "تم استخدام هذا الكوبون بالكامل" };
  }
  if (coupon.minOrderCents != null && subtotalCents < coupon.minOrderCents) {
    return { valid: false, discountCents: 0, message: "الطلب أقل من الحد الأدنى المطلوب لهذا الكوبون" };
  }

  const rawDiscount =
    coupon.discountType === "percent" ? Math.round((subtotalCents * coupon.discountValue) / 100) : coupon.discountValue;

  return { valid: true, discountCents: Math.min(rawDiscount, subtotalCents) };
}
