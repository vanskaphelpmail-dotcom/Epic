-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "menuItems" JSONB;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "footerLocations" JSONB;
