-- Ensure multi-category / multi size-chart columns exist (schema already declares them).
-- Safe to re-run: IF NOT EXISTS.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizeChartIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
