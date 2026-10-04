import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { createBundleSchema } from "@/lib/validation";

type BundleItemRow = { id: string; productId: string; quantity: number; product: { name: string; priceCents: number; imageUrl: string | null } };
type BundleRow = { id: string; storeId: string; name: string; priceCents: number; imageUrl: string | null; active: boolean; createdAt: Date; items: BundleItemRow[] };

export type BundlesDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  product: { findMany: (args: { where: { id: { in: string[] }; storeId: string } }) => Promise<{ id: string }[]> };
  bundle: {
    create: (args: {
      data: {
        storeId: string;
        name: string;
        priceCents: number;
        imageUrl: string | null;
        items: { create: { productId: string; quantity: number }[] };
      };
      include: { items: { include: { product: { select: { name: true; priceCents: true; imageUrl: true } } } } };
    }) => Promise<BundleRow>;
    findMany: (args: {
      where: { storeId: string };
      include: { items: { include: { product: { select: { name: true; priceCents: true; imageUrl: true } } } } };
      orderBy: { createdAt: "desc" };
    }) => Promise<BundleRow[]>;
  };
};

// Every productId in a bundle must belong to the SAME store the bundle
// belongs to — otherwise a merchant could reference another merchant's
// product (or a stale id from a different store of their own), which
// would break stock decrement/ownership assumptions throughout checkout.
async function assertProductsBelongToStore(db: BundlesDb, storeId: string, productIds: string[]): Promise<boolean> {
  const uniqueIds = [...new Set(productIds)];
  const owned = await db.product.findMany({ where: { id: { in: uniqueIds }, storeId } });
  return owned.length === uniqueIds.length;
}

// POST /api/bundles — create a bundle (a fixed-price set of existing products).
export async function handleCreateBundle(db: BundlesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, name, priceCents, imageUrl, items } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    if (!(await assertProductsBelongToStore(db, storeId, items.map((i) => i.productId)))) {
      return NextResponse.json({ error: "أحد المنتجات المختارة غير موجود في هذا المتجر" }, { status: 400 });
    }

    const bundle = await db.bundle.create({
      data: {
        storeId,
        name,
        priceCents,
        imageUrl: imageUrl || null,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
      },
      include: { items: { include: { product: { select: { name: true, priceCents: true, imageUrl: true } } } } },
    });

    return NextResponse.json(bundle, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/bundles?storeId=... — list bundles for a store the merchant owns.
export async function handleListBundles(db: BundlesDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const url = new URL(req.url);
  const storeId = url.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId is required" }, { status: 400 });

  const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
  if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

  const bundles = await db.bundle.findMany({
    where: { storeId },
    include: { items: { include: { product: { select: { name: true, priceCents: true, imageUrl: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(bundles);
}
