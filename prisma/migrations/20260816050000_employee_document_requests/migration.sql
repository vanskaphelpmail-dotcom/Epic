-- Employee official document requests + request history

DO $$ BEGIN
  CREATE TYPE "DocumentRequestType" AS ENUM (
    'HOLIDAY_LETTER',
    'PAYSLIP',
    'EMPLOYEE_LETTER',
    'JOINING_LETTER',
    'EXPERIENCE_LETTER',
    'EMPLOYMENT_VERIFICATION',
    'SALARY_CERTIFICATE',
    'NOC',
    'LEAVE_APPROVAL',
    'PROMOTION_LETTER',
    'APPOINTMENT_LETTER',
    'WARNING_LETTER',
    'RELIEVING_LETTER',
    'RECOMMENDATION_LETTER',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'LEAVE_APPROVAL';
ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'PROMOTION_LETTER';
ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_LETTER';
ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'WARNING_LETTER';
ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'RELIEVING_LETTER';
ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'RECOMMENDATION_LETTER';
ALTER TYPE "DocumentRequestType" ADD VALUE IF NOT EXISTS 'OTHER';

CREATE TABLE IF NOT EXISTS "EmployeeDocumentRequest" (
  "id" TEXT NOT NULL,
  "requestCode" TEXT,
  "storeId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "type" "DocumentRequestType" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "reason" TEXT,
  "message" TEXT,
  "requiredDate" TIMESTAMP(3),
  "periodMonth" INTEGER,
  "periodYear" INTEGER,
  "details" JSONB,
  "adminComment" TEXT,
  "fileUrl" TEXT,
  "fileName" TEXT,
  "fileSize" INTEGER,
  "documentId" TEXT,
  "notes" TEXT,
  "downloadedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeDocumentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "requestCode" TEXT;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "message" TEXT;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "requiredDate" TIMESTAMP(3);
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "periodMonth" INTEGER;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "periodYear" INTEGER;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "details" JSONB;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "adminComment" TEXT;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
ALTER TABLE "EmployeeDocumentRequest" ADD COLUMN IF NOT EXISTS "downloadedAt" TIMESTAMP(3);

UPDATE "EmployeeDocumentRequest"
SET "requestCode" = 'REQ-' || to_char("createdAt", 'YYYY') || '-' || upper(substr(replace("id", '-', ''), 1, 5))
WHERE "requestCode" IS NULL;

ALTER TABLE "EmployeeDocumentRequest" ALTER COLUMN "requestCode" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDocumentRequest_requestCode_key" ON "EmployeeDocumentRequest"("requestCode");
CREATE INDEX IF NOT EXISTS "EmployeeDocumentRequest_storeId_idx" ON "EmployeeDocumentRequest"("storeId");
CREATE INDEX IF NOT EXISTS "EmployeeDocumentRequest_employeeId_idx" ON "EmployeeDocumentRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDocumentRequest_status_idx" ON "EmployeeDocumentRequest"("status");

CREATE TABLE IF NOT EXISTS "EmployeeRequestComment" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeRequestComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeRequestEvent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeRequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmployeeRequestComment_requestId_idx" ON "EmployeeRequestComment"("requestId");
CREATE INDEX IF NOT EXISTS "EmployeeRequestEvent_requestId_idx" ON "EmployeeRequestEvent"("requestId");

DO $$ BEGIN
  ALTER TABLE "EmployeeDocumentRequest" ADD CONSTRAINT "EmployeeDocumentRequest_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeDocumentRequest" ADD CONSTRAINT "EmployeeDocumentRequest_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeRequestComment" ADD CONSTRAINT "EmployeeRequestComment_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "EmployeeDocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeRequestComment" ADD CONSTRAINT "EmployeeRequestComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeRequestEvent" ADD CONSTRAINT "EmployeeRequestEvent_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "EmployeeDocumentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeRequestEvent" ADD CONSTRAINT "EmployeeRequestEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
