/**
 * Upsert the three staff admin accounts (does not reseed products).
 * Run: npx tsx packages/db/prisma/seed-admins.ts
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";
import { prisma, UserRole } from "../src/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

async function main() {
  const staffPassword = await hash("Admin@018", 12);
  const staffAdmins = [
    { email: "rokib@admin.com", fullName: "Rokib Admin" },
    { email: "sabbir@admin.com", fullName: "Sabbir Admin" },
    { email: "akib@admin.com", fullName: "Akib Admin" },
  ] as const;

  for (const admin of staffAdmins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: {
        passwordHash: staffPassword,
        role: UserRole.ADMIN,
        status: "ACTIVE",
        permissions: ["*"],
        fullName: admin.fullName,
      },
      create: {
        email: admin.email,
        fullName: admin.fullName,
        passwordHash: staffPassword,
        role: UserRole.ADMIN,
        permissions: ["*"],
        status: "ACTIVE",
      },
    });
    console.log(`[seed-admins] upserted ${admin.email}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
