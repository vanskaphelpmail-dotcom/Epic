<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app APp

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b04772a9-d907-44e3-90ce-f1f94b0a1be4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
Removed from Neon:

14 products, 5 orders (+ items/timeline), stock logs, reviews
brands / leagues / categories
store settings & locations
carts, wishlists, banners, CMS pages, coupons, seller requests, etc.
Reusable anytime:

npm run db:wipe-app-data
Prisma is in good shape. Here’s what was run and what it reported:

npm run db:generate
Success — Prisma Client v6.19.3 was generated to node_modules/@prisma/client.

npm run db:validate
Success — packages/db/prisma/schema.prisma is valid.

npm run db:migrate:status
Success — Connected to your Neon PostgreSQL database (neondb).

Check	Result
Migrations found
10
Database vs schema
Up to date
Notes (not errors)
Prisma warns that package.json#prisma config is deprecated (Prisma 7 will want prisma.config.ts) — fine for now.
Prisma 7.9.1 is available; you’re on 6.19.3 — no need to upgrade unless you want to.
Bottom line: Generate worked, schema is valid, and all migrations are applied to Neon. You’re good to run npm run dev.

Useful commands:

npm run db:generate        # Regenerate client after schema changes
npm run db:migrate:status  # Check migration status
npm run db:migrate:deploy  # Apply pending migrations (production)
npm run db:studio          # Open Prisma Studio GUI
