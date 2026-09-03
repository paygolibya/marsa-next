import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { updateProductVariantSchema } from "@/lib/validation";

async function assertOwnsVariant(productId: string, variantId: string, merchantId: string) {
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) return null;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return null;
  const store = await prisma.store.findFirst({ where: { id: product.storeId, merchantId } });
  return store ? variant : null;
}

// PATCH /api/products/:id/variants/:variantId — { priceCents?, stockQty?, active? }.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id, variantId } = await params;
    if (!(await assertOwnsVariant(id, variantId, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateProductVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const variant = await prisma.productVariant.update({ where: { id: variantId }, data: parsed.data });
    return NextResponse.json(variant);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/:id/variants/:variantId — drop one combination the
// merchant doesn't actually offer (e.g. "XL" exists as an option value but
// this product never comes in it), without touching the others.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id, variantId } = await params;
    if (!(await assertOwnsVariant(id, variantId, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }
    await prisma.productVariant.delete({ where: { id: variantId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
