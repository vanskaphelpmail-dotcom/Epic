/**
 * Vercel monorepo build — works whether Root Directory is repo root or apps/web.
 * Steps: prisma generate → migrate deploy (with Neon wake retries) → next build
 *
 * On Vercel, next.config sets distDir: "dist" to match the project Output Directory.
 *
 * Env:
 *   DATABASE_URL              — pooled Neon URL (runtime)
 *   DATABASE_URL_UNPOOLED     — direct Neon URL (migrate; preferred)
 *   SKIP_DB_MIGRATE=1         — skip migrate (build still runs; use only if schema is current)
 *   ALLOW_BUILD_WITHOUT_MIGRATE=0 — fail hard when DB env missing / unreachable / migrate fails
 *                                  (default: warn and continue so missing Preview env or cold Neon
 *                                  does not block the Next.js build)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureMigrateDatabaseUrls, toNeonDirectUrl } from "./neon-direct-url.mjs";

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    const pkgPath = path.join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const json = JSON.parse(readFileSync(pkgPath, "utf8"));
        if (json.workspaces) return dir;
      } catch {
        /* continue */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function sleepSync(ms) {
  // Vercel Linux — blocking sleep between Neon wake attempts
  spawnSync("sleep", [String(Math.max(1, Math.ceil(ms / 1000)))], {
    stdio: "ignore",
  });
}

function withConnectTimeout(connectionString, seconds = 30) {
  if (!connectionString) return connectionString;
  try {
    const u = new URL(connectionString);
    u.searchParams.set("connect_timeout", String(seconds));
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return connectionString;
  }
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = findRoot(path.resolve(scriptDir, ".."));

const { pooled, direct } = ensureMigrateDatabaseUrls(process.env);
const pooledForMigrate = withConnectTimeout(
  pooled.includes("-pooler.") || /pgbouncer=true/i.test(pooled)
    ? pooled
    : pooled
      ? pooled
      : "",
  30,
);
const directForMigrate = withConnectTimeout(direct || toNeonDirectUrl(pooled), 30);

try {
  const host = (s) => (s ? new URL(s).hostname : "(unset)");
  console.log(`[vercel-build] DATABASE_URL host: ${host(pooled)}`);
  console.log(`[vercel-build] migrate direct host: ${host(directForMigrate)}`);
} catch {
  /* ignore parse issues */
}

/** Env for migrate attempts. */
function migrateEnv(databaseUrl, extra = {}) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl || process.env.DATABASE_URL,
    DATABASE_URL_UNPOOLED: databaseUrl || process.env.DATABASE_URL_UNPOOLED,
    ...extra,
  };
}

function run(cmd, args, env = process.env) {
  console.log(`\n[vercel-build] $ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    console.error(
      `[vercel-build] Failed: ${cmd} ${args.join(" ")} (exit ${result.status})`,
    );
    process.exit(result.status ?? 1);
  }
}

function capture(cmd, args, env = process.env) {
  return spawnSync(cmd, args, {
    cwd: root,
    env,
    encoding: "utf8",
    shell: true,
  });
}

function outputLooksUnreachable(out) {
  return /P1001|Can't reach database server|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(
    out,
  );
}

function outputLooksQuotaExceeded(out) {
  return /exceeded the data transfer quota|data transfer quota|Upgrade your plan to increase limits/i.test(
    out,
  );
}

function schemaIsUpToDate(env) {
  console.log("\n[vercel-build] $ npm run db:migrate:status");
  const result = capture("npm", ["run", "db:migrate:status"], env);
  const out = `${result.stdout || ""}\n${result.stderr || ""}`;
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0) {
    return {
      ok: false,
      unreachable: outputLooksUnreachable(out),
      quota: outputLooksQuotaExceeded(out),
      out,
    };
  }
  return {
    ok: /Database schema is up to date/i.test(out),
    unreachable: false,
    quota: false,
    out,
  };
}

function tryMigrateDeploy(env, label) {
  console.log(`\n[vercel-build] migrate deploy: ${label}`);
  const result = spawnSync("npm", ["run", "db:migrate:deploy"], {
    cwd: root,
    env,
    encoding: "utf8",
    shell: true,
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  const out = `${result.stdout || ""}\n${result.stderr || ""}`;
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    unreachable: outputLooksUnreachable(out),
    quota: outputLooksQuotaExceeded(out),
    out,
  };
}

function runMigrateDeploy() {
  if (process.env.SKIP_DB_MIGRATE === "1") {
    console.warn(
      "[vercel-build] SKIP_DB_MIGRATE=1 — skipping database migrations",
    );
    return;
  }

  if (!directForMigrate && !pooled) {
    const hardFail = process.env.ALLOW_BUILD_WITHOUT_MIGRATE === "0";
    console.warn(
      "[vercel-build] Missing DATABASE_URL / DATABASE_URL_UNPOOLED — skipping migrate.",
    );
    console.warn(
      "[vercel-build] Add both in Vercel → Project → Settings → Environment Variables",
    );
    console.warn(
      "[vercel-build] (Production + Preview + Development), then redeploy.",
    );
    if (hardFail) {
      console.error(
        "[vercel-build] ALLOW_BUILD_WITHOUT_MIGRATE=0 — failing build without DB env.",
      );
      process.exit(1);
    }
    console.warn(
      "[vercel-build] Continuing Next.js build without migrate (API/DB routes need env at runtime).",
    );
    return;
  }

  const attempts = [];

  // Neon free tier often needs a few seconds to wake after suspend.
  const wakeDelaysSec = [0, 5, 10, 20];
  for (const delay of wakeDelaysSec) {
    attempts.push({
      label: `direct URL (wake wait ${delay}s)`,
      delaySec: delay,
      env: migrateEnv(directForMigrate || pooledForMigrate),
    });
  }

  attempts.push({
    label: "direct URL + disable advisory lock",
    delaySec: 3,
    env: migrateEnv(directForMigrate || pooledForMigrate, {
      PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
    }),
  });

  if (pooledForMigrate && pooledForMigrate !== directForMigrate) {
    attempts.push({
      label: "pooled URL + disable advisory lock (last resort)",
      delaySec: 3,
      env: migrateEnv(pooledForMigrate, {
        PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1",
        // Prisma migrate uses directUrl — force both URLs onto the pooler host
        PRISMA_MIGRATE_USE_POOLED: "1",
      }),
    });
  }

  let lastUnreachable = false;
  let lastQuota = false;
  let lastStatus = 1;

  for (let i = 0; i < attempts.length; i++) {
    const { label, delaySec, env } = attempts[i];
    if (delaySec > 0) {
      console.log(
        `[vercel-build] waiting ${delaySec}s for Neon compute wake…`,
      );
      sleepSync(delaySec * 1000);
    }

    // Status check — if already migrated, skip deploy
    const status = schemaIsUpToDate(env);
    if (status.ok) {
      console.log(
        "[vercel-build] Migrations already applied — skipping migrate deploy",
      );
      return;
    }
    if (status.quota) {
      lastQuota = true;
      console.error(
        "[vercel-build] Neon data transfer quota exceeded — migrate cannot run.",
      );
      break;
    }
    if (status.unreachable) {
      lastUnreachable = true;
      console.warn(
        `[vercel-build] DB unreachable on status check (${label}); will retry migrate…`,
      );
    }

    const deploy = tryMigrateDeploy(env, label);
    if (deploy.ok) return;
    lastStatus = deploy.status;
    lastUnreachable = deploy.unreachable || lastUnreachable;
    lastQuota = deploy.quota || lastQuota;

    if (deploy.quota) {
      console.error(
        "[vercel-build] Neon data transfer quota exceeded — migrate cannot run.",
      );
      break;
    }

    console.warn(
      `[vercel-build] migrate deploy failed (exit ${deploy.status}); ${
        i < attempts.length - 1 ? "retrying…" : "no more attempts"
      }`,
    );
  }

  if (lastQuota) {
    console.error(
      "[vercel-build] Neon free tier data transfer quota is exhausted.",
    );
    console.error(
      "[vercel-build] Fix: Neon Console → upgrade plan, wait for quota reset, or create a new project and update DATABASE_URL / DATABASE_URL_UNPOOLED on Vercel.",
    );
    console.error(
      "[vercel-build] Runtime API calls will also fail until quota is restored.",
    );
    // Still allow Next build so static assets deploy; app DB routes will error until fixed.
    if (process.env.ALLOW_BUILD_WITHOUT_MIGRATE !== "0") {
      console.warn(
        "[vercel-build] Continuing Next.js build without migrate (ALLOW_BUILD_WITHOUT_MIGRATE).",
      );
      return;
    }
    process.exit(lastStatus);
  }

  // Default: if Neon is unreachable from the build machine, still produce the
  // Next bundle so deploys aren't blocked when schema is already applied.
  // Set ALLOW_BUILD_WITHOUT_MIGRATE=0 to fail hard on P1001.
  if (lastUnreachable && process.env.ALLOW_BUILD_WITHOUT_MIGRATE !== "0") {
    console.warn(
      "[vercel-build] WARNING: Could not reach Neon during migrate (P1001).",
    );
    console.warn(
      "[vercel-build] Continuing build without migrate. Fix Neon / env, then re-deploy or run:",
    );
    console.warn("[vercel-build]   npm run db:migrate:deploy");
    console.warn(
      "[vercel-build] Checklist: Neon Active, data transfer quota OK, DATABASE_URL + DATABASE_URL_UNPOOLED on Vercel.",
    );
    return;
  }

  console.error(
    `[vercel-build] Failed: npm run db:migrate:deploy (exit ${lastStatus})`,
  );
  console.error(
    "[vercel-build] Tip: ensure Vercel has DATABASE_URL_UNPOOLED (Neon host without -pooler).",
  );
  console.error(
    "[vercel-build] Tip: open Neon console and Resume the compute if suspended.",
  );
  process.exit(lastStatus);
}

console.log(`[vercel-build] Monorepo root: ${root}`);
console.log(`[vercel-build] VERCEL=${process.env.VERCEL ?? "(unset)"}`);

run("npm", ["run", "db:generate"]);
runMigrateDeploy();
run("npm", ["run", "build", "-w", "@jab/web"]);

const webApp = path.join(root, "apps", "web");
const candidates = [
  path.join(webApp, "dist"),
  path.join(webApp, ".next"),
];
const found = candidates.find((p) => existsSync(p));
if (!found) {
  console.error(
    `[vercel-build] Missing Next output under apps/web (looked for dist and .next)`,
  );
  process.exit(1);
}

console.log(`[vercel-build] Next.js build ready at ${path.relative(root, found)}`);
