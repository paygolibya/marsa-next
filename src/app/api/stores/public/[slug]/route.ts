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
      select: {
        id: true,
        name: true,
        priceCents: true,
        imageUrl: true,
        images: true,
        variantOptions: true,
        variants: { where: { active: true }, select: { id: true, options: true, priceCents: true, stockQty: true } },
      },
    });

    // dpayAvailable reflects the store owner's subscription plan — Basic
    // has no DPay, Professional only if they picked it as their one
    // automated method, Advanced always. Only this one derived boolean is
    // exposed publicly, never the merchant's subscription details.
    const { merchant, ...publicStore } = store;
    const dpayAvailable = getCheckoutPaymentMethods(getSubscriptionState(merchant)).dpay;

    // Real numbers behind the customizer's "عرض عدد العملاء والمبيعات"
    // toggle — previously saved to the DB and never queried or rendered
    // anywhere. Only computed when the merchant actually enabled it
    // (default true, but still — no point running these aggregates for a
    // store that opted out).
    let stats: { deliveredOrderCount: number; averageRating: number | null; reviewCount: number } | null = null;
    let testimonials: { buyerName: string; rating: number; reviewText: string | null; productName: string }[] = [];

    if (store.customization?.showSocialProof !== false) {
      const [deliveredOrderCount, ratingAgg] = await Promise.all([
        prisma.order.count({ where: { storeId: store.id, status: "delivered" } }),
        prisma.productReview.aggregate({
          where: { product: { storeId: store.id } },
          _avg: { rating: true },
          _count: { rating: true },
        }),
      ]);
      stats = {
        deliveredOrderCount,
        averageRating: ratingAgg._avg.rating,
        reviewCount: ratingAgg._count.rating,
      };
    }

    if (store.customization?.showTestimonials) {
      const reviews = await prisma.productReview.findMany({
        where: { product: { storeId: store.id }, rating: { gte: 4 }, reviewText: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { buyerName: true, rating: true, reviewText: true, product: { select: { name: true } } },
      });
      testimonials = reviews.map((r) => ({ buyerName: r.buyerName, rating: r.rating, reviewText: r.reviewText, productName: r.product.name }));
    }

    return NextResponse.json({ store: { ...publicStore, dpayAvailable }, products, stats, testimonials });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
