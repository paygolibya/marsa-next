import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

// GET /api/products/by-store/:storeId — list a store's products (needs auth).
// Ported from marsa-backend/src/routes/products.js (GET /by-store/:storeId).
export async function GET(req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const { storeId } = await params;
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) return NextResponse.json({ error: "You do not own this store" }, { status: 403 });

    // deletedAt: null excludes products the merchant deleted, while still
    // showing out-of-stock ones (active: false but not deleted) — see the
    // comment on Product.deletedAt in schema.prisma.
    // Capped as a scale safety net (see admin/orders for the same
    // reasoning) — the new Product.storeId index makes the lookup itself
    // cheap; this bounds response size once a store has thousands of
    // products. Ordered explicitly since a cap without one would return an
    // arbitrary, non-deterministic subset.
    const products = await prisma.product.findMany({
      where: { storeId, deletedAt: null },
      include: { variants: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    return NextResponse.json(products);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
