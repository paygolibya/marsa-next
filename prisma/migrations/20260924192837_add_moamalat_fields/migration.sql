-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "moamalat_network_reference" TEXT,
ADD COLUMN     "moamalat_system_reference" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "moamalat_network_reference" TEXT,
ADD COLUMN     "moamalat_system_reference" TEXT;
