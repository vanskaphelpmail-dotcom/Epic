CREATE TABLE IF NOT EXISTS "MoneyAccount" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'CASH',
  "locationKey" TEXT NOT NULL,
  "bankName" TEXT,
  "accountName" TEXT,
  "accountNumber" TEXT,
  "accountType" TEXT,
  "branch" TEXT,
  "sortCode" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reference" TEXT,
  "notes" TEXT,
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isDefaultCash" BOOLEAN NOT NULL DEFAULT false,
  "isDefaultBank" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MoneyAccount_storeId_idx" ON "MoneyAccount"("storeId");
CREATE INDEX IF NOT EXISTS "MoneyAccount_locationKey_idx" ON "MoneyAccount"("locationKey");

CREATE TABLE IF NOT EXISTS "MoneyLedgerEntry" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "counterpartyAccountId" TEXT,
  "transferGroupId" TEXT,
  "typeKey" TEXT NOT NULL,
  "typeLabel" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT,
  "personName" TEXT,
  "personPhone" TEXT,
  "reason" TEXT,
  "reference" TEXT,
  "notes" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoneyLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MoneyLedgerEntry_storeId_idx" ON "MoneyLedgerEntry"("storeId");
CREATE INDEX IF NOT EXISTS "MoneyLedgerEntry_accountId_idx" ON "MoneyLedgerEntry"("accountId");
CREATE INDEX IF NOT EXISTS "MoneyLedgerEntry_occurredAt_idx" ON "MoneyLedgerEntry"("occurredAt");
CREATE INDEX IF NOT EXISTS "MoneyLedgerEntry_typeKey_idx" ON "MoneyLedgerEntry"("typeKey");

CREATE TABLE IF NOT EXISTS "DailyCashCycle" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "cycleDate" TIMESTAMP(3) NOT NULL,
  "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "closingCash" DOUBLE PRECISION,
  "expectedCash" DOUBLE PRECISION,
  "actualCash" DOUBLE PRECISION,
  "cashDifference" DOUBLE PRECISION,
  "differenceNote" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "summary" JSONB,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyCashCycle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyCashCycle_storeId_cycleDate_key" ON "DailyCashCycle"("storeId", "cycleDate");
CREATE INDEX IF NOT EXISTS "DailyCashCycle_storeId_idx" ON "DailyCashCycle"("storeId");

DO $$ BEGIN
  ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyLedgerEntry" ADD CONSTRAINT "MoneyLedgerEntry_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyLedgerEntry" ADD CONSTRAINT "MoneyLedgerEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyLedgerEntry" ADD CONSTRAINT "MoneyLedgerEntry_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyLedgerEntry" ADD CONSTRAINT "MoneyLedgerEntry_counterpartyAccountId_fkey"
    FOREIGN KEY ("counterpartyAccountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DailyCashCycle" ADD CONSTRAINT "DailyCashCycle_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
