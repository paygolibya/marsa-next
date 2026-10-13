-- AlterTable
ALTER TABLE "templates" ADD COLUMN "industries" TEXT[] DEFAULT ARRAY[]::TEXT[];
