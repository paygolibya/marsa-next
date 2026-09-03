-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variant_id" TEXT,
ADD COLUMN     "variant_label" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "variant_options" JSONB;

-- Backfill: existing products already have a single image_url — carry it
-- into the new gallery array as its first (only) photo, rather than
-- silently starting every existing product's gallery empty.
UPDATE "products" SET "images" = ARRAY["image_url"] WHERE "image_url" IS NOT NULL;

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "price_cents" INTEGER,
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

