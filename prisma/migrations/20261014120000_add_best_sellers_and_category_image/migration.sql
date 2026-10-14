-- Merchant-pinned "best seller" flag on products
ALTER TABLE "products" ADD COLUMN "is_best_seller" BOOLEAN NOT NULL DEFAULT false;

-- Optional image for the storefront's "shop by category" visual cards
ALTER TABLE "categories" ADD COLUMN "image_url" TEXT;
