-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "custom_domain" TEXT,
ADD COLUMN     "custom_domain_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "stores_custom_domain_key" ON "stores"("custom_domain");

