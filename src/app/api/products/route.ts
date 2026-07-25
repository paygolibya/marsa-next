import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { createProductSchema } from "@/lib/validation";

async function assertOwnsStore(storeId: string, merchantId: string) {
  return prisma.store.findFirst({ where: { id: storeId, merchantId } });
}

// POST /api/products — add a product to your store (needs auth).
// Ported from marsa-backend/src/routes/products.js (POST /).
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    }
    const { storeId, name, priceCents, imageUrl } = parsed.data;

    if (!(await assertOwnsStore(storeId, merchantId))) {
      return NextResponse.json({ error: "You do not own this store" }, { status: 403 });
    }

    const product = await prisma.product.create({
      data: { storeId, name, priceCents, imageUrl: imageUrl || null },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
