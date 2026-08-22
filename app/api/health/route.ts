import { describeEnvUrl, isPostgresConnectionUrl, postgresUrlCandidates } from '@/lib/db-url';

/** Safe public status for debugging env (never returns secrets). */
export async function GET() {
  const aliases = {
    POSTGRES_PRISMA_URL: describeEnvUrl(process.env.POSTGRES_PRISMA_URL),
    POSTGRES_URL: describeEnvUrl(process.env.POSTGRES_URL),
    DATABASE_URL: describeEnvUrl(process.env.DATABASE_URL),
    DATABASE_URL_UNPOOLED: describeEnvUrl(process.env.DATABASE_URL_UNPOOLED),
    DIRECT_URL: describeEnvUrl(process.env.DIRECT_URL),
    POSTGRES_URL_NON_POOLING: describeEnvUrl(process.env.POSTGRES_URL_NON_POOLING)
  };
  const resolved = postgresUrlCandidates()[0] || '';
  const ok = isPostgresConnectionUrl(resolved) || isPostgresConnectionUrl(process.env.DATABASE_URL);

  return Response.json(
    {
      ok,
      database: 'neon-postgresql',
      cloudinary: 'res.cloudinary.com',
      message: ok
        ? 'A Neon PostgreSQL URL is available (DATABASE_URL or Vercel/Neon aliases).'
        : 'Connect Neon in Vercel, or edit DATABASE_URL to a postgresql:// URL. Do not add a duplicate variable.',
      env: {
        ...aliases,
        hasJwtSecret: Boolean(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET),
        hasAdminEmail: Boolean(process.env.INITIAL_ADMIN_EMAIL),
        hasCloudinary: Boolean(
          process.env.CLOUDINARY_URL ||
            (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_SECRET)
        ),
        nodeEnv: process.env.NODE_ENV || null,
        vercelEnv: process.env.VERCEL_ENV || null
      }
    },
    { status: ok ? 200 : 503 }
  );
}
