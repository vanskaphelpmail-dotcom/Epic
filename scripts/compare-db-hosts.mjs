/**
 * Compare DATABASE_URL hostnames between local .env and .env.vercel.production
 * without printing credentials.
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function hostOf(file) {
  const env = {};
  if (!fs.existsSync(file)) return { file, exists: false };
  const parsed = config({ path: file, processEnv: env });
  void parsed;
  const url = env.DATABASE_URL || "";
  try {
    const u = new URL(url.replace(/^postgresql:/i, "http:"));
    return {
      file: path.basename(file),
      exists: true,
      host: u.hostname,
      db: u.pathname.replace(/^\//, "").split("?")[0],
      hasPooler: u.hostname.includes("-pooler"),
    };
  } catch {
    return { file: path.basename(file), exists: true, host: "(unparseable)", db: null };
  }
}

console.log(
  JSON.stringify(
    {
      local: hostOf(path.join(root, ".env")),
      localOverride: hostOf(path.join(root, ".env.local")),
      vercelProd: hostOf(path.join(root, ".env.vercel.production")),
    },
    null,
    2,
  ),
);
