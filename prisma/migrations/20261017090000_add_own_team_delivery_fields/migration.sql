-- Rifqa's own Tripoli delivery team: service level, driver status and cash collection on orders.
-- All nullable; existing orders and Vanex orders keep NULL.
ALTER TABLE "orders" ADD COLUMN "delivery_service_level" TEXT;
ALTER TABLE "orders" ADD COLUMN "delivery_status" TEXT;
ALTER TABLE "orders" ADD COLUMN "delivery_courier_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "cash_collected_cents" INTEGER;
ALTER TABLE "orders" ADD COLUMN "cash_collected_at" TIMESTAMP(3);
