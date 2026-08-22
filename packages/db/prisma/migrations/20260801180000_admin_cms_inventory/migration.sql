-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "warehouse" TEXT DEFAULT 'Dhaka Central';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "binCode" TEXT;

-- AlterTable
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "meta" JSONB;
