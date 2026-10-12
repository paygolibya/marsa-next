-- Additive, nullable column — no backfill, safe on live data.
ALTER TABLE "stores" ADD COLUMN "industry" TEXT;
