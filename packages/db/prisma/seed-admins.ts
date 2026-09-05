/**
 * Upsert staff admin accounts (does not reseed products).
 * Password matches main admin: SEED_ADMIN_PASSWORD / INITIAL_ADMIN_PASSWORD.
 *
 * Run from repo root: npx tsx packages/db/prisma/seed-admins.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

const staffAdmins = [
  { email: "hasanrahinn@gmail.com", fullName: "Rahin" },
  { email: "yaqubislam71@gmail.com", fullName: "Yaqub" },
  { email: "epicvanskap@gmail.com", fullName: "Vanskap" },
] as const;

async function main() {
  // Import prisma only after env is loaded
  const { prisma, UserRole } = await import("../src/index");

  const plain = (
    process.env.SEED_ADMIN_PASSWORD ||
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "ChangeMeNow!"
  )
    .trim()
    .replace(/^"|"$/g, "");

  const passwordHash = await hash(plain, 12);

  try {
    for (const admin of staffAdmins) {
      await prisma.user.upsert({
        where: { email: admin.email.toLowerCase() },
        update: {
          passwordHash,
          role: UserRole.ADMIN,
          status: "ACTIVE",
          permissions: ["*"],
          fullName: admin.fullName,
          department: "Operations",
        },
        create: {
          email: admin.email.toLowerCase(),
          fullName: admin.fullName,
          passwordHash,
          role: UserRole.ADMIN,
          permissions: ["*"],
          status: "ACTIVE",
          department: "Operations",
        },
      });
      console.log(`[seed-admins] upserted ADMIN ${admin.email} (${admin.fullName})`);
    }
    console.log("[seed-admins] done — same password as main admin (SEED_ADMIN_PASSWORD)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
