/**
 * Upsert all staff admin accounts + reset passwords to SEED_ADMIN_PASSWORD.
 * Safe to run against Neon (local .env DATABASE_URL should match Vercel).
 *
 * Usage: node scripts/sync-prod-admins.mjs
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local"), override: true });

function clean(v) {
  return String(v || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

const plain = clean(
  process.env.SEED_ADMIN_PASSWORD ||
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    "EpicVanskap@2026",
);

if (!plain || plain.length < 8) {
  console.error("[sync-prod-admins] SEED_ADMIN_PASSWORD too short");
  process.exit(1);
}

const staff = [
  { email: "admin@epicvanskap.com", fullName: "Epic Vanskap Admin", role: "SUPER_ADMIN" },
  { email: "hasanrahinn@gmail.com", fullName: "Rahin", role: "ADMIN" },
  { email: "yaqubislam71@gmail.com", fullName: "Yaqub", role: "ADMIN" },
  { email: "epicvanskap@gmail.com", fullName: "Vanskap", role: "ADMIN" },
];

const { prisma } = await import("../packages/db/src/index.ts");

const passwordHash = await hash(plain, 12);

try {
  const before = await prisma.user.count({ where: { role: { not: "CUSTOMER" } } });
  console.log(JSON.stringify({ staffBefore: before, passwordLen: plain.length }));

  for (const admin of staff) {
    const email = admin.email.toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        role: admin.role,
        status: "ACTIVE",
        permissions: ["*"],
        fullName: admin.fullName,
        department: "Operations",
      },
      create: {
        email,
        fullName: admin.fullName,
        passwordHash,
        role: admin.role,
        permissions: ["*"],
        status: "ACTIVE",
        department: "Operations",
      },
    });
    console.log(`[sync-prod-admins] upserted ${admin.role} ${email}`);
  }

  const after = await prisma.user.findMany({
    where: { email: { in: staff.map((s) => s.email) } },
    select: { email: true, role: true, status: true },
    orderBy: { email: "asc" },
  });
  console.log(JSON.stringify({ upserted: after }, null, 2));
} finally {
  await prisma.$disconnect();
}
