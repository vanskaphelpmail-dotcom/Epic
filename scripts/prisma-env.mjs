/**
 * Fill Prisma DATABASE_URL / DIRECT_URL from Neon/Vercel aliases.
 * Skips leftover MongoDB / memory DATABASE_URL values.
 */
const PLACEHOLDER = 'postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public';

function normalize(url) {
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

function isPostgres(url) {
  return /^postgres(ql)?:\/\//i.test(normalize(url));
}

function firstPostgres(candidates) {
  for (const raw of candidates) {
    const url = normalize(raw);
    if (isPostgres(url)) return url;
  }
  return '';
}

function fromPgParts(env) {
  const host = normalize(env.PGHOST || env.POSTGRES_HOST);
  const user = normalize(env.PGUSER || env.POSTGRES_USER);
  const password = String(env.PGPASSWORD || env.POSTGRES_PASSWORD || '');
  const database = normalize(env.PGDATABASE || env.POSTGRES_DATABASE || 'neondb') || 'neondb';
  if (!host || !user || !password) return '';
  const auth = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  const ssl = host.includes('neon.tech') ? '?sslmode=require' : '';
  return `postgresql://${auth}@${host}/${database}${ssl}`;
}

export function applyPrismaEnv({ forGenerate = false } = {}) {
  const env = process.env;
  const databaseUrl = firstPostgres([
    env.POSTGRES_PRISMA_URL,
    env.POSTGRES_URL,
    env.DATABASE_URL,
    env.DATABASE_URL_UNPOOLED,
    env.POSTGRES_URL_NON_POOLING,
    env.DIRECT_URL,
    fromPgParts(env)
  ]);
  const directUrl = firstPostgres([
    env.DIRECT_URL,
    env.DATABASE_URL_UNPOOLED,
    env.POSTGRES_URL_NON_POOLING,
    databaseUrl && !/-pooler\./i.test(databaseUrl) ? databaseUrl : '',
    databaseUrl ? databaseUrl.replace('-pooler.', '.') : ''
  ]);

  if (databaseUrl) {
    env.DATABASE_URL = databaseUrl;
  } else if (forGenerate) {
    env.DATABASE_URL = PLACEHOLDER;
  }

  if (directUrl) {
    env.DIRECT_URL = directUrl;
  } else if (env.DATABASE_URL) {
    env.DIRECT_URL = env.DATABASE_URL;
  } else if (forGenerate) {
    env.DIRECT_URL = PLACEHOLDER;
  }

  return {
    hasRealDb: Boolean(databaseUrl),
    databaseUrl: env.DATABASE_URL || '',
    directUrl: env.DIRECT_URL || ''
  };
}
