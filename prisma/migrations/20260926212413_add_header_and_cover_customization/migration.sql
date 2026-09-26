-- AlterTable
ALTER TABLE "template_customizations" ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "logo_size" TEXT NOT NULL DEFAULT 'md',
ADD COLUMN     "show_store_name" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "text_color" TEXT;
