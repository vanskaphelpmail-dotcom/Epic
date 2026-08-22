ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "deliveryCharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "recheckedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "recheckedById" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

UPDATE "Sale" SET "paidAmount" = "total" WHERE "paymentStatus" = 'PAID' AND "paidAmount" = 0;

CREATE TABLE IF NOT EXISTS "SaleRevision" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "previousTotal" DOUBLE PRECISION NOT NULL,
  "updatedTotal" DOUBLE PRECISION NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SaleRevision_saleId_idx" ON "SaleRevision"("saleId");
CREATE INDEX IF NOT EXISTS "SaleRevision_createdAt_idx" ON "SaleRevision"("createdAt");

DO $$ BEGIN
  ALTER TABLE "SaleRevision" ADD CONSTRAINT "SaleRevision_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
