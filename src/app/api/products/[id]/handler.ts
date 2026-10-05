import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "@prisma/client";
import { getAuthMerchantId } from "@/lib/auth";
import { updateProductSchema } from "@/lib/validation";

type ProductRow = { id: string; storeId: string };

export type ProductByIdDb = {
  product: {
    findUnique: (args: { where: { id: string } }) => Promise<ProductRow | null>;
    update: (args: { where: { id: string }; data: Record<string, unknown>; include?: { variants: true } }) => Promise<unknown>;
  };
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  category: { findFirst: (args: { where: { id: string; storeId: string } }) => Promise<{ id: string } | null> };
};

async function assertOwnsProduct(db: ProductByIdDb, id: string, merchantId: string) {
  const product = await db.product.findUnique({ where: { id } });
  if (!product) return null;
  const store = await db.store.findFirst({ where: { id: product.storeId, merchantId } });
  return store ? product : null;
}

// PATCH /api/products/:id — edit name/price/image/stock (needs auth).
export async function handleUpdateProduct(db: ProductByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const existing = await assertOwnsProduct(db, id, merchantId);
    if (!existing) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    if (parsed.data.categoryId) {
      const category = await db.category.findFirst({ where: { id: parsed.data.categoryId, storeId: existing.storeId } });
      if (!category) return NextResponse.json({ error: "التصنيف غير موجود" }, { status: 400 });
    }

    const { images, translations, ...rest } = parsed.data;
    // imageUrl mirrors images[0] — only touch it when images was actually
    // part of this request, same "derived, never independent" rule as
    // creating a product.
    const product = await db.product.update({
      where: { id },
      data: {
        ...rest,
        ...(images !== undefined ? { images, imageUrl: images[0] ?? null } : {}),
        ...(translations !== undefined ? { translations: translations ?? Prisma.JsonNull } : {}),
      },
      include: { variants: true },
    });
    return NextResponse.json(product);
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/:id — soft-delete (sets active = false).
export async function handleDeleteProduct(db: ProductByIdDb, req: Request, id: string): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const product = await db.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const store = await db.store.findFirst({ where: { id: product.storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    await db.product.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
