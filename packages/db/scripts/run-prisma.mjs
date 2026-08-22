/**
 * Run Prisma CLI with monorepo-root env loaded.
 * Prisma only auto-reads .env next to the schema / package — not the repo root.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { ensureMigrateDatabaseUrls } from "../../../scripts/neon-direct-url.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const monorepoRoot = path.resolve(pkgRoot, "../..");

loadEnv({ path: path.join(monorepoRoot, ".env"), quiet: true });
loadEnv({ path: path.join(monorepoRoot, ".env.local"), override: true, quiet: true });
loadEnv({ path: path.join(pkgRoot, ".env"), override: true, quiet: true });

// Neon pooler URLs cannot hold session advisory locks used by migrate.
// Prisma migrate uses `directUrl` (DATABASE_URL_UNPOOLED) — both must point
// at the same host we intend to use.
const { pooled, direct } = ensureMigrateDatabaseUrls(process.env);
const isMigrate = process.argv.slice(2).includes("migrate");
const usePooled =
  process.env.PRISMA_MIGRATE_USE_POOLED === "1" &&
  Boolean(pooled || process.env.DATABASE_URL);

if (isMigrate) {
  if (usePooled) {
    // Last-resort Vercel path: pooler + PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK
    const url = pooled || process.env.DATABASE_URL;
    process.env.DATABASE_URL = url;
    process.env.DATABASE_URL_UNPOOLED = url;
  } else if (direct) {
    process.env.DATABASE_URL = direct;
    process.env.DATABASE_URL_UNPOOLED = direct;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-prisma.mjs <prisma-args…>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  cwd: pkgRoot,
  env: process.env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
