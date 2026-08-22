-- Per-product nameset & tournament badge pricing (BDT) + display labels
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "namesetPriceBdt" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS "badgePriceBdt" INTEGER NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS "namesetLabel" TEXT NOT NULL DEFAULT 'Custom Nameset Printing',
  ADD COLUMN IF NOT EXISTS "badgeLabel" TEXT NOT NULL DEFAULT 'WC ''26';
