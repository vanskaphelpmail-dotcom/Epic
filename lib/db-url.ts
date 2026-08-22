/** Strip wrapping quotes / whitespace, and recover a pasted postgresql:// URL. */
export function normalizeEnvUrl(url: unknown): string {
  let value = String(url || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
  const embedded = value.match(/postgres(?:ql)?:\/\/\S+/i);
  if (embedded) {
    value = embedded[0].replace(/[,"']+$/g, '');
  }
  return value;
}

/** True when value is a Prisma-compatible PostgreSQL connection string. */
export function isPostgresConnectionUrl(url: unknown): url is string {
  return typeof url === 'string' && /^postgres(ql)?:\/\//i.test(normalizeEnvUrl(url));
}

/** @deprecated Use isPostgresConnectionUrl — kept for health diagnostics. */
export function isMongoConnectionUrl(url: unknown): url is string {
  return typeof url === 'string' && /^mongodb(\+srv)?:\/\//i.test(normalizeEnvUrl(url));
}

export const DATABASE_CONFIG_MESSAGE =
  'Neon is not connected. In Vercel → Settings → Environment Variables, edit the existing DATABASE_URL (do not add a second one) and paste your Neon postgresql:// URL. Also set DIRECT_URL to the non-pooler URL and CLOUDINARY_URL, then Redeploy.';

function fromPgParts(): string {
  const host = normalizeEnvUrl(process.env.PGHOST || process.env.POSTGRES_HOST);
  const user = normalizeEnvUrl(process.env.PGUSER || process.env.POSTGRES_USER);
  const password = String(process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '');
  const database = normalizeEnvUrl(process.env.PGDATABASE || process.env.POSTGRES_DATABASE || 'neondb') || 'neondb';
  if (!host || !user || !password) return '';
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const ssl = host.includes('neon.tech') ? '?sslmode=require' : '';
  return `postgresql://${auth}@${host}/${database}${ssl}`;
}

/** Neon + Vercel aliases. Skip Mongo/memory DATABASE_URL so a new Neon connection still works. */
export function postgresUrlCandidates(): string[] {
  return [
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DIRECT_URL,
    fromPgParts()
  ]
    .map(normalizeEnvUrl)
    .filter(isPostgresConnectionUrl);
}

export function directUrlCandidates(): string[] {
  return [
    process.env.DIRECT_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL
  ]
    .map(normalizeEnvUrl)
    .filter(isPostgresConnectionUrl);
}

function firstUnpooled(urls: string[]): string {
  return urls.find((url) => !/-pooler\./i.test(url)) || urls[0] || '';
}

/**
 * Resolve DATABASE_URL for Prisma (Neon PostgreSQL).
 * Ignores leftover MongoDB / "memory" values when a Neon postgres URL exists.
 */
export function resolveDatabaseUrl(): string {
  const pooled = postgresUrlCandidates();
  const url = pooled[0];
  if (!url) {
    throw new Error(DATABASE_CONFIG_MESSAGE);
  }

  const tuned = withServerlessParams(url);
  process.env.DATABASE_URL = tuned;

  const direct = firstUnpooled(directUrlCandidates()) || tuned.replace('-pooler.', '.');
  process.env.DIRECT_URL = stripPrismaPoolParams(direct);

  return tuned;
}

/** Prisma pool/pgbouncer query params are not used by the Neon serverless driver. */
export function stripPrismaPoolParams(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('connection_limit');
    parsed.searchParams.delete('pool_timeout');
    parsed.searchParams.delete('pgbouncer');
    parsed.searchParams.delete('connect_timeout');
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Prisma + Neon on Vercel. Override existing params — leftover connection_limit=1 causes pool timeouts. */
export function withServerlessParams(url: string): string {
  let next = url;
  const set = (key: string, value: string) => {
    const re = new RegExp(`([?&])${key}=[^&]*`, 'i');
    if (re.test(next)) {
      next = next.replace(re, `$1${key}=${value}`);
      return;
    }
    next += `${next.includes('?') ? '&' : '?'}${key}=${value}`;
  };
  const pooled = /-pooler\./i.test(next);
  set('connection_limit', pooled ? '10' : '5');
  set('pool_timeout', '20');
  set('connect_timeout', '15');
  if (pooled) set('pgbouncer', 'true');
  return next;
}

export function assertDatabaseUrlConfigured() {
  resolveDatabaseUrl();
}

export function describeEnvUrl(value: unknown) {
  const url = normalizeEnvUrl(value);
  if (!url) return { set: false, kind: 'missing' as const };
  if (url === 'memory') return { set: true, kind: 'memory' as const };
  if (/^mongodb(\+srv)?:\/\//i.test(url)) return { set: true, kind: 'mongodb-legacy' as const };
  if (/^postgres(ql)?:\/\//i.test(url)) {
    return { set: true, kind: 'postgresql' as const, pooled: url.includes('-pooler.') };
  }
  return { set: true, kind: 'invalid' as const, preview: url.slice(0, 12) };
}
