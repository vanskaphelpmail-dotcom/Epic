-- Admin-controlled flash / hot deals: multiple products with fixed deal prices
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "dailyDealItems" JSONB;
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "dailyDealEndsAt" TIMESTAMP(3);
