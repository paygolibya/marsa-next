-- AlterTable
ALTER TABLE "stores" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ar',
ADD COLUMN "supported_languages" TEXT[] DEFAULT ARRAY['ar']::TEXT[];

-- AlterTable
ALTER TABLE "products" ADD COLUMN "translations" JSONB;
