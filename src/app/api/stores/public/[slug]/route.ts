import { prisma } from "@/lib/prisma";
import type { SoldCount } from "@/lib/best-sellers";
import { handleGetPublicStore, type PublicStoreDb } from "./handler";

// Mirrors the analytics route's own prisma-plus-raw-query wrapper (see
// src/app/api/analytics/by-store/[storeId]/route.ts) — aggregates units
// sold per product in Postgres (GROUP BY) rather than pulling every order
// item into app memory. All-time, not windowed by date (unlike the
// analytics "top products" query), and excludes cancelled/refunded orders
// so a bad order never inflates a product into looking like a best seller.
const db: PublicStoreDb = {
  store: prisma.store,
  product: prisma.product,
  category: prisma.category,
  bundle: prisma.bundle,
  upsell: prisma.upsell,
  navMenuItem: prisma.navMenuItem,
  order: prisma.order,
  productReview: prisma.productReview,
  queryBestSellerSales: (storeId, limit) =>
    prisma.$queryRaw<SoldCount[]>`
      SELECT oi.product_id as "productId", SUM(oi.quantity)::int as quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = ${storeId}
        AND oi.product_id IS NOT NULL
        AND o.status NOT IN ('cancelled', 'refunded')
      GROUP BY oi.product_id
      ORDER BY quantity DESC
      LIMIT ${limit}
    `,
};

// GET /api/stores/public/:slug — see handler.ts for the actual logic
// (injectable there so it can be integration-tested with fakes;
// handler.test.ts).
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return handleGetPublicStore(db, slug);
}
