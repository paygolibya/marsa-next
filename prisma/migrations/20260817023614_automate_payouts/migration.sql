/*
  Warnings:

  - You are about to drop the column `created_at` on the `commissions` table. All the data in the column will be lost.
  - You are about to drop the column `marked_paid_at` on the `payouts` table. All the data in the column will be lost.
  - You are about to drop the column `marked_paid_by` on the `payouts` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "commissions" DROP COLUMN "created_at",
ADD COLUMN     "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'calculated';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "merchant_payout_cents" INTEGER,
ADD COLUMN     "payout_calculated_at" TIMESTAMP(3),
ADD COLUMN     "payout_status" TEXT,
ADD COLUMN     "payout_transferred_at" TIMESTAMP(3),
ADD COLUMN     "rifqa_commission_cents" INTEGER;

-- AlterTable
ALTER TABLE "payouts" DROP COLUMN "marked_paid_at",
DROP COLUMN "marked_paid_by",
ADD COLUMN     "transfer_reference" TEXT,
ADD COLUMN     "transferred_at" TIMESTAMP(3),
ADD COLUMN     "transferred_by" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ready_for_transfer';

-- CreateTable
CREATE TABLE "cron_logs" (
    "id" TEXT NOT NULL,
    "job_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orders_processed" INTEGER NOT NULL DEFAULT 0,
    "payouts_created" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_logs_pkey" PRIMARY KEY ("id")
);
