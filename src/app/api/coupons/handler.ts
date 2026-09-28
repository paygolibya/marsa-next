import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { createCouponSchema } from "@/lib/validation";

type CouponRow = { id: string; storeId: string; code: string };

export type CouponsDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  coupon: {
    findUnique: (args: { where: { storeId_code: { storeId: string; code: string } } }) => Promise<CouponRow | null>;
    create: (args: {
      data: {
        storeId: string;
        code: string;
        discountType: string;
        discountValue: number;
        minOrderCents: number | null;
        maxUsage: number | null;
        expiresAt: Date | null;
      };
    }) => Promise<CouponRow>;
    findMany: (args: { where: { storeId: string }; orderBy: { createdAt: "desc" } }) => Promise<CouponRow[]>;
  };
};

// POST /api/coupons — create a coupon for one of the merchant's stores.
export async function handleCreateCoupon(db: CouponsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, code, discountType, discountValue, minOrderCents, maxUsage, expiresAt } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    if (discountType === "percent" && discountValue > 100) {
      return NextResponse.json({ error: "نسبة الخصم يجب ألا تتجاوز 100%" }, { status: 400 });
    }

    const existing = await db.coupon.findUnique({ where: { storeId_code: { storeId, code } } });
    if (existing) {
      return NextResponse.json({ error: "رمز الكوبون مستخدم بالفعل" }, { status: 409 });
    }

    const coupon = await db.coupon.create({
      data: {
        storeId,
        code,
        discountType,
        discountValue,
        minOrderCents: minOrderCents ?? null,
        maxUsage: maxUsage ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return NextResponse.json(coupon, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/coupons?storeId=... — list coupons for a store the merchant owns.
export async function handleListCoupons(db: CouponsDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const coupons = await db.coupon.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(coupons);
}
