import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { updateProductVariantSchema } from "@/lib/validation";

type VariantRow = { id: string; productId: string };

export type VariantByIdDb = {
  productVariant: {
    findFirst: (args: { where: { id: string; productId: string } }) => Promise<VariantRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
  product: { findUnique: (args: { where: { id: string } }) => Promise<{ id: string; storeId: string } | null> };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsVariant(db: VariantByIdDb, productId: string, variantId: string, merchantId: string) {
  const variant = await db.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) return null;
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  const store = await db.store.findFirst({ where: { id: product.storeId, merchantId } });
  return store ? variant : null;
}

// PATCH /api/products/:id/variants/:variantId — { priceCents?, stockQty?, active? }.
export async function handleUpdateVariant(db: VariantByIdDb, req: Request, productId: string, variantId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsVariant(db, productId, variantId, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateProductVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const variant = await db.productVariant.update({ where: { id: variantId }, data: parsed.data });
    return NextResponse.json(variant);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/:id/variants/:variantId — drop one combination the
// merchant doesn't actually offer, without touching the others.
export async function handleDeleteVariant(db: VariantByIdDb, req: Request, productId: string, variantId: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    if (!(await assertOwnsVariant(db, productId, variantId, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await db.productVariant.delete({ where: { id: variantId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
