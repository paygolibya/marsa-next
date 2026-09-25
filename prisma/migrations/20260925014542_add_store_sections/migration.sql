-- CreateTable
CREATE TABLE "store_sections" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_sections_store_id_idx" ON "store_sections"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_sections_store_id_position_key" ON "store_sections"("store_id", "position");

-- AddForeignKey
ALTER TABLE "store_sections" ADD CONSTRAINT "store_sections_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
