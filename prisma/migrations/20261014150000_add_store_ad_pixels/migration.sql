-- Merchant-configured ad-pixel IDs for storefront conversion tracking
ALTER TABLE "stores" ADD COLUMN "facebook_pixel_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "tiktok_pixel_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "google_ads_conversion_id" TEXT;
ALTER TABLE "stores" ADD COLUMN "google_ads_conversion_label" TEXT;
