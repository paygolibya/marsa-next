// Genuine load testing against a real, isolated Postgres instance — not
// the production database (never touched here), and not a mocked/faked
// one either. `embedded-postgres` downloads a real Postgres binary into
// node_modules and runs it as a local subprocess; no Docker, no system
// install, no admin rights needed. This script:
//   1. Starts an embedded Postgres cluster in a scratch directory.
//   2. Runs the real Prisma migrations against it (the actual schema,
//      indexes included).
//   3. Seeds synthetic data far beyond current real platform scale.
//   4. Runs the real hot-path Prisma queries (the ones the indexes added
//      this session target) with concrete timing, at that scale.
//   5. Tears everything down and deletes the scratch data directory.
//
// Run with: node scripts/load-test.mjs
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("./.load-test-pg-data");
const PORT = 54329;
const DATABASE_URL = `postgresql://postgres:password@127.0.0.1:${PORT}/loadtest`;

// Far beyond current real scale (~9 merchants, low hundreds of orders
// total across the whole platform, per the live admin/stats check this
// session) — this is the "what happens at real scale" question, not a
// token gesture at it.
const MERCHANT_COUNT = 100;
const PRODUCTS_PER_STORE = 100;
const ORDERS_PER_ORDINARY_STORE = 300;
const HOT_STORE_ORDER_COUNT = 30000; // one merchant with a genuinely large order history

async function main() {
  if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });

  console.log("Starting embedded Postgres...");
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: "postgres",
    password: "password",
    port: PORT,
    persistent: false,
    onLog: () => {}, // quiet — postgres's own log noise isn't useful here
    onError: (e) => console.error("[pg]", e),
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("loadtest");
  console.log(`Embedded Postgres ready at ${DATABASE_URL}`);

  try {
    console.log("Running real Prisma migrations against it...");
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL },
      stdio: "inherit",
    });

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

    console.log("\nSeeding synthetic data (this takes a minute)...");
    const seedStart = Date.now();
    const { hotStoreId } = await seed(prisma);
    console.log(`Seed complete in ${((Date.now() - seedStart) / 1000).toFixed(1)}s`);

    console.log("\n=== Query benchmarks at scale ===");
    await bench(prisma, hotStoreId);

    await prisma.$disconnect();
  } finally {
    console.log("\nStopping embedded Postgres and cleaning up...");
    await pg.stop();
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log("Done — no trace left on disk, production database never touched.");
  }
}

async function seed(prisma) {
  let hotStoreId = null;

  for (let m = 0; m < MERCHANT_COUNT; m++) {
    const merchant = await prisma.merchant.create({
      data: {
        name: `Load Test Merchant ${m}`,
        phone: `09${String(10000000 + m).padStart(8, "0")}`,
        passwordHash: "x",
        subscriptionStatus: "active",
      },
    });
    const store = await prisma.store.create({
      data: { merchantId: merchant.id, name: `Load Test Store ${m}`, slug: `load-test-store-${m}` },
    });
    if (m === 0) hotStoreId = store.id;

    const products = await prisma.product.createManyAndReturn({
      data: Array.from({ length: PRODUCTS_PER_STORE }, (_, i) => ({
        storeId: store.id,
        name: `Product ${i}`,
        priceCents: 1000 + i,
      })),
    });

    const orderCount = m === 0 ? HOT_STORE_ORDER_COUNT : ORDERS_PER_ORDINARY_STORE;
    const BATCH = 1000;
    for (let batchStart = 0; batchStart < orderCount; batchStart += BATCH) {
      const batchSize = Math.min(BATCH, orderCount - batchStart);
      const orderRows = Array.from({ length: batchSize }, (_, i) => {
        const idx = batchStart + i;
        return {
          storeId: store.id,
          buyerName: `Buyer ${idx}`,
          buyerPhone: "0900000000",
          buyerCity: "Tripoli",
          buyerAddress: "Test",
          paymentMethod: idx % 3 === 0 ? "wallet" : "cod",
          paymentStatus: idx % 3 === 0 ? "paid" : "pending",
          status: "delivered",
          totalCents: 5000 + idx,
          createdAt: new Date(Date.now() - idx * 60_000),
        };
      });
      const created = await prisma.order.createManyAndReturn({ data: orderRows });
      await prisma.orderItem.createMany({
        data: created.map((order, i) => ({
          orderId: order.id,
          productId: products[i % products.length].id,
          productName: products[i % products.length].name,
          unitPriceCents: 5000,
          quantity: 1,
        })),
      });
    }
    if (m % 20 === 0) console.log(`  seeded ${m + 1}/${MERCHANT_COUNT} stores...`);
  }

  return { hotStoreId };
}

async function timed(label, fn) {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;
  const count = Array.isArray(result) ? result.length : typeof result === "object" ? JSON.stringify(result).length : "";
  console.log(`${label}: ${ms}ms${count !== "" ? ` (${count} rows/bytes)` : ""}`);
  return result;
}

async function bench(prisma, hotStoreId) {
  const totalOrders = await prisma.order.count();
  console.log(`Total orders in DB: ${totalOrders.toLocaleString()} (the hot store alone has ${HOT_STORE_ORDER_COUNT.toLocaleString()})\n`);

  // Mirrors GET /api/orders/by-store/:storeId — the exact query, on the
  // store with 30,000 orders, using the Order(storeId, createdAt) index
  // added this session.
  await timed("orders/by-store (hot store, 30k orders, capped+indexed)", () =>
    prisma.order.findMany({ where: { storeId: hotStoreId }, orderBy: { createdAt: "desc" }, include: { items: true }, take: 1000 })
  );

  // Mirrors GET /api/analytics/by-store/:storeId?days=30 — the CURRENT
  // (post-fix) route: two GROUP BY aggregates in Postgres, not a full
  // order+items fetch into app memory.
  await timed("analytics/by-store (hot store, 30-day window, DB-aggregated)", async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [daily, products] = await Promise.all([
      prisma.$queryRaw`
        SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*)::int as orders, SUM(total_cents)::int as "revenueCents"
        FROM orders WHERE store_id = ${hotStoreId} AND created_at >= ${since} GROUP BY date
      `,
      prisma.$queryRaw`
        SELECT oi.product_id as "productId", MAX(oi.product_name) as name, SUM(oi.quantity)::int as quantity, SUM(oi.unit_price_cents * oi.quantity)::int as "revenueCents"
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.store_id = ${hotStoreId} AND o.created_at >= ${since} GROUP BY oi.product_id
      `,
    ]);
    return { daily, products };
  });

  // Mirrors GET /api/products/by-store/:storeId.
  await timed("products/by-store (hot store, 100 products)", () =>
    prisma.product.findMany({ where: { storeId: hotStoreId, deletedAt: null }, include: { variants: true }, orderBy: { createdAt: "desc" }, take: 1000 })
  );

  // Mirrors GET /api/admin/orders — platform-wide, cursor-paginated, across
  // ~100 merchants and tens of thousands of orders.
  await timed("admin/orders (platform-wide, first cursor page)", () =>
    prisma.order.findMany({ include: { store: true }, orderBy: { createdAt: "desc" }, take: 50 })
  );

  // Mirrors GET /api/admin/merchants.
  await timed("admin/merchants (100 merchants, cursor page)", () =>
    prisma.merchant.findMany({ include: { stores: true }, orderBy: { createdAt: "desc" }, take: 100 })
  );

  // Mirrors the admin/stats database-side aggregate (added this session to
  // replace an unbounded findMany+reduce).
  await timed("admin/stats revenue aggregate", () => prisma.payment.aggregate({ where: { status: "approved" }, _sum: { amount: true } }));

  console.log("\n=== Concurrency: 50 concurrent by-store reads against the hot store ===");
  const concStart = Date.now();
  await Promise.all(
    Array.from({ length: 50 }, () =>
      prisma.order.findMany({ where: { storeId: hotStoreId }, orderBy: { createdAt: "desc" }, include: { items: true }, take: 1000 })
    )
  );
  console.log(`50 concurrent queries completed in ${Date.now() - concStart}ms`);
}

main().catch((err) => {
  console.error("Load test failed:", err);
  process.exitCode = 1;
});
