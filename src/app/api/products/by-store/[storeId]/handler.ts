import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";

type ProductRow = { id: string; storeId: string; createdAt: Date; variants: unknown[] };

export type ProductsByStoreDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  product: {
    findMany: (args: {
      where: { storeId: string; deletedAt: null };
      include: { variants: true };
      orderBy: { createdAt: "desc" };
      take: 1000;
    }) => Promise<ProductRow[]>;
  };
};

// GET /api/products/by-store/:storeId — list a store's products (needs auth).
// deletedAt: null excludes products the merchant deleted, while still
// showing out-of-stock ones (active: false but not deleted).
export async function handleProductsByStore(db: ProductsByStoreDb, req: Request, storeId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    const products = await db.product.findMany({
      where: { storeId, deletedAt: null },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
