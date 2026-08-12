import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { updateCouponSchema } from "@/lib/validation";

async function assertOwnsCoupon(id: string, merchantId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) return null;
  const store = await prisma.store.findFirst({ where: { id: coupon.storeId, merchantId } });
  return store ? coupon : null;
}

// PATCH /api/coupons/:id — toggle active / adjust usage limit or expiry.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    if (!(await assertOwnsCoupon(id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const { expiresAt, ...rest } = parsed.data;
    const coupon = await prisma.coupon.update({
      where: { id },
      data: { ...rest, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) },
    });
    return NextResponse.json(coupon);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/coupons/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    if (!(await assertOwnsCoupon(id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
