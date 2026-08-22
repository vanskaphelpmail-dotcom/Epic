-- Align addon defaults with storefront BDT pricing (was 300 from initial migration)
ALTER TABLE "products"
  ALTER COLUMN "namesetPriceBdt" SET DEFAULT 15,
  ALTER COLUMN "badgePriceBdt" SET DEFAULT 15;

UPDATE "products"
SET
  "namesetPriceBdt" = 15,
  "badgePriceBdt" = 15
WHERE "namesetPriceBdt" = 300 AND "badgePriceBdt" = 300;
