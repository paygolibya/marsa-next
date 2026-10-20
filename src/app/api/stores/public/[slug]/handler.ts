import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSubscriptionState, getCheckoutPaymentMethods } from "@/lib/checkout-features";
import { isSubscriptionLive, STORE_LOCKED_STATUS } from "@/lib/subscription/access";
import { normalizeToSections } from "@/components/storefront/sections/normalize";
import { rankBestSellers, type SoldCount } from "@/lib/best-sellers";
import { safeParseSettings, bestSellersSettingsSchema } from "@/components/storefront/sections/schemas";

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
    subscriptionStatus?: string | null;
  };
  sections: StoredSection[];
  [key: string]: unknown;
};

type ProductRow = { id: string; name: string; description: string | null; priceCents: number; categoryId: string | null; translations: unknown; isBestSeller: boolean };
type CategoryRow = { id: string; name: string; slug: string; imageUrl: string | null };
type BundleRow = {
  id: string;
  storeId: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  active: boolean;
  createdAt: Date;
  items: { id: string; productId: string; quantity: number; product: { name: string; priceCents: number; imageUrl: string | null } }[];
};

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
        categoryId: true;
        translations: true;
        isBestSeller: true;
        variants: { where: { active: true }; select: { id: true; options: true; priceCents: true; stockQty: true } };
      };
    }) => Promise<ProductRow[]>;
  };
  category: {
    findMany: (args: { where: { storeId: string }; orderBy: { position: "asc" } }) => Promise<CategoryRow[]>;
  };
  bundle: {
    findMany: (args: {
      where: { storeId: string; active: true };
      include: { items: { include: { product: { select: { name: true; priceCents: true; imageUrl: true } } } } };
    }) => Promise<BundleRow[]>;
  };
  upsell: {
    findMany: (args: {
      where: { storeId: string; active: true };
      select: { triggerProductId: true; offeredProductId: true };
    }) => Promise<{ triggerProductId: string; offeredProductId: string }[]>;
  };
  navMenuItem: {
    findMany: (args: { where: { storeId: string }; orderBy: { position: "asc" } }) => Promise<{ id: string; label: string; url: string }[]>;
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
  // Raw aggregate (GROUP BY in Postgres, same rationale as queryTopProducts
  // in the analytics route — see src/lib/analytics.ts) of units sold per
  // product, all-time, excluding cancelled/refunded orders. Only the
  // top `limit` rows — the final pinned-vs-auto merge happens in
  // src/lib/best-sellers.ts.
  queryBestSellerSales: (storeId: string, limit: number) => Promise<SoldCount[]>;
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
    // Trial/paid period over and not renewed: the storefront is paused
    // until the merchant pays (see lib/subscription/access.ts).
    if (!isSubscriptionLive(store.merchant)) {
      return NextResponse.json({ error: "store_paused", storeName: store.name }, { status: STORE_LOCKED_STATUS });
    }

    const sections = normalizeToSections(store.sections, {
      sectionOrder: store.customization?.sectionOrder as string[] | undefined,
      showSocialProof: store.customization?.showSocialProof ?? true,
      showTestimonials: store.customization?.showTestimonials ?? false,
      showNewsletter: store.customization?.showNewsletter ?? true,
    });
    const statsEnabled = sections.find((s) => s.type === "stats")?.enabled ?? true;
    const testimonialsEnabled = sections.find((s) => s.type === "testimonials")?.enabled ?? false;
    const bestSellersSection = sections.find((s) => s.type === "bestSellers");
    const bestSellersEnabled = bestSellersSection?.enabled ?? false;

    const [products, categories, bundles, upsells, navMenuItems] = await Promise.all([
      db.product.findMany({
        where: { storeId: store.id, active: true },
        select: {
          id: true,
          name: true,
          description: true,
          priceCents: true,
          imageUrl: true,
          images: true,
          variantOptions: true,
          categoryId: true,
          translations: true,
          isBestSeller: true,
          variants: { where: { active: true }, select: { id: true, options: true, priceCents: true, stockQty: true } },
        },
      }),
      db.category.findMany({ where: { storeId: store.id }, orderBy: { position: "asc" } }),
      db.bundle.findMany({
        where: { storeId: store.id, active: true },
        include: { items: { include: { product: { select: { name: true, priceCents: true, imageUrl: true } } } } },
      }),
      db.upsell.findMany({ where: { storeId: store.id, active: true }, select: { triggerProductId: true, offeredProductId: true } }),
      db.navMenuItem.findMany({ where: { storeId: store.id }, orderBy: { position: "asc" } }),
    ]);

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

    // Pinned products are already in hand (part of the main products
    // query above) even when bestSellersEnabled is false, but the sales
    // aggregate is its own query — only run it when the section is
    // actually on, same gating as stats/testimonials above.
    let bestSellers: ProductRow[] = [];
    if (bestSellersEnabled) {
      const { limit } = safeParseSettings(bestSellersSettingsSchema, bestSellersSection?.settings);
      const soldCounts = await db.queryBestSellerSales(store.id, limit);
      bestSellers = rankBestSellers(products, soldCounts, limit);
    }

    return NextResponse.json({ store: { ...publicStore, dpayAvailable, sections }, products, categories, bundles, upsells, navMenuItems, stats, testimonials, bestSellers });
  } catch (err) {
    console.error(err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
