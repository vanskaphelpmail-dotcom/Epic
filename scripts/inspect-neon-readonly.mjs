import { config } from "dotenv";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL");
  process.exit(1);
}

const host = new URL(url).hostname;
console.log(JSON.stringify({ dbHost: host }, null, 2));

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const settings = await client.query(
  `SELECT id, "logoText", "footerCopyright" FROM store_settings LIMIT 5`,
);
const users = await client.query(
  `SELECT email, role::text AS role, status::text AS status FROM users ORDER BY email`,
);
const counts = await client.query(
  `SELECT
    (SELECT COUNT(*)::int FROM products) AS products,
    (SELECT COUNT(*)::int FROM banners) AS banners,
    (SELECT COUNT(*)::int FROM orders) AS orders,
    (SELECT COUNT(*)::int FROM users) AS users`,
);
const products = await client.query(
  `SELECT id, name, sku, status::text AS status, LEFT(COALESCE("imageUrl",''), 80) AS image
   FROM products ORDER BY "updatedAt" DESC NULLS LAST LIMIT 20`,
);
const mig = await client.query(
  `SELECT migration_name, finished_at
   FROM _prisma_migrations
   ORDER BY finished_at DESC NULLS LAST
   LIMIT 12`,
);

console.log(
  JSON.stringify(
    {
      settings: settings.rows,
      users: users.rows,
      counts: counts.rows[0],
      products: products.rows,
      migrations: mig.rows,
    },
    null,
    2,
  ),
);

await client.end();
