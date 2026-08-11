import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";

// GET /api/stores/public/:slug — public: fetch a store by its public slug
// (what the storefront page loads). No auth required.
// Ported from marsa-backend/src/routes/stores.js (GET /public/:slug).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const store = await prisma.store.findUnique({
      where: { slug },
      include: { customization: { include: { template: true } }, merchant: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const products = await prisma.product.findMany({
      where: { storeId: store.id, active: true },
      select: { id: true, name: true, priceCents: true, imageUrl: true },
    });

    // dpayAvailable reflects the store owner's subscription plan — Basic
    // has no DPay, Professional only if they picked it as their one
    // automated method, Advanced always. Only this one derived boolean is
    // exposed publicly, never the merchant's subscription details.
    const { merchant, ...publicStore } = store;
    const dpayAvailable = getCheckoutPaymentMethods(getSubscriptionState(merchant)).dpay;

    return NextResponse.json({ store: { ...publicStore, dpayAvailable }, products });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
