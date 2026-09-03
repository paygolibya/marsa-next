import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { updateProductSchema } from "@/lib/validation";

async function assertOwnsProduct(id: string, merchantId: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return null;
  const store = await prisma.store.findFirst({ where: { id: product.storeId, merchantId } });
  return store ? product : null;
}

// PATCH /api/products/:id — edit name/price/image/stock (needs auth).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    if (!(await assertOwnsProduct(id, merchantId))) {
      return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }

    const { images, ...rest } = parsed.data;
    // imageUrl mirrors images[0] — only touch it when images was actually
    // part of this request, same "derived, never independent" rule as
    // creating a product.
    const product = await prisma.product.update({
      where: { id },
      data: { ...rest, ...(images !== undefined ? { images, imageUrl: images[0] ?? null } : {}) },
      include: { variants: true },
    });
    return NextResponse.json(product);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/:id — soft-delete (sets active = false).
// Ported from marsa-backend/src/routes/products.js (DELETE /:id).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    const store = await prisma.store.findFirst({ where: { id: product.storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "Not found or not yours" }, { status: 403 });

    await prisma.product.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
