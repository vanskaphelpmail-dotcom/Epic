import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Reuse across warm serverless invocations (Next / Vercel)
globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export default prisma;
