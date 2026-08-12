-- DropForeignKey
ALTER TABLE "coupons" DROP CONSTRAINT "coupons_store_id_fkey";

-- DropForeignKey
ALTER TABLE "product_reviews" DROP CONSTRAINT "product_reviews_order_id_fkey";

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
