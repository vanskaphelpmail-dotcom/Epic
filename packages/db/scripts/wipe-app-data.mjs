/**
 * Wipe all commerce / CMS / ops data. Preserves user accounts (+ sessions, OAuth accounts, addresses).
 *
 * Usage (from repo root):
 *   node packages/db/scripts/wipe-app-data.mjs
 *
 * Requires DATABASE_URL (or DATABASE_URL_UNPOOLED) in root .env
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ensureMigrateDatabaseUrls } from "../../../scripts/neon-direct-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: path.join(root, ".env"), quiet: true });
loadEnv({ path: path.join(root, ".env.local"), override: true, quiet: true });
ensureMigrateDatabaseUrls(process.env);

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

// Prefer direct Neon URL for bulk deletes
if (process.env.DATABASE_URL_UNPOOLED) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
}

const prisma = new PrismaClient();

async function wipe() {
  const usersBefore = await prisma.user.count();
  console.log(`[wipe] Preserving ${usersBefore} user account(s)`);
  console.log("[wipe] Deleting commerce / CMS / catalog data…");

  // Child → parent order (FK-safe). Users / sessions / accounts / addresses kept.
  const steps = [
    ["orderTimelineEvent", () => prisma.orderTimelineEvent.deleteMany()],
    ["payment", () => prisma.payment.deleteMany()],
    ["orderItem", () => prisma.orderItem.deleteMany()],
    ["order", () => prisma.order.deleteMany()],
    ["cartItem", () => prisma.cartItem.deleteMany()],
    ["cart", () => prisma.cart.deleteMany()],
    ["wishlistItem", () => prisma.wishlistItem.deleteMany()],
    ["review", () => prisma.review.deleteMany()],
    ["stockLog", () => prisma.stockLog.deleteMany()],
    ["productImage", () => prisma.productImage.deleteMany()],
    ["dailyDeal", () => prisma.dailyDeal.deleteMany()],
    ["auctionLot", () => prisma.auctionLot.deleteMany()],
    ["banner", () => prisma.banner.deleteMany()],
    ["product", () => prisma.product.deleteMany()],
    ["category", () => prisma.category.deleteMany()],
    ["club", () => prisma.club.deleteMany()],
    ["league", () => prisma.league.deleteMany()],
    ["brand", () => prisma.brand.deleteMany()],
    ["coupon", () => prisma.coupon.deleteMany()],
    ["sellerRequest", () => prisma.sellerRequest.deleteMany()],
    ["pageSection", () => prisma.pageSection.deleteMany()],
    ["cmsPage", () => prisma.cmsPage.deleteMany()],
    ["menuItem", () => prisma.menuItem.deleteMany()],
    ["blogPost", () => prisma.blogPost.deleteMany()],
    ["newsletterSubscriber", () => prisma.newsletterSubscriber.deleteMany()],
    ["storeLocation", () => prisma.storeLocation.deleteMany()],
    ["storeSettings", () => prisma.storeSettings.deleteMany()],
    ["auditLog", () => prisma.auditLog.deleteMany()],
  ];

  for (const [name, fn] of steps) {
    const result = await fn();
    console.log(`  ✓ ${name}: deleted ${result.count}`);
  }

  const usersAfter = await prisma.user.count();
  const products = await prisma.product.count();
  const orders = await prisma.order.count();
  console.log(`[wipe] Done. users=${usersAfter} (unchanged expect), products=${products}, orders=${orders}`);
}

wipe()
  .catch((err) => {
    console.error("[wipe] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
