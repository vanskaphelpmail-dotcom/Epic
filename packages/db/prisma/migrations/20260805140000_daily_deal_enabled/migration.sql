-- Global Flash Offer / Daily Deal visibility (all visitors)
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "dailyDealEnabled" BOOLEAN NOT NULL DEFAULT false;
