-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nav_menu_items" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "nav_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_store_id_slug_key" ON "pages"("store_id", "slug");

-- CreateIndex
CREATE INDEX "pages_store_id_idx" ON "pages"("store_id");

-- CreateIndex
CREATE INDEX "nav_menu_items_store_id_idx" ON "nav_menu_items"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_store_id_from_path_key" ON "redirects"("store_id", "from_path");

-- CreateIndex
CREATE INDEX "redirects_store_id_idx" ON "redirects"("store_id");

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nav_menu_items" ADD CONSTRAINT "nav_menu_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
