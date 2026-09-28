import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId, isAdminMerchantId } from "@/lib/auth";

export type DeleteMerchantDb = {
  store: {
    findMany: (args: { where: { merchantId: string }; select: { id: true } }) => Promise<{ id: string }[]>;
    deleteMany: (args: { where: { merchantId: string } }) => Promise<unknown>;
  };
  productReview: { deleteMany: (args: { where: { product: { storeId: { in: string[] } } } }) => Promise<unknown> };
  orderItem: { deleteMany: (args: { where: { order: { storeId: { in: string[] } } } }) => Promise<unknown> };
  order: { deleteMany: (args: { where: { storeId: { in: string[] } } }) => Promise<unknown> };
  product: { deleteMany: (args: { where: { storeId: { in: string[] } } }) => Promise<unknown> };
  coupon: { deleteMany: (args: { where: { storeId: { in: string[] } } }) => Promise<unknown> };
  payment: { deleteMany: (args: { where: { merchantId: string } }) => Promise<unknown> };
  merchant: { delete: (args: { where: { id: string } }) => Promise<unknown> };
};

// DELETE /api/admin/merchants/delete — a real cascading delete across 7
// tables in a fixed order (reviews and order items before the orders/
// products they reference; everything scoped to the merchant's own
// stores before the merchant row itself). The order matters: this is the
// single most destructive admin action in the app, so the call sequence
// itself gets asserted here, not just the final "success" response —
// deleting things in the wrong order, or skipping one, would either throw
// a foreign-key error partway through (leaving a half-deleted merchant)
// or silently orphan rows, and a test only checking the final status
// code would miss either.
export async function handleDeleteMerchant(db: DeleteMerchantDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!(await isAdminMerchantId(merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { merchantId: targetMerchantId } = await req.json();

    const merchantStores = await db.store.findMany({
      where: { merchantId: targetMerchantId },
      select: { id: true },
    });

    const storeIds = merchantStores.map((store) => store.id);

    await db.productReview.deleteMany({ where: { product: { storeId: { in: storeIds } } } });
    await db.orderItem.deleteMany({ where: { order: { storeId: { in: storeIds } } } });
    await db.order.deleteMany({ where: { storeId: { in: storeIds } } });
    await db.product.deleteMany({ where: { storeId: { in: storeIds } } });
    await db.coupon.deleteMany({ where: { storeId: { in: storeIds } } });
    await db.store.deleteMany({ where: { merchantId: targetMerchantId } });
    await db.payment.deleteMany({ where: { merchantId: targetMerchantId } });
    await db.merchant.delete({ where: { id: targetMerchantId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting merchant:", error);
    Sentry.captureException(error);
    return NextResponse.json({ error: "Failed to delete merchant" }, { status: 500 });
  }
}
