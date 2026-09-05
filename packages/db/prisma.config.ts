import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(pkgRoot, "../..");

loadEnv({ path: path.join(monorepoRoot, ".env"), quiet: true });
loadEnv({ path: path.join(monorepoRoot, ".env.local"), override: true, quiet: true });
loadEnv({ path: path.join(pkgRoot, ".env"), override: true, quiet: true });

// Prefer direct (unpooled) Neon URL for migrate / CLI; fall back to pooled.
const migrateUrl =
  process.env.DATABASE_URL_UNPOOLED?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "";

if (migrateUrl) {
  process.env.DATABASE_URL = migrateUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
