-- AlterTable
ALTER TABLE "template_customizations" ADD COLUMN     "cover_image_size" TEXT NOT NULL DEFAULT 'md',
ADD COLUMN     "hero_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hero_size" TEXT NOT NULL DEFAULT 'md',
ADD COLUMN     "show_logo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "text_size" TEXT NOT NULL DEFAULT 'md';
