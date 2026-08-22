ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "warehouse" TEXT DEFAULT 'Dhaka Central';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "binCode" TEXT;
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "meta" JSONB;

-- Clear stuck Prisma migrate advisory-lock sessions
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND (
    query ILIKE '%pg_advisory_lock%'
    OR state = 'idle in transaction'
  );

-- Record migration if not already recorded
INSERT INTO "_prisma_migrations" (
  id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
)
SELECT
  gen_random_uuid()::text,
  'manual-resolve',
  NOW(),
  '20260801180000_admin_cms_inventory',
  NULL,
  NULL,
  NOW(),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260801180000_admin_cms_inventory'
);
