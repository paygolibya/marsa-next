-- CreateTable
CREATE TABLE "upsells" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "trigger_product_id" TEXT NOT NULL,
    "offered_product_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upsells_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upsells_store_id_trigger_product_id_offered_product_id_key" ON "upsells"("store_id", "trigger_product_id", "offered_product_id");

-- CreateIndex
CREATE INDEX "upsells_store_id_idx" ON "upsells"("store_id");

-- CreateIndex
CREATE INDEX "upsells_trigger_product_id_idx" ON "upsells"("trigger_product_id");

-- AddForeignKey
ALTER TABLE "upsells" ADD CONSTRAINT "upsells_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsells" ADD CONSTRAINT "upsells_trigger_product_id_fkey" FOREIGN KEY ("trigger_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsells" ADD CONSTRAINT "upsells_offered_product_id_fkey" FOREIGN KEY ("offered_product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
