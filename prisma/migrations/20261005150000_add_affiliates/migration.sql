-- AlterTable
ALTER TABLE "orders" ADD COLUMN "affiliate_code" TEXT;

-- CreateTable
CREATE TABLE "affiliates" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "commission_percent" INTEGER NOT NULL DEFAULT 10,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "payout_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payouts" (
    "id" TEXT NOT NULL,
    "affiliate_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready_for_transfer',
    "transferred_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliates_store_id_code_key" ON "affiliates"("store_id", "code");

-- CreateIndex
CREATE INDEX "affiliates_store_id_idx" ON "affiliates"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commissions_order_id_key" ON "affiliate_commissions"("order_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_affiliate_id_idx" ON "affiliate_commissions"("affiliate_id");

-- CreateIndex
CREATE INDEX "affiliate_commissions_payout_id_idx" ON "affiliate_commissions"("payout_id");

-- CreateIndex
CREATE INDEX "affiliate_payouts_affiliate_id_idx" ON "affiliate_payouts"("affiliate_id");

-- AddForeignKey
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "affiliate_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_fkey" FOREIGN KEY ("affiliate_id") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
