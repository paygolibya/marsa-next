import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateBundleSchema } from "@/lib/validation";

type BundleRow = { id: string; storeId: string };
type BundleItemRow = { id: string; productId: string; quantity: number; product: { name: string; priceCents: number; imageUrl: string | null } };
type FullBundleRow = BundleRow & { name: string; priceCents: number; imageUrl: string | null; active: boolean; createdAt: Date; items: BundleItemRow[] };

export type BundleByIdDb = {
  bundle: {
    findUnique: (args: { where: { id: string } }) => Promise<BundleRow | null>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
      include: { items: { include: { product: { select: { name: true; priceCents: true; imageUrl: true } } } } };
    }) => Promise<FullBundleRow>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  bundleItem: {
    deleteMany: (args: { where: { bundleId: string } }) => Promise<unknown>;
    createMany: (args: { data: { bundleId: string; productId: string; quantity: number }[] }) => Promise<unknown>;
  };
  product: { findMany: (args: { where: { id: { in: string[] }; storeId: string } }) => Promise<{ id: string }[]> };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsBundle(db: BundleByIdDb, id: string, merchantId: string) {
  const bundle = await db.bundle.findUnique({ where: { id } });
  if (!bundle) return null;
  const store = await db.store.findFirst({ where: { id: bundle.storeId, merchantId } });
  return store ? bundle : null;
}

async function assertProductsBelongToStore(db: BundleByIdDb, storeId: string, productIds: string[]): Promise<boolean> {
  const uniqueIds = [...new Set(productIds)];
  const owned = await db.product.findMany({ where: { id: { in: uniqueIds }, storeId } });
  return owned.length === uniqueIds.length;
}

// PATCH /api/bundles/:id — edit name/price/image/active, or replace the
// whole product list (items is all-or-nothing: sending it replaces every
// existing BundleItem row rather than merging, since a partial patch of
// "which products are in this set" has no sensible meaning).
export async function handleUpdateBundle(db: BundleByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const existing = await assertOwnsBundle(db, id, merchantId);
    if (!existing) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const { items, ...rest } = parsed.data;

    if (items) {
      if (!(await assertProductsBelongToStore(db, existing.storeId, items.map((i) => i.productId)))) {
        return NextResponse.json({ error: "أحد المنتجات المختارة غير موجود في هذا المتجر" }, { status: 400 });
      }
      await db.bundleItem.deleteMany({ where: { bundleId: id } });
      await db.bundleItem.createMany({ data: items.map((i) => ({ bundleId: id, productId: i.productId, quantity: i.quantity })) });
    }

    const bundle = await db.bundle.update({
      where: { id },
      data: rest,
      include: { items: { include: { product: { select: { name: true, priceCents: true, imageUrl: true } } } } },
    });
    return NextResponse.json(bundle);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/bundles/:id — removing a bundle never touches its component
// products, only the bundle definition itself (BundleItem rows cascade).
export async function handleDeleteBundle(db: BundleByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsBundle(db, id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.bundle.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
