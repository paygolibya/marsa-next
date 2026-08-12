import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { createCouponSchema } from "@/lib/validation";

// POST /api/coupons — create a coupon for one of the merchant's stores.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, code, discountType, discountValue, minOrderCents, maxUsage, expiresAt } = parsed.data;

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    if (discountType === "percent" && discountValue > 100) {
      return NextResponse.json({ error: "نسبة الخصم يجب ألا تتجاوز 100%" }, { status: 400 });
    }

    const existing = await prisma.coupon.findUnique({ where: { storeId_code: { storeId, code } } });
    if (existing) {
      return NextResponse.json({ error: "رمز الكوبون مستخدم بالفعل" }, { status: 409 });
    }

    const coupon = await prisma.coupon.create({
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/coupons?storeId=... — list coupons for a store the merchant owns.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const coupons = await prisma.coupon.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json(coupons);
}
