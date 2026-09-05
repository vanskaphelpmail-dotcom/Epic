/**
 * Diagnose production admin login (no password printed).
 * Uses SEED_ADMIN_PASSWORD from .env / known seed defaults length-only logging.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

const base =
  process.env.PROBE_BASE_URL ||
  "https://classic-football-jerseys-web.vercel.app";

const emails = [
  "admin@epicvanskap.com",
  "hasanrahinn@gmail.com",
  "epicvanskap@gmail.com",
  "yaqubislam71@gmail.com",
];

function clean(v) {
  return String(v || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

const candidates = [
  clean(process.env.SEED_ADMIN_PASSWORD),
  "EpicVanskap@2026",
  "ChangeMeNow!",
  "Admin@018",
].filter((p, i, arr) => p && arr.indexOf(p) === i);

console.log(
  JSON.stringify({
    base,
    emails,
    candidateCount: candidates.length,
    candidateLengths: candidates.map((p) => p.length),
  }),
);

for (const email of emails) {
  let matched = false;
  for (const password of candidates) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      console.log(
        JSON.stringify({
          email,
          ok: true,
          role: json?.data?.user?.role,
          passwordLen: password.length,
        }),
      );
      matched = true;
      break;
    }
    if (res.status !== 401) {
      console.log(
        JSON.stringify({
          email,
          status: res.status,
          message: json?.error?.message || null,
          passwordLen: password.length,
        }),
      );
    }
  }
  if (!matched) {
    console.log(JSON.stringify({ email, ok: false, note: "all candidates 401 or failed" }));
  }
}
