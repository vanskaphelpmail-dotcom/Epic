import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  try {
    const parsed = new URL(url);
    // Keep Neon + node-pg SSL semantics compatible (avoids verify-full warning/noise).
    if (!parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function createPool(): Pool {
  return new Pool({
    connectionString: resolveDatabaseUrl(),
    // Neon pooler: keep a small pool; idle connections get closed by Neon.
    max: Number(process.env.PG_POOL_MAX || 5),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    ssl: { rejectUnauthorized: false },
  });
}

function createClient(): PrismaClient {
  const pool = globalForPrisma.pgPool ?? createPool();
  globalForPrisma.pgPool = pool;

  // Recreate dead clients when Neon closes idle TCP sockets.
  pool.on("error", (err) => {
    console.warn("[prisma/pg] pool error:", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Reuse across warm serverless invocations (Next / Vercel)
globalForPrisma.prisma = prisma;

export * from "../generated/prisma/client";
export default prisma;
