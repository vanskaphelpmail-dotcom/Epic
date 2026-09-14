/**
 * Read-only probe of a Neon host (host + counts only; no secrets printed).
 * Usage: node scripts/probe-neon-host.mjs <connection-string>
 */
import pg from "pg";

const url = process.argv[2];
if (!url) {
  console.error("Usage: node scripts/probe-neon-host.mjs <DATABASE_URL>");
  process.exit(1);
}

let host = "(invalid)";
try {
  host = new URL(url).hostname;
} catch {
  console.error("Invalid URL");
  process.exit(1);
}

console.log(JSON.stringify({ probing: host }, null, 2));

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const settings = await client.query(
    `SELECT id, "logoText", "footerCopyright" FROM store_settings LIMIT 3`,
  ).catch((e) => ({ rows: [], error: e.message }));
  const counts = await client.query(
    `SELECT
      (SELECT COUNT(*)::int FROM products) AS products,
      (SELECT COUNT(*)::int FROM banners) AS banners,
      (SELECT COUNT(*)::int FROM orders) AS orders,
      (SELECT COUNT(*)::int FROM users) AS users`,
  ).catch((e) => ({ rows: [{ error: e.message }] }));
  const sample = await client.query(
    `SELECT id, name, sku, status::text AS status
     FROM products ORDER BY "updatedAt" DESC NULLS LAST LIMIT 8`,
  ).catch((e) => ({ rows: [], error: e.message }));
  const users = await client.query(
    `SELECT email, role::text AS role, status::text AS status
     FROM users WHERE role::text <> 'CUSTOMER' ORDER BY email LIMIT 20`,
  ).catch((e) => ({ rows: [], error: e.message }));

  console.log(
    JSON.stringify(
      {
        ok: true,
        host,
        settings: settings.rows || settings,
        counts: counts.rows?.[0] || counts,
        sampleProducts: sample.rows || sample,
        staff: users.rows || users,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        host,
        error: e instanceof Error ? e.message : String(e),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
