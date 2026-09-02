-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "dpay_fee_cents" INTEGER,
ADD COLUMN     "dpay_pay_method" TEXT,
ADD COLUMN     "dpay_session_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_dpay_session_id_key" ON "orders"("dpay_session_id");

