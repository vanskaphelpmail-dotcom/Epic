import { config as loadEnv } from "dotenv";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: path.join(root, ".env") });
loadEnv({ path: path.join(root, ".env.local"), override: true });

const migDir = path.join(root, "packages", "db", "prisma", "migrations");
const names = readdirSync(migDir)
  .filter((d) => /^\d{14}_/.test(d))
  .sort();

console.log(`Baselining ${names.length} migrations…`);

for (const name of names) {
  const r = spawnSync(
    "npx",
    ["prisma", "migrate", "resolve", "--applied", name],
    {
      cwd: path.join(root, "packages", "db"),
      env: process.env,
      encoding: "utf8",
      shell: true,
    },
  );
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.status === 0 || /P3008|already recorded|already been applied/i.test(out)) {
    console.log("ok:", name);
    continue;
  }
  console.error(out);
  console.error("FAIL", name);
  process.exit(r.status || 1);
}

const status = spawnSync("npx", ["prisma", "migrate", "status"], {
  cwd: path.join(root, "packages", "db"),
  env: process.env,
  encoding: "utf8",
  shell: true,
});
process.stdout.write(status.stdout || "");
process.stderr.write(status.stderr || "");
const combined = `${status.stdout || ""}${status.stderr || ""}`;
if (status.status === 0 || /up to date/i.test(combined)) {
  console.log("Baseline complete — schema migration history is ready.");
  process.exit(0);
}
process.exit(status.status || 1);
