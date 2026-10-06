-- AlterTable
ALTER TABLE "templates" ADD COLUMN "store_types" TEXT[] DEFAULT ARRAY['physical', 'digital']::TEXT[];
