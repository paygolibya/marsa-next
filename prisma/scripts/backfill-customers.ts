// One-time, idempotent backfill: populates Customer rows from Order
// history that predates the Customer upsert in /api/orders' own
// transaction. Safe to re-run — a (storeId, phone) pair that already has
// a Customer row (e.g. from a real order placed after this feature
// shipped) is skipped entirely, so this never double-counts.
// Run with: npx tsx prisma/scripts/backfill-customers.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const orders = await prisma.order.findMany({
    select: { storeId: true, buyerPhone: true, buyerName: true, buyerEmail: true, buyerCity: true, totalCents: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  type Agg = { name: string; email: string | null; city: string; orderCount: number; totalSpentCents: number; lastOrderAt: Date };
  const byKey = new Map<string, Agg>();

  for (const o of orders) {
    const key = `${o.storeId}:${o.buyerPhone}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.totalSpentCents += o.totalCents;
      existing.lastOrderAt = o.createdAt;
      existing.name = o.buyerName;
      existing.email = o.buyerEmail;
      existing.city = o.buyerCity;
    } else {
      byKey.set(key, { name: o.buyerName, email: o.buyerEmail, city: o.buyerCity, orderCount: 1, totalSpentCents: o.totalCents, lastOrderAt: o.createdAt });
    }
  }

  let created = 0;
  let skipped = 0;

  for (const [key, agg] of byKey) {
    const [storeId, phone] = key.split(":");
    const exists = await prisma.customer.findUnique({ where: { storeId_phone: { storeId, phone } } });
    if (exists) {
      skipped++;
      continue;
    }
    await prisma.customer.create({
      data: {
        storeId,
        phone,
        name: agg.name,
        email: agg.email,
        city: agg.city,
        orderCount: agg.orderCount,
        totalSpentCents: agg.totalSpentCents,
        lastOrderAt: agg.lastOrderAt,
      },
    });
    created++;
  }

  console.log(`Backfilled ${created} customer(s) from ${orders.length} order(s), skipped ${skipped} already-existing.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
