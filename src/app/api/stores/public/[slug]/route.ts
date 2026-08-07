import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stores/public/:slug — public: fetch a store by its public slug
// (what the storefront page loads). No auth required.
// Ported from marsa-backend/src/routes/stores.js (GET /public/:slug).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({
      where: { slug },
      include: { customization: { include: { template: true } } },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const products = await prisma.product.findMany({
      where: { storeId: store.id, active: true },
      select: { id: true, name: true, priceCents: true, imageUrl: true },
    });

    return NextResponse.json({ store, products });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
