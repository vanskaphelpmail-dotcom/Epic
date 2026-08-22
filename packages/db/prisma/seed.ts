import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hash } from "bcryptjs";
import {
  prisma,
  UserRole,
  ProductStatus,
  ProductCondition,
  ProductGender,
} from "../src/index";
import { PRODUCTS } from "../../../apps/web/src/data/storeData";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../.env") });
loadEnv({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

function mapCondition(c: string): ProductCondition {
  const key = c.toUpperCase().replace(/\s+/g, "_");
  if (key === "VERY_GOOD") return ProductCondition.VERY_GOOD;
  if (key in ProductCondition) return key as ProductCondition;
  return ProductCondition.MINT;
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword === "ChangeMeNow!") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Refusing to seed: set a strong SEED_ADMIN_PASSWORD (do not use ChangeMeNow!).",
      );
    }
    console.warn(
      "[seed] WARNING: using default SEED_ADMIN_PASSWORD. Set a strong password before any production deploy.",
    );
  }

  await prisma.storeSettings.upsert({
    where: { id: "default" },
    update: {
      logoText: "Epic Vanskap",
      footerCopyright: `© ${new Date().getFullYear()} Epic Vanskap`,
      bkashPersonalNumber: "",
      bkashEnabled: true,
    },
    create: {
      id: "default",
      logoText: "Epic Vanskap",
      footerAbout:
        "Authentic classic and modern football jerseys for collectors in Bangladesh.",
      footerCopyright: `© ${new Date().getFullYear()} Epic Vanskap`,
      currencySymbol: "৳",
      currencyCode: "BDT",
      exchangeRate: 115,
      bkashPersonalNumber: "",
      bkashEnabled: true,
      deliveryInside: 70,
      deliveryOutside: 130,
    },
  });

  await prisma.storeLocation.upsert({
    where: { id: "feni-garden-city" },
    update: {
      city: "Feni",
      address: "Shop no: B: 67-68, 1st Floor, Feni Garden City Market, Feni, 3900",
      phone: "",
      hours: "11:00 AM - 09:30 PM (Friday - Wednesday)",
      sortOrder: 0,
      isActive: true,
    },
    create: {
      id: "feni-garden-city",
      city: "Feni",
      address: "Shop no: B: 67-68, 1st Floor, Feni Garden City Market, Feni, 3900",
      phone: "",
      hours: "11:00 AM - 09:30 PM (Friday - Wednesday)",
      sortOrder: 0,
      isActive: true,
    },
  });

  await prisma.storeLocation.updateMany({
    where: { id: { in: ["dhaka-hq", "savar-outlet"] } },
    data: { isActive: false },
  });

  // Keep legacy rows for FK safety but hide them from storefront
  await prisma.storeLocation.upsert({
    where: { id: "dhaka-hq" },
    update: { isActive: false, sortOrder: 99 },
    create: {
      id: "dhaka-hq",
      city: "Dhaka HQ (legacy)",
      address: "Legacy location — inactive",
      phone: "",
      hours: "",
      sortOrder: 99,
      isActive: false,
    },
  });

  await prisma.storeLocation.upsert({
    where: { id: "savar-outlet" },
    update: { isActive: false, sortOrder: 100 },
    create: {
      id: "savar-outlet",
      city: "Savar Outlet (legacy)",
      address: "Legacy location — inactive",
      phone: "",
      hours: "",
      sortOrder: 100,
      isActive: false,
    },
  });

  const passwordHash = await hash(adminPassword || "ChangeMeNow!", 12);
  const adminEmail = "admin@epicvanskap.com";

  const legacyAdmin = await prisma.user.findUnique({
    where: { email: "admin@jerseyaddicts.bd" },
  });
  if (legacyAdmin) {
    await prisma.user.update({
      where: { id: legacyAdmin.id },
      data: {
        email: adminEmail,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        permissions: ["*"],
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: UserRole.SUPER_ADMIN, permissions: ["*"], status: "ACTIVE" },
      create: {
        email: adminEmail,
        fullName: "Super Admin",
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        permissions: ["*"],
        status: "ACTIVE",
      },
    });
  }

  console.log(`[seed] Super admin ready: ${adminEmail}`);
  console.log(`[seed] Staff admins: rokib@admin.com, sabbir@admin.com, akib@admin.com (password: Admin@018)`);

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
  }

  // Demo customer removed — public customer accounts disabled
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        slug: p.slug,
        price: p.price,
        originalPrice: p.originalPrice,
        description: p.description,
        imageUrl: p.image,
        galleryUrls: p.images?.length ? p.images : [p.image],
        brandName: p.brand,
        season: p.season,
        year: p.year,
        condition: mapCondition(p.condition),
        conditionDetail: p.conditionDetail,
        color: p.color,
        sizes: p.sizes,
        stock: p.stock,
        country: p.country,
        playerName: p.player?.name,
        playerNumber: p.player?.number,
        isFeatured: !!p.isFeatured,
        isBestSeller: !!p.isBestSeller,
        isClearance: !!p.isClearance,
        status: ProductStatus.ACTIVE,
        material: p.specification?.material,
        madeIn: p.specification?.madeIn,
        fit: p.specification?.fit,
        sponsor: p.specification?.sponsor,
        gender: ProductGender.MEN,
        publishedAt: new Date(),
        deletedAt: null,
      },
      create: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        price: p.price,
        originalPrice: p.originalPrice,
        description: p.description,
        imageUrl: p.image,
        galleryUrls: p.images?.length ? p.images : [p.image],
        brandName: p.brand,
        season: p.season,
        year: p.year,
        condition: mapCondition(p.condition),
        conditionDetail: p.conditionDetail,
        color: p.color,
        sizes: p.sizes,
        stock: p.stock,
        country: p.country,
        playerName: p.player?.name,
        playerNumber: p.player?.number,
        badgeAvailable: p.badgeAvailable,
        printAvailable: p.printAvailable,
        rating: p.rating,
        reviewsCount: p.reviewsCount,
        isFeatured: !!p.isFeatured,
        isBestSeller: !!p.isBestSeller,
        isClearance: !!p.isClearance,
        status: ProductStatus.ACTIVE,
        material: p.specification?.material,
        madeIn: p.specification?.madeIn,
        fit: p.specification?.fit,
        sponsor: p.specification?.sponsor,
        gender: ProductGender.MEN,
        publishedAt: new Date(),
      },
    });
  }

  console.log(`Seed complete — ${PRODUCTS.length} products, admin + customer users ready`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
