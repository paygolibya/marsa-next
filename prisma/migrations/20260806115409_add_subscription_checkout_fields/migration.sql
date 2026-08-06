-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "allow_multiple_payment_methods" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "api_access_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cod_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "direct_wire_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dpay_api_token" TEXT,
ADD COLUMN     "dpay_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receipt_upload_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "selected_payment_method" TEXT,
ALTER COLUMN "subscription_tier" SET DEFAULT 'basic';
