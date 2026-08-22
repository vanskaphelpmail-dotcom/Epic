import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import ws from 'ws';
import { resolveDatabaseUrl, stripPrismaPoolParams } from '@/lib/db-url';

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = stripPrismaPoolParams(resolveDatabaseUrl());
  process.env.DATABASE_URL = url;
  const pool = new Pool({ connectionString: url, max: 5 });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  });
}

/** Neon serverless driver — avoids Prisma TCP pool (connection_limit=1) on Vercel. */
export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function prismaDelegate(name: string) {
  const delegate = (prisma as unknown as Record<string, any>)[name];
  if (!delegate || typeof delegate.findMany !== 'function') return null;
  return delegate;
}
