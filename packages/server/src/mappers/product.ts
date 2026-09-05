import type { Product as DbProduct, ProductCondition, ProductGender, ProductStatus } from "@jab/db";

function isRenderableImageSrc(src?: string | null): boolean {
  if (!src || typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  if (s.startsWith("data:") || s.startsWith("blob:")) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith("/") && /\.[a-z0-9]+($|\?)/i.test(s)) return true;
  return false;
}

/** Map Prisma Product → SPA Product shape used by src/types.ts */
export function toSpaProduct(
  p: DbProduct & {
    category?: { name: string } | null;
    club?: { name: string } | null;
    league?: { name: string } | null;
  },
) {
  const genderMap: Record<ProductGender, string> = {
    MEN: "Men",
    WOMEN: "Women",
    UNISEX: "Unisex",
    KIDS: "Kids",
  };
  const conditionMap: Record<ProductCondition, string> = {
    MINT: "Mint",
    EXCELLENT: "Excellent",
    VERY_GOOD: "Very Good",
    GOOD: "Good",
    FAIR: "Fair",
  };
  const statusMap: Record<ProductStatus, string> = {
    ACTIVE: "Active",
    DRAFT: "Draft",
    ARCHIVED: "Archived",
    TRASHED: "Trashed",
  };

  const gallery = (p.galleryUrls || []).filter(isRenderableImageSrc);
  const primaryRemote = [p.imageUrl, ...gallery].find(isRenderableImageSrc);

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    originalPrice: p.originalPrice != null ? Number(p.originalPrice) : undefined,
    costPrice: p.costPrice != null ? Number(p.costPrice) : undefined,
    sellingPrice: p.sellingPrice != null ? Number(p.sellingPrice) : undefined,
    discount: p.discountAmount != null ? Number(p.discountAmount) : undefined,
    image: p.imageUrl,
    images: gallery.length ? gallery : primaryRemote ? [primaryRemote] : [],
    gallery,
    club: p.club?.name ?? undefined,
    country: p.country ?? undefined,
    nationalTeam: p.nationalTeam ?? undefined,
    league: p.league?.name ?? undefined,
    brand: p.brandName,
    season: p.season,
    year: p.year,
    gender: genderMap[p.gender],
    condition: conditionMap[p.condition],
    conditionDetail: p.conditionDetail,
    player:
      p.playerName && p.playerNumber != null
        ? { name: p.playerName, number: p.playerNumber }
        : undefined,
    color: p.color,
    sizes: p.sizes,
    sizeStocks: (() => {
      const raw = (p as { sizeStocks?: unknown }).sizeStocks;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
          const n = Number(v);
          if (k && Number.isFinite(n) && n >= 0) out[k] = Math.floor(n);
        }
        return Object.keys(out).length ? out : undefined;
      }
      return undefined;
    })(),
    sku: p.sku,
    barcode: (p as { barcode?: string | null }).barcode ?? undefined,
    badgeAvailable: p.badgeAvailable,
    printAvailable: p.printAvailable,
    namesetPriceBdt: p.namesetPriceBdt,
    badgePriceBdt: p.badgePriceBdt,
    namesetLabel: p.namesetLabel,
    badgeLabel: p.badgeLabel,
    badgeOptions: (() => {
      const raw = (p as { badgeOptions?: unknown }).badgeOptions;
      if (!Array.isArray(raw)) return undefined;
      return raw
        .map((entry, i) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as Record<string, unknown>;
          const label = String(row.label || "").trim();
          if (!label) return null;
          return {
            id: String(row.id || `badge-${i + 1}`),
            label,
            priceBdt: Math.max(0, Math.round(Number(row.priceBdt) || 0)),
          };
        })
        .filter(Boolean);
    })(),
    rating: Number(p.rating),
    reviewsCount: p.reviewsCount,
    description: p.description,
    shortDescription: p.shortDescription ?? undefined,
    longDescription: p.longDescription ?? undefined,
    features: p.features,
    material: p.material ?? undefined,
    dimensions: p.dimensions ?? undefined,
    specification: {
      material: p.material || "Polyester",
      madeIn: p.madeIn || "Unknown",
      fit: p.fit || "Regular",
      sponsor: p.sponsor ?? undefined,
    },
    category: p.category?.name || p.pageName || p.targetPage || undefined,
    categoryId: p.categoryId ?? undefined,
    pageNumber: p.pageNumber ?? undefined,
    targetPage: p.targetPage ?? undefined,
    pageName: p.pageName ?? undefined,
    categoryRow: p.categoryRow ?? undefined,
    sizeChartId: (p as { sizeChartId?: string | null }).sizeChartId ?? undefined,
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    warehouse: (p as { warehouse?: string | null }).warehouse ?? "Dhaka Central",
    binCode: (p as { binCode?: string | null }).binCode ?? undefined,
    isClearance: p.isClearance,
    isDamaged: p.isDamaged,
    damagedQty: p.damagedQty,
    isBestSeller: p.isBestSeller,
    isFeatured: p.isFeatured,
    isPreOrder: (p as { isPreOrder?: boolean }).isPreOrder ?? false,
    preOrderEta: (p as { preOrderEta?: string | null }).preOrderEta ?? undefined,
    // Only real image URLs — catalog keys like argentina_home_1990 are not HTTP assets
    uploadedImage: primaryRemote,
    status: statusMap[p.status],
    isArchived: p.status === "ARCHIVED",
    isTrashed: p.status === "TRASHED",
  };
}

export function mapConditionToPrisma(c: string): ProductCondition {
  const key = c.toUpperCase().replace(/\s+/g, "_");
  if (key === "VERY_GOOD") return "VERY_GOOD";
  if (["MINT", "EXCELLENT", "GOOD", "FAIR"].includes(key)) return key as ProductCondition;
  return "MINT";
}

export function mapGenderToPrisma(g?: string): ProductGender {
  const key = (g || "Men").toUpperCase();
  if (key === "WOMEN") return "WOMEN";
  if (key === "UNISEX") return "UNISEX";
  if (key === "KIDS") return "KIDS";
  return "MEN";
}

export function mapStatusToPrisma(s?: string): ProductStatus {
  const key = (s || "Active").toUpperCase();
  if (key === "DRAFT") return "DRAFT";
  if (key === "ARCHIVED") return "ARCHIVED";
  if (key === "TRASHED") return "TRASHED";
  return "ACTIVE";
}
