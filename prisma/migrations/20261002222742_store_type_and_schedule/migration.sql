-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'physical';

-- Backfill: every store that was flagged is_digital=true becomes type='digital'.
UPDATE "stores" SET "type" = 'digital' WHERE "is_digital" = true;

-- AlterTable
ALTER TABLE "stores" DROP COLUMN "is_digital";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "scheduled_start_at" TIMESTAMP(3),
ADD COLUMN     "scheduled_end_at" TIMESTAMP(3);
