import type { MetadataRoute } from "next";
import { prisma } from "@jab/db";
import { SITE_ORIGIN, absoluteUrl } from "@/src/lib/siteSeo";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const STATIC_PATHS = [
  "/",
  "/shop",
  "/about",
  "/contact",
  "/faq",
  "/authenticity",
  "/shipping",
  "/privacy",
  "/terms",
  "/refund",
] as const;

const CATEGORY_PATHS = [
  "/shop/Premier%20League",
  "/shop/La%20Liga",
  "/shop/Serie%20A",
  "/shop/Bundesliga",
  "/shop/Ligue%201",
  "/shop/Retro",
  "/shop/Player%20Edition",
  "/shop/World%20Cup",
  "/shop/Clearance",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...STATIC_PATHS.filter((p) => p !== "/").map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "/shop" ? 0.9 : 0.6,
    })),
    ...CATEGORY_PATHS.map((path) => ({
      url: `${SITE_ORIGIN}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  try {
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        status: "ACTIVE",
      },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });

    for (const product of products) {
      const key = product.slug || product.id;
      if (!key) continue;
      entries.push({
        url: absoluteUrl(`/product/${encodeURIComponent(key)}`),
        lastModified: product.updatedAt || now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch (err) {
    console.error("[sitemap] product query failed", err);
  }

  return entries;
}
