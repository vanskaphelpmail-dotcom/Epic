/**
 * Clear stuck Prisma migrate advisory locks on Neon, then deploy migrations.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: path.join(root, ".env"), quiet: true });

const url =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL / DATABASE_URL_UNPOOLED");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("[migrate-fix] Connected");

const stuck = await client.query(`
  SELECT pid, state, left(query, 120) AS query, now() - query_start AS age
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND (
      query ILIKE '%pg_advisory_lock%'
      OR query ILIKE '%prisma%'
      OR state = 'idle in transaction'
    )
`);

console.log(`[migrate-fix] Candidates to terminate: ${stuck.rowCount}`);
for (const row of stuck.rows) {
  console.log(`  pid=${row.pid} state=${row.state} age=${row.age} q=${row.query}`);
  try {
    await client.query(`SELECT pg_terminate_backend($1)`, [row.pid]);
  } catch (e) {
    console.warn(`  failed to terminate ${row.pid}`, e.message);
  }
}

// Ensure columns exist (idempotent)
await client.query(`
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "warehouse" TEXT DEFAULT 'Dhaka Central';
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "binCode" TEXT;
  ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "meta" JSONB;
`);
console.log("[migrate-fix] Schema columns ensured");

// Record migration if missing
const existing = await client.query(
  `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1`,
  ["20260801180000_admin_cms_inventory"],
);
if (existing.rowCount === 0) {
  await client.query(`
    INSERT INTO "_prisma_migrations" (
      id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count
    ) VALUES (
      gen_random_uuid()::text,
      'manual-resolve',
      NOW(),
      '20260801180000_admin_cms_inventory',
      NULL,
      NULL,
      NOW(),
      1
    )
  `);
  console.log("[migrate-fix] Recorded 20260801180000_admin_cms_inventory");
} else {
  console.log("[migrate-fix] Migration already recorded");
}

await client.end();

const result = spawnSync(
  "npm",
  ["run", "db:migrate:deploy"],
  { cwd: root, stdio: "inherit", shell: true, env: process.env },
);
process.exit(result.status ?? 1);
