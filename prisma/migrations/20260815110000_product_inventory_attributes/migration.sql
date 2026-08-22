ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "dupe" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "season" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "spring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "summer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autumn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "winter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "allSeason" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mainAccords" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastStockUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastStockAddedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Product_supplierId_idx" ON "Product"("supplierId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_supplierId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;
CREATE INDEX IF NOT EXISTS "InventoryMovement_supplierId_idx" ON "InventoryMovement"("supplierId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_supplierId_fkey') THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
