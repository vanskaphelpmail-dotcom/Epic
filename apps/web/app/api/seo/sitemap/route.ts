import { NextResponse } from "next/server";
import { prisma } from "@jab/db";
import { SITE_ORIGIN, absoluteUrl } from "@/src/lib/siteSeo";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(
  loc: string,
  opts?: { lastmod?: Date; changefreq?: string; priority?: number },
) {
  const lastmod = opts?.lastmod ? opts.lastmod.toISOString() : new Date().toISOString();
  const changefreq = opts?.changefreq || "weekly";
  const priority = opts?.priority ?? 0.7;
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
}

export async function GET() {
  const now = new Date();
  const parts: string[] = [
    urlEntry(absoluteUrl("/"), { lastmod: now, changefreq: "daily", priority: 1 }),
    urlEntry(absoluteUrl("/shop"), { priority: 0.9 }),
    urlEntry(absoluteUrl("/about"), { priority: 0.6 }),
    urlEntry(absoluteUrl("/contact"), { priority: 0.6 }),
    urlEntry(absoluteUrl("/faq"), { priority: 0.6 }),
    urlEntry(absoluteUrl("/authenticity"), { priority: 0.5 }),
    urlEntry(absoluteUrl("/shipping"), { priority: 0.5 }),
    urlEntry(absoluteUrl("/privacy"), { priority: 0.4 }),
    urlEntry(absoluteUrl("/terms"), { priority: 0.4 }),
    urlEntry(absoluteUrl("/refund"), { priority: 0.4 }),
  ];

  const categories = [
    "Premier League",
    "La Liga",
    "Serie A",
    "Bundesliga",
    "Ligue 1",
    "Retro",
    "Player Edition",
    "World Cup",
    "Clearance",
  ];
  for (const cat of categories) {
    parts.push(
      urlEntry(`${SITE_ORIGIN}/shop/${encodeURIComponent(cat)}`, { priority: 0.8 }),
    );
  }

  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    for (const product of products) {
      const key = product.slug || product.id;
      if (!key) continue;
      parts.push(
        urlEntry(absoluteUrl(`/product/${encodeURIComponent(key)}`), {
          lastmod: product.updatedAt || now,
          priority: 0.7,
        }),
      );
    }
  } catch (err) {
    console.error("[api/seo/sitemap] product query failed", err);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${parts.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
