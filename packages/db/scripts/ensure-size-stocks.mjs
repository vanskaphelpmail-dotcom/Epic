import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ensureMigrateDatabaseUrls } from "../../../scripts/neon-direct-url.mjs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: join(root, ".env"), quiet: true });
ensureMigrateDatabaseUrls(process.env);
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const prisma = new PrismaClient();
await prisma.$executeRawUnsafe(
  'ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sizeStocks" JSONB'
);
console.log("sizeStocks column ensured");
await prisma.$disconnect();
