-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "booking_slot_minutes" INTEGER,
ADD COLUMN     "booking_working_hours" JSONB;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "scheduled_kind" TEXT;

-- Backfill: every existing rental order (shipped with scheduledStartAt
-- already set, before this column existed) is tagged accordingly so the
-- partial index below doesn't need a separate migration later.
UPDATE "orders" SET "scheduled_kind" = 'rental'
WHERE "scheduled_start_at" IS NOT NULL
  AND "store_id" IN (SELECT "id" FROM "stores" WHERE "type" = 'rental');

-- Prevents double-booking the same appointment slot atomically at the DB
-- level — the same way the stock-decrement guard prevents overselling.
-- Scoped to scheduled_kind = 'booking' specifically (not just "any order
-- with a scheduled_start_at") because rental orders also populate these
-- two columns and MUST be allowed to share a start date — two different
-- rentals legitimately can both start on the same day. Partial (WHERE
-- clause) index: Prisma's schema language can't express this, so it's
-- hand-written here and documented in schema.prisma's comment on
-- Order.scheduledKind rather than reflected as a @@index.
CREATE UNIQUE INDEX "orders_store_booking_slot_unique" ON "orders"("store_id", "scheduled_start_at")
WHERE "scheduled_kind" = 'booking';
