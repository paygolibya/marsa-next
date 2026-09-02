-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "dpay_fee_cents" INTEGER,
ADD COLUMN     "dpay_pay_method" TEXT,
ADD COLUMN     "dpay_session_id" TEXT,
ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'bank_transfer';

-- CreateIndex
CREATE UNIQUE INDEX "payments_dpay_session_id_key" ON "payments"("dpay_session_id");

