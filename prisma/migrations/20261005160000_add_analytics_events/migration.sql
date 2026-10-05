-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "referrer" TEXT,
    "device" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_event_attempts" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_event_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_store_id_created_at_idx" ON "analytics_events"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_store_id_type_created_at_idx" ON "analytics_events"("store_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "analytics_event_attempts_ip_created_at_idx" ON "analytics_event_attempts"("ip", "created_at");

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
