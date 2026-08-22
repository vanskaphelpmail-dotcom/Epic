-- Default checkout to customer choice (full or partial advance)
ALTER TABLE "store_settings" ALTER COLUMN "bkashPaymentMode" SET DEFAULT 'both';
UPDATE "store_settings" SET "bkashPaymentMode" = 'both' WHERE "bkashPaymentMode" = 'full';
