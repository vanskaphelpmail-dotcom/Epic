DO $$ BEGIN
  CREATE TYPE "SupplierLedgerType" AS ENUM ('PURCHASE', 'PAYMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "SupplierLedgerEntry" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "SupplierLedgerType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3),
  "method" TEXT,
  "reference" TEXT,
  "invoiceNumber" TEXT,
  "productName" TEXT,
  "quantity" DOUBLE PRECISION,
  "notes" TEXT,
  "previousBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupplierLedgerEntry_storeId_idx" ON "SupplierLedgerEntry"("storeId");
CREATE INDEX IF NOT EXISTS "SupplierLedgerEntry_supplierId_idx" ON "SupplierLedgerEntry"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierLedgerEntry_occurredAt_idx" ON "SupplierLedgerEntry"("occurredAt");

DO $$ BEGIN
  ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierLedgerEntry" ADD CONSTRAINT "SupplierLedgerEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "SupplierLedgerEntry" (
  "id", "storeId", "supplierId", "userId", "type", "amount", "occurredAt", "dueDate",
  "notes", "previousBalance", "updatedBalance"
)
SELECT
  CONCAT('open-p-', s."id"),
  s."storeId",
  s."id",
  COALESCE((SELECT u."id" FROM "User" u WHERE u."storeId" = s."storeId" LIMIT 1), (SELECT u."id" FROM "User" u LIMIT 1)),
  'PURCHASE',
  s."paidAmount" + s."unpaidAmount",
  s."createdAt",
  s."dueDate",
  'Opening purchase',
  0,
  s."paidAmount" + s."unpaidAmount"
FROM "Supplier" s
WHERE (s."paidAmount" + s."unpaidAmount") > 0
  AND NOT EXISTS (
    SELECT 1 FROM "SupplierLedgerEntry" e WHERE e."supplierId" = s."id"
  )
  AND COALESCE((SELECT u."id" FROM "User" u WHERE u."storeId" = s."storeId" LIMIT 1), (SELECT u."id" FROM "User" u LIMIT 1)) IS NOT NULL;

INSERT INTO "SupplierLedgerEntry" (
  "id", "storeId", "supplierId", "userId", "type", "amount", "occurredAt", "dueDate",
  "notes", "previousBalance", "updatedBalance"
)
SELECT
  CONCAT('open-pay-', s."id"),
  s."storeId",
  s."id",
  COALESCE((SELECT u."id" FROM "User" u WHERE u."storeId" = s."storeId" LIMIT 1), (SELECT u."id" FROM "User" u LIMIT 1)),
  'PAYMENT',
  s."paidAmount",
  s."createdAt",
  s."dueDate",
  'Opening payment',
  s."paidAmount" + s."unpaidAmount",
  s."unpaidAmount"
FROM "Supplier" s
WHERE s."paidAmount" > 0
  AND EXISTS (
    SELECT 1 FROM "SupplierLedgerEntry" e WHERE e."id" = CONCAT('open-p-', s."id")
  )
  AND NOT EXISTS (
    SELECT 1 FROM "SupplierLedgerEntry" e WHERE e."id" = CONCAT('open-pay-', s."id")
  );
