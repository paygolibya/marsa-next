-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "courier_note" TEXT,
ADD COLUMN     "courier_status" TEXT,
ADD COLUMN     "courier_status_at" TIMESTAMP(3),
ADD COLUMN     "shipping_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vanex_area_id" TEXT;

-- CreateTable
CREATE TABLE "vanex_cities" (
    "id" TEXT NOT NULL,
    "vanex_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "branch" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vanex_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vanex_areas" (
    "id" TEXT NOT NULL,
    "vanex_id" INTEGER NOT NULL,
    "city_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vanex_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vanex_cities_vanex_id_key" ON "vanex_cities"("vanex_id");

-- CreateIndex
CREATE UNIQUE INDEX "vanex_areas_vanex_id_key" ON "vanex_areas"("vanex_id");

-- CreateIndex
CREATE INDEX "vanex_areas_city_id_idx" ON "vanex_areas"("city_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_vanex_area_id_fkey" FOREIGN KEY ("vanex_area_id") REFERENCES "vanex_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vanex_areas" ADD CONSTRAINT "vanex_areas_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "vanex_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
