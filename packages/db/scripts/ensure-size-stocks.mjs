import { config } from "dotenv";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";
import { ensureMigrateDatabaseUrls } from "../../../scripts/neon-direct-url.mjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: join(root, ".env"), quiet: true });
ensureMigrateDatabaseUrls(process.env);
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
await prisma.$executeRawUnsafe(
  'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizeStocks" JSONB'
);
console.log("sizeStocks column ensured");
await prisma.$disconnect();
await pool.end();
