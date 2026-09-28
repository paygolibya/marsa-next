-- CreateIndex
CREATE INDEX "commissions_merchant_id_idx" ON "commissions"("merchant_id");

-- CreateIndex
CREATE INDEX "commissions_payout_id_idx" ON "commissions"("payout_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "orders_store_id_created_at_idx" ON "orders"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "payouts_merchant_id_idx" ON "payouts"("merchant_id");

-- CreateIndex
CREATE INDEX "products_store_id_idx" ON "products"("store_id");
