import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url });

const tables = await pool.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`,
);
console.log("tables:", tables.rows.map((r) => r.table_name).join(", "));

try {
  const users = await pool.query(
    `SELECT id, email, role, status FROM users ORDER BY "createdAt" ASC LIMIT 30`,
  );
  console.log("users:", JSON.stringify(users.rows, null, 2));
} catch (e) {
  console.error("users query failed:", e instanceof Error ? e.message : e);
}

await pool.end();
