import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local", override: true });
const { prisma } = await import("../packages/db/src/index.ts");
const [products, users, staff] = await Promise.all([
  prisma.product.count(),
  prisma.user.count(),
  prisma.user.count({ where: { role: { not: "CUSTOMER" } } }),
]);
console.log(JSON.stringify({ localProducts: products, localUsers: users, localStaff: staff }));
await prisma.$disconnect();
