-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "subscription_period_months" INTEGER;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "period_months" INTEGER NOT NULL DEFAULT 1;

-- Backfill: the platform moved from three feature-gated tiers to one plan
-- with everything included (only the billing PERIOD varies now) — every
-- existing merchant gets the full feature set retroactively, not just new
-- signups/payments going forward.
UPDATE "merchants" SET
  "direct_wire_enabled" = true,
  "receipt_upload_enabled" = true,
  "cod_enabled" = true,
  "dpay_enabled" = true,
  "allow_multiple_payment_methods" = true,
  "api_access_enabled" = true;
