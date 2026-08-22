-- AlterTable
ALTER TABLE "page_sections" ADD COLUMN IF NOT EXISTS "meta" JSONB;

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "categoryItems" JSONB;
