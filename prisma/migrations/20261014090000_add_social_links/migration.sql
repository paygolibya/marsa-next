-- AlterTable: optional merchant social-profile links, shown in the storefront footer
ALTER TABLE "template_customizations" ADD COLUMN "instagram_url" TEXT;
ALTER TABLE "template_customizations" ADD COLUMN "facebook_url" TEXT;
ALTER TABLE "template_customizations" ADD COLUMN "tiktok_url" TEXT;
