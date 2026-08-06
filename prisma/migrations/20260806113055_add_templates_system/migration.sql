-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "template_id" TEXT;

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'all',
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "billingType" TEXT NOT NULL DEFAULT 'free',
    "thumbnail" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "componentPath" TEXT,
    "defaultColors" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_customizations" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "template_id" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#0066cc',
    "secondary_color" TEXT NOT NULL DEFAULT '#f0f0f0',
    "accent_color" TEXT,
    "logo" TEXT,
    "favicon" TEXT,
    "tagline" TEXT,
    "description" TEXT,
    "header_style" TEXT NOT NULL DEFAULT 'standard',
    "footer_style" TEXT NOT NULL DEFAULT 'standard',
    "show_newsletter" BOOLEAN NOT NULL DEFAULT true,
    "show_reviews" BOOLEAN NOT NULL DEFAULT true,
    "show_testimonials" BOOLEAN NOT NULL DEFAULT false,
    "show_social_proof" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_customizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_reviews" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "review_text_ar" TEXT,
    "helpful" INTEGER NOT NULL DEFAULT 0,
    "not_helpful" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "templates_slug_key" ON "templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "template_customizations_store_id_key" ON "template_customizations"("store_id");

-- AddForeignKey
ALTER TABLE "template_customizations" ADD CONSTRAINT "template_customizations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_customizations" ADD CONSTRAINT "template_customizations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_reviews" ADD CONSTRAINT "template_reviews_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
