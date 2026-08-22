-- Multiple tournament badge options per product + selected badges on cart/order lines
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "badgeOptions" JSONB;

UPDATE "products"
SET "badgeOptions" = jsonb_build_array(
  jsonb_build_object(
    'id', 'badge-1',
    'label', "badgeLabel",
    'priceBdt', "badgePriceBdt"
  )
)
WHERE "badgeAvailable" = true
  AND ("badgeOptions" IS NULL OR "badgeOptions" = 'null'::jsonb);

ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "selectedBadgeIds" TEXT NOT NULL DEFAULT '';

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "selectedBadgeIds" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "cart_items_cartId_productId_selectedSize_customPrintName_cu_key";

CREATE UNIQUE INDEX "cart_items_cartId_productId_selectedSize_customPrintName_cu_key"
  ON "cart_items"("cartId", "productId", "selectedSize", "customPrintName", "customPrintNum", "selectedBadgeIds");
