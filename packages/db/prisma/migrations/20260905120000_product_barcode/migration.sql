-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "products_barcode_key" ON "products"("barcode");
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products"("barcode");
