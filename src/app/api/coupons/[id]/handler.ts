import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateCouponSchema } from "@/lib/validation";

type CouponRow = { id: string; storeId: string };

export type CouponByIdDb = {
  coupon: {
    findUnique: (args: { where: { id: string } }) => Promise<CouponRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<CouponRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsCoupon(db: CouponByIdDb, id: string, merchantId: string) {
  const coupon = await db.coupon.findUnique({ where: { id } });
  if (!coupon) return null;
  const store = await db.store.findFirst({ where: { id: coupon.storeId, merchantId } });
  return store ? coupon : null;
}

// PATCH /api/coupons/:id — toggle active / adjust usage limit or expiry.
export async function handleUpdateCoupon(db: CouponByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsCoupon(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const { expiresAt, ...rest } = parsed.data;
    const coupon = await db.coupon.update({
      where: { id },
      data: { ...rest, ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}) },
    });
    return NextResponse.json(coupon);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/coupons/:id
export async function handleDeleteCoupon(db: CouponByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsCoupon(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.coupon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
