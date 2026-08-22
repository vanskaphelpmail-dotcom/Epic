DROP INDEX IF EXISTS "EmployeeDocumentRequest_requestCode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDocumentRequest_storeId_requestCode_key"
  ON "EmployeeDocumentRequest"("storeId", "requestCode");
