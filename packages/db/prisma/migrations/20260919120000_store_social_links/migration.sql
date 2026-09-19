-- Footer social profile URLs (Facebook / Instagram / TikTok)
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "socialLinks" JSONB;
