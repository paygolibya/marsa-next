// One-time, idempotent backfill: populates StoreSection rows from each
// store's existing TemplateCustomization.sectionOrder/show* fields. Safe to
// re-run — a store with any existing StoreSection rows is skipped, so this
// never duplicates or overwrites real editor changes made after the first
// run. Run with: npx tsx prisma/scripts/backfill-store-sections.ts
import { PrismaClient } from "@prisma/client";
import { normalizeSectionOrder } from "../../src/components/storefront/templates/types";
import type { SectionType } from "../../src/components/storefront/sections/types";

const prisma = new PrismaClient();

async function main() {
  const customizations = await prisma.templateCustomization.findMany({
    select: { storeId: true, sectionOrder: true, showSocialProof: true, showTestimonials: true, showNewsletter: true },
  });

  let processed = 0;
  let skipped = 0;
  let errored = 0;

  for (const c of customizations) {
    try {
      const existing = await prisma.storeSection.count({ where: { storeId: c.storeId } });
      if (existing > 0) {
        skipped++;
        continue;
      }

      const legacyEnabled: Record<SectionType, boolean> = {
        stats: c.showSocialProof,
        products: true,
        testimonials: c.showTestimonials,
        newsletter: c.showNewsletter,
      };

      const order = normalizeSectionOrder(c.sectionOrder);
      await prisma.storeSection.createMany({
        data: order.map((type, position) => ({
          storeId: c.storeId,
          type,
          position,
          enabled: legacyEnabled[type],
          settings: {},
        })),
      });
      processed++;
    } catch (err) {
      errored++;
      console.error(`Failed to backfill store ${c.storeId}:`, err);
    }
  }

  console.log(`Backfill complete. processed=${processed} skipped=${skipped} errored=${errored} total=${customizations.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
