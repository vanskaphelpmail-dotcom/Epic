-- Customers Feedback gallery (storefront carousel before Physical Outlets)
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "customerFeedbackGallery" JSONB;
