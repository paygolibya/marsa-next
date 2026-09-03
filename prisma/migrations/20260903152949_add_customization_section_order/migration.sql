-- AlterTable
ALTER TABLE "template_customizations" ADD COLUMN     "section_order" TEXT[] DEFAULT ARRAY['stats', 'products', 'testimonials', 'newsletter']::TEXT[];
