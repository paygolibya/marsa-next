-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "subscription_end_date" TIMESTAMP(3),
ADD COLUMN     "subscription_tier" TEXT DEFAULT 'starter';
