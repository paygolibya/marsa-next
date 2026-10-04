import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { createProductSchema } from "@/lib/validation";

type ProductRow = { id: string; storeId: string; name: string; description: string | null; priceCents: number; images: string[]; imageUrl: string | null };

export type CreateProductDb = {
  store: { findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<{ id: string } | null> };
  product: {
    create: (args: {
      data: { storeId: string; name: string; description: string | null; priceCents: number; images: string[]; imageUrl: string | null };
    }) => Promise<ProductRow>;
  };
};

// POST /api/products — add a product to your store (needs auth).
export async function handleCreateProduct(db: CreateProductDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, name, description, priceCents, images } = parsed.data;

    const store = await db.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    // imageUrl is always images[0] — the two are never set independently,
    // so every existing single-image call site (storefront cards, cart,
    // order emails) keeps working without knowing galleries exist.
    const product = await db.product.create({
      data: { storeId, name, description: description || null, priceCents, images: images ?? [], imageUrl: images?.[0] ?? null },
    });

    // A freshly created product has no variants yet — returned explicitly
    // rather than via Prisma `include` for a relation that's always empty
    // here, matching what the Product type expects (variants: never
    // undefined).
    return NextResponse.json({ ...product, variants: [] }, { status: 201 });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
