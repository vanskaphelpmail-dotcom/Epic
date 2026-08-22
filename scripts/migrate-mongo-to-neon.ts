/**
 * Optional one-shot import from a legacy MongoDB into Neon PostgreSQL.
 *
 * Usage:
 *   MONGO_SOURCE_URL=mongodb+srv://... DATABASE_URL=postgresql://... npx tsx scripts/migrate-mongo-to-neon.ts
 *
 * This project’s production app never had durable Mongo data on Vercel
 * (DATABASE_URL was "memory"). Prefer `npm run seed` on Neon for a fresh shop.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const mongo = process.env.MONGO_SOURCE_URL || process.env.MONGODB_URI;
  if (!mongo || mongo === 'memory' || !/^mongodb(\+srv)?:\/\//i.test(mongo)) {
    console.log(
      'No Mongo source configured. Skipping import.\n' +
        'For a fresh Neon database run: npm run db:push && npm run seed'
    );
    return;
  }

  console.error(
    'Mongo → Neon bulk import is not auto-enabled.\n' +
      'This app’s live path already uses Prisma models; seed Neon with `npm run seed`.\n' +
      'If you have a populated MongoDB Atlas dump, export collections and map IDs to cuid()/uuid before insert.'
  );
  process.exit(0);
}

const prisma = new PrismaClient();
main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
