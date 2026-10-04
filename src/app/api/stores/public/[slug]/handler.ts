import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";
import { normalizeToSections } from "@/components/storefront/sections/normalize";

type StoredSection = { id: string; type: string; position: number; enabled: boolean; settings: unknown };

type StoreRow = {
  id: string;
  courier: string;
  type: string;
  customization: {
    sectionOrder?: unknown;
    showSocialProof?: boolean | null;
    showTestimonials?: boolean | null;
    showNewsletter?: boolean | null;
  } | null;
  merchant: {
    subscriptionTier?: string | null;
    directWireEnabled?: boolean | null;
    receiptUploadEnabled?: boolean | null;
    codEnabled?: boolean | null;
    dpayEnabled?: boolean | null;
    allowMultiplePaymentMethods?: boolean | null;
    apiAccessEnabled?: boolean | null;
    selectedPaymentMethod?: string | null;
    subscriptionEndDate?: Date | string | null;
  };
  sections: StoredSection[];
  [key: string]: unknown;
};

type ProductRow = { id: string; name: string; description: string | null; priceCents: number };

export type PublicStoreDb = {
  store: {
    findUnique: (args: {
      where: { slug: string };
      include: { customization: { include: { template: true } }; merchant: true; sections: true };
    }) => Promise<StoreRow | null>;
  };
  product: {
    findMany: (args: {
      where: { storeId: string; active: true };
      select: {
        id: true;
        name: true;
        description: true;
        priceCents: true;
        imageUrl: true;
        images: true;
        variantOptions: true;
        variants: { where: { active: true }; select: { id: true; options: true; priceCents: true; stockQty: true } };
      };
    }) => Promise<ProductRow[]>;
  };
  order: { count: (args: { where: { storeId: string; status: "delivered" } }) => Promise<number> };
  productReview: {
    aggregate: (args: {
      where: { product: { storeId: string } };
      _avg: { rating: true };
      _count: { rating: true };
    }) => Promise<{ _avg: { rating: number | null }; _count: { rating: number } }>;
    findMany: (args: {
      where: { product: { storeId: string }; rating: { gte: number }; reviewText: { not: null } };
      orderBy: { createdAt: "desc" };
      take: number;
      select: { buyerName: true; rating: true; reviewText: true; product: { select: { name: true } } };
    }) => Promise<{ buyerName: string; rating: number; reviewText: string | null; product: { name: string } }[]>;
  };
};

// GET /api/stores/public/:slug — public: fetch a store by its public slug
// (what the storefront page loads). No auth required. The merchant row is
// destructured out of the response and never sent as-is — only the one
// derived boolean (dpayAvailable) is exposed, never subscription details,
// feature flags, or anything else about the merchant's account.
export async function handleGetPublicStore(db: PublicStoreDb, slug: string): Promise<Response> {
  try {
    const store = await db.store.findUnique({
      where: { slug },
      include: { customization: { include: { template: true } }, merchant: true, sections: true },
    });
    if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

    const sections = normalizeToSections(store.sections, {
      sectionOrder: store.customization?.sectionOrder as string[] | undefined,
      showSocialProof: store.customization?.showSocialProof ?? true,
      showTestimonials: store.customization?.showTestimonials ?? false,
      showNewsletter: store.customization?.showNewsletter ?? true,
    });
    const statsEnabled = sections.find((s) => s.type === "stats")?.enabled ?? true;
    const testimonialsEnabled = sections.find((s) => s.type === "testimonials")?.enabled ?? false;

    const products = await db.product.findMany({
      where: { storeId: store.id, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        priceCents: true,
        imageUrl: true,
        images: true,
        variantOptions: true,
        variants: { where: { active: true }, select: { id: true, options: true, priceCents: true, stockQty: true } },
      },
    });

    const { merchant, sections: _rawSections, ...publicStore } = store;
    const dpayAvailable = getCheckoutPaymentMethods(getSubscriptionState(merchant)).dpay;

    let stats: { deliveredOrderCount: number; averageRating: number | null; reviewCount: number } | null = null;
    let testimonials: { buyerName: string; rating: number; reviewText: string | null; productName: string }[] = [];

    if (statsEnabled) {
      const [deliveredOrderCount, ratingAgg] = await Promise.all([
        db.order.count({ where: { storeId: store.id, status: "delivered" } }),
        db.productReview.aggregate({
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

    if (testimonialsEnabled) {
      const reviews = await db.productReview.findMany({
        where: { product: { storeId: store.id }, rating: { gte: 4 }, reviewText: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { buyerName: true, rating: true, reviewText: true, product: { select: { name: true } } },
      });
      testimonials = reviews.map((r) => ({ buyerName: r.buyerName, rating: r.rating, reviewText: r.reviewText, productName: r.product.name }));
    }

    return NextResponse.json({ store: { ...publicStore, dpayAvailable, sections }, products, stats, testimonials });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
