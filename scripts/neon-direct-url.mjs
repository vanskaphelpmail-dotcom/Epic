/**
 * Neon pooler hosts break Prisma migrate advisory locks (P1002).
 * Derive a session/direct URL from a pooled connection string.
 */
export function toNeonDirectUrl(connectionString) {
  if (!connectionString) return connectionString;
  try {
    const u = new URL(connectionString);
    if (u.hostname.includes("-pooler.")) {
      u.hostname = u.hostname.replace("-pooler.", ".");
    }
    u.searchParams.delete("pgbouncer");
    u.searchParams.delete("connection_limit");
    // channel_binding=require can hang Node drivers on some Neon paths
    if (u.searchParams.get("channel_binding") === "require") {
      u.searchParams.delete("channel_binding");
    }
    return u.toString();
  } catch {
    return connectionString
      .replace("-pooler.", ".")
      .replace(/([?&])pgbouncer=true&?/g, "$1")
      .replace(/[?&]$/, "");
  }
}

export function ensureMigrateDatabaseUrls(env = process.env) {
  const pooled = env.DATABASE_URL || "";
  const configured = env.DATABASE_URL_UNPOOLED || "";
  const looksPooled = (s) => /pooler|pgbouncer=true/i.test(s || "");

  let direct = configured;
  if (!direct || looksPooled(direct)) {
    direct = toNeonDirectUrl(pooled || direct);
  } else {
    // Still strip channel_binding if present
    direct = toNeonDirectUrl(direct);
  }

  if (direct) env.DATABASE_URL_UNPOOLED = direct;
  return { pooled, direct };
}
