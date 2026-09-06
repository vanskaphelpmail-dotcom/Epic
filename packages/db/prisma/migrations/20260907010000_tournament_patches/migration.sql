-- Global tournament patches shared by all jersey products
ALTER TABLE "store_settings"
  ADD COLUMN IF NOT EXISTS "tournamentPatches" JSONB;
