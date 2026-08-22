-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "bkashPaymentMode" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "store_settings" ADD COLUMN IF NOT EXISTS "bkashPartialAmountBdt" INTEGER NOT NULL DEFAULT 300;
