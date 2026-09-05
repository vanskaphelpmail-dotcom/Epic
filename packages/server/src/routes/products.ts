import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@jab/db";
import { requireStaff, optionalAuth, isStaffUser, type AuthedRequest } from "../middleware/auth";
import { requirePermission, type AuthedRequestWithFlags } from "../lib/permissions";
import {
  mapConditionToPrisma,
  mapGenderToPrisma,
  mapStatusToPrisma,
  toSpaProduct,
} from "../mappers/product";

export const productsRouter = Router();

async function persistSizeChartId(productId: string, sizeChartId?: string | null) {
  if (sizeChartId === undefined) return;
  try {
    await prisma.$executeRaw`
      UPDATE products
      SET "sizeChartId" = ${sizeChartId || null}
      WHERE id = ${productId}
    `;
  } catch (err) {
    console.warn("[products] sizeChartId persist skipped", err);
  }
}

async function loadSizeChartIds(ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!ids.length) return map;
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string; sizeChartId: string | null }>>`
      SELECT id, "sizeChartId" FROM products WHERE id IN (${Prisma.join(ids)})
    `;
    for (const row of rows) map.set(row.id, row.sizeChartId);
  } catch {
    /* column / client mismatch — charts still resolve from category */
  }
  return map;
}

productsRouter.get("/", optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    // High ceiling so storefront/admin can load full catalogs (no hard 100 cap)
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit ?? 48)));
    const q = String(req.query.q ?? "").trim();
    const featured = req.query.featured === "1";
    const bestSeller = req.query.bestSeller === "1";
    const wantsAll = req.query.all === "1";
    const includeDraft = wantsAll && isStaffUser(req.user);

    if (wantsAll && !includeDraft) {
      return res.status(403).json({
        success: false,
        error: { message: "Staff access required for full catalog" },
      });
    }

    const where = {
      ...(includeDraft
        ? {
            // Admin catalog: Active/Draft/Archived (no trash bin)
            deletedAt: null,
            NOT: { status: "TRASHED" as const },
          }
        : { deletedAt: null, status: "ACTIVE" as const }),
      ...(featured ? { isFeatured: true } : {}),
      ...(bestSeller ? { isBestSeller: true } : {}),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { brandName: { contains: q, mode: "insensitive" as const } },
                  { sku: { contains: q, mode: "insensitive" as const } },
                  { description: { contains: q, mode: "insensitive" as const } },
                  { shortDescription: { contains: q, mode: "insensitive" as const } },
                  { country: { contains: q, mode: "insensitive" as const } },
                  { nationalTeam: { contains: q, mode: "insensitive" as const } },
                  { season: { contains: q, mode: "insensitive" as const } },
                  { playerName: { contains: q, mode: "insensitive" as const } },
                  { targetPage: { contains: q, mode: "insensitive" as const } },
                  { pageName: { contains: q, mode: "insensitive" as const } },
                  { category: { name: { contains: q, mode: "insensitive" as const } } },
                ],
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
        // Lean list — keep category name (needed for homepage rows + card labels)
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          barcode: true,
          price: true,
          originalPrice: true,
          ...(includeDraft ? { costPrice: true } : {}),
          sellingPrice: true,
          discountAmount: true,
          description: true,
          shortDescription: true,
          features: true,
          imageUrl: true,
          galleryUrls: true,
          brandName: true,
          brandId: true,
          leagueId: true,
          league: { select: { name: true } },
          clubId: true,
          club: { select: { name: true } },
          categoryId: true,
          category: { select: { name: true } },
          country: true,
          nationalTeam: true,
          season: true,
          year: true,
          gender: true,
          condition: true,
          conditionDetail: true,
          color: true,
          sizes: true,
          sizeStocks: true,
          playerName: true,
          playerNumber: true,
          material: true,
          madeIn: true,
          fit: true,
          sponsor: true,
          dimensions: true,
          badgeAvailable: true,
          printAvailable: true,
          namesetPriceBdt: true,
          badgePriceBdt: true,
          namesetLabel: true,
          badgeLabel: true,
          badgeOptions: true,
          rating: true,
          reviewsCount: true,
          stock: true,
          lowStockThreshold: true,
          damagedQty: true,
          warehouse: true,
          binCode: true,
          isClearance: true,
          isDamaged: true,
          isBestSeller: true,
          isFeatured: true,
          isPreOrder: true,
          preOrderEta: true,
          pageNumber: true,
          targetPage: true,
          pageName: true,
          categoryRow: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    const chartIds = await loadSizeChartIds(rows.map((p) => p.id));

    return res.json({
      success: true,
      data: {
        items: rows.map((p) => {
          const spa = toSpaProduct({
            ...p,
            longDescription: null,
            sizeChartId: chartIds.get(p.id) ?? null,
          } as Parameters<typeof toSpaProduct>[0]);
          if (!includeDraft) {
            const { costPrice: _cost, ...pub } = spa as typeof spa & { costPrice?: number };
            return pub;
          }
          return spa;
        }),
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("[GET /products]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list products" } });
  }
});

productsRouter.get("/:idOrSlug", optionalAuth, async (req: AuthedRequest, res) => {
  try {
    const key = req.params.idOrSlug;
    const staff = isStaffUser(req.user);
    const row = await prisma.product.findFirst({
      where: {
        deletedAt: null,
        OR: [{ id: key }, { slug: key }, { sku: key }],
        ...(staff ? {} : { status: "ACTIVE" as const }),
      },
      include: { category: true, club: true, league: true },
    });
    if (!row) return res.status(404).json({ success: false, error: { message: "Product not found" } });
    const spa = toSpaProduct(row);
    if (!staff) {
      const { costPrice: _cost, ...pub } = spa as typeof spa & { costPrice?: number };
      return res.json({ success: true, data: pub });
    }
    return res.json({ success: true, data: spa });
  } catch (error) {
    console.error("[GET /products/:id]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load product" } });
  }
});

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  slug: z.string().min(2),
  sku: z.string().min(2),
  barcode: z.string().min(4).max(32).optional().nullable(),
  price: z.number().positive(),
  originalPrice: z.number().nonnegative().nullable().optional(),
  costPrice: z.number().optional(),
  sellingPrice: z.number().optional(),
  discount: z.number().nonnegative().nullable().optional(),
  description: z.string().min(1),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  features: z.array(z.string()).optional(),
  image: z.string().min(1),
  images: z.array(z.string()).optional(),
  brand: z.string().min(1),
  season: z.string().min(1),
  year: z.number().int(),
  condition: z.string(),
  conditionDetail: z.string().default(""),
  color: z.string().default("Multi"),
  sizes: z.array(z.string()).default([]),
  sizeStocks: z.record(z.string(), z.number().int().nonnegative()).optional(),
  stock: z.number().int().nonnegative().default(0),
  gender: z.string().optional(),
  country: z.string().optional(),
  nationalTeam: z.string().optional(),
  player: z.object({ name: z.string(), number: z.number() }).optional(),
  badgeAvailable: z.boolean().optional(),
  printAvailable: z.boolean().optional(),
  namesetPriceBdt: z.number().int().nonnegative().optional(),
  badgePriceBdt: z.number().int().nonnegative().optional(),
  namesetLabel: z.string().optional(),
  badgeLabel: z.string().optional(),
  badgeOptions: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        priceBdt: z.number().int().nonnegative(),
      }),
    )
    .optional(),
  isFeatured: z.boolean().optional(),
  isBestSeller: z.boolean().optional(),
  isClearance: z.boolean().optional(),
  isPreOrder: z.boolean().optional(),
  preOrderEta: z.string().optional().nullable(),
  status: z.string().optional(),
  material: z.string().optional(),
  madeIn: z.string().optional(),
  fit: z.string().optional(),
  sponsor: z.string().optional(),
  warehouse: z.string().optional(),
  binCode: z.string().optional().nullable(),
  lowStockThreshold: z.number().int().optional(),
  category: z.string().optional(),
  targetPage: z.string().optional(),
  pageName: z.string().optional(),
  pageNumber: z.number().int().optional(),
  categoryRow: z.number().int().optional(),
  sizeChartId: z.string().optional().nullable(),
});

async function resolveCategoryId(categoryName?: string | null) {
  const name = String(categoryName || "").trim();
  if (!name) return undefined;

  const existingByName = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existingByName) return existingByName.id;

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `cat-${Date.now()}`;

  const existingBySlug = await prisma.category.findUnique({ where: { slug } });
  if (existingBySlug) return existingBySlug.id;

  try {
    const created = await prisma.category.create({
      data: {
        name,
        slug,
        status: "ACTIVE",
      },
    });
    return created.id;
  } catch (err: unknown) {
    // Race or name/slug mismatch — reuse whatever already owns this slug
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: string }).code : undefined;
    if (code === "P2002") {
      const again =
        (await prisma.category.findUnique({ where: { slug } })) ||
        (await prisma.category.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        }));
      if (again) return again.id;
    }
    throw err;
  }
}

function productCreateData(body: z.infer<typeof upsertSchema>, categoryId?: string) {
  return {
    id: body.id,
    name: body.name,
    slug: body.slug,
    sku: body.sku,
    barcode: body.barcode?.trim() || null,
    price: body.price,
    originalPrice:
      body.originalPrice == null || body.originalPrice <= 0 ? null : body.originalPrice,
    costPrice: body.costPrice,
    sellingPrice: body.sellingPrice ?? body.price,
    discountAmount: body.discount == null || body.discount <= 0 ? null : body.discount,
    description: body.description,
    shortDescription: body.shortDescription,
    longDescription: body.longDescription,
    features: body.features || [],
    imageUrl: body.image,
    galleryUrls: body.images?.length ? body.images : [body.image],
    brandName: body.brand,
    season: body.season,
    year: body.year,
    condition: mapConditionToPrisma(body.condition),
    conditionDetail: body.conditionDetail || "",
    color: body.color || "Multi",
    sizes: body.sizes,
    sizeStocks: body.sizeStocks ?? undefined,
    stock: body.stock,
    gender: mapGenderToPrisma(body.gender),
    country: body.country,
    nationalTeam: body.nationalTeam || body.country,
    playerName: body.player?.name,
    playerNumber: body.player?.number,
    badgeAvailable: body.badgeAvailable ?? true,
    printAvailable: body.printAvailable ?? true,
    namesetPriceBdt: body.namesetPriceBdt ?? 15,
    badgePriceBdt: body.badgePriceBdt ?? 15,
    namesetLabel: body.namesetLabel ?? "Custom Nameset Printing",
    badgeLabel: body.badgeLabel ?? "WC '26",
    badgeOptions: body.badgeOptions?.length ? body.badgeOptions : undefined,
    isFeatured: body.isFeatured ?? false,
    isBestSeller: body.isBestSeller ?? false,
    isClearance: body.isClearance ?? false,
    isPreOrder: body.isPreOrder ?? false,
    preOrderEta: body.preOrderEta ?? null,
    status: mapStatusToPrisma(body.status),
    material: body.material,
    madeIn: body.madeIn,
    fit: body.fit,
    sponsor: body.sponsor,
    warehouse: body.warehouse,
    binCode: body.binCode,
    lowStockThreshold: body.lowStockThreshold ?? 3,
    categoryId,
    targetPage: body.targetPage,
    pageName: body.pageName,
    pageNumber: body.pageNumber,
    categoryRow: body.categoryRow,
    publishedAt: mapStatusToPrisma(body.status) === "ACTIVE" ? new Date() : null,
  };
}

productsRouter.post("/", requirePermission("can_manage_products"), async (req: AuthedRequest, res) => {
  try {
    const body = upsertSchema.parse(req.body);
    const categoryId = await resolveCategoryId(body.category);
    const created = await prisma.product.create({
      data: productCreateData(body, categoryId),
      include: { category: true, club: true, league: true },
    });
    await persistSizeChartId(created.id, body.sizeChartId);
    const spa = toSpaProduct({
      ...created,
      sizeChartId: body.sizeChartId || null,
    } as Parameters<typeof toSpaProduct>[0]);
    return res.status(201).json({ success: true, data: spa });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid product" } });
    }
    const msg = String((error as Error)?.message || "");
    if (msg.includes("Unique constraint") || msg.includes("P2002")) {
      return res.status(400).json({ success: false, error: { message: "SKU or slug already exists" } });
    }
    console.error("[POST /products]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to create product" } });
  }
});

productsRouter.put("/:id", requirePermission("can_manage_products"), async (req: AuthedRequestWithFlags, res) => {
  try {
    const body = upsertSchema
      .partial()
      .extend({
        name: z.string().min(2).optional(),
        stock: z.number().int().nonnegative().optional(),
      })
      .parse(req.body);

    const flags = req.accessFlags;
    const isRoot =
      req.user!.role === "SUPER_ADMIN" || (req.user!.permissions || []).includes("*");

    if (
      !isRoot &&
      flags &&
      !flags.can_edit_prices &&
      (body.price != null ||
        body.originalPrice !== undefined ||
        body.costPrice != null ||
        body.sellingPrice != null ||
        body.discount !== undefined ||
        body.namesetPriceBdt != null ||
        body.badgePriceBdt != null)
    ) {
      return res.status(403).json({
        success: false,
        error: { message: "Missing permission: can_edit_prices" },
      });
    }

    if (
      !isRoot &&
      flags &&
      !flags.can_edit_stock &&
      (body.stock != null || body.sizeStocks != null || body.lowStockThreshold != null)
    ) {
      return res.status(403).json({
        success: false,
        error: { message: "Missing permission: can_edit_stock" },
      });
    }

    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: "Product not found" } });
    }
    if (existing.deletedAt || existing.status === "TRASHED") {
      return res.status(404).json({ success: false, error: { message: "Product not found" } });
    }

    const categoryId =
      body.category !== undefined ? await resolveCategoryId(body.category) : undefined;

    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.slug != null ? { slug: body.slug } : {}),
        ...(body.sku != null ? { sku: body.sku } : {}),
        ...(body.barcode !== undefined
          ? { barcode: body.barcode?.trim() ? body.barcode.trim() : null }
          : {}),
        ...(body.price != null ? { price: body.price } : {}),
        ...(body.originalPrice !== undefined
          ? { originalPrice: body.originalPrice == null || body.originalPrice <= 0 ? null : body.originalPrice }
          : {}),
        ...(body.costPrice != null ? { costPrice: body.costPrice } : {}),
        ...(body.sellingPrice != null ? { sellingPrice: body.sellingPrice } : {}),
        ...(body.discount !== undefined
          ? { discountAmount: body.discount == null || body.discount <= 0 ? null : body.discount }
          : {}),
        ...(body.description != null ? { description: body.description } : {}),
        ...(body.shortDescription != null ? { shortDescription: body.shortDescription } : {}),
        ...(body.longDescription != null ? { longDescription: body.longDescription } : {}),
        ...(body.features != null ? { features: body.features } : {}),
        ...(body.image != null ? { imageUrl: body.image } : {}),
        ...(body.images != null ? { galleryUrls: body.images } : {}),
        ...(body.brand != null ? { brandName: body.brand } : {}),
        ...(body.season != null ? { season: body.season } : {}),
        ...(body.year != null ? { year: body.year } : {}),
        ...(body.condition != null ? { condition: mapConditionToPrisma(body.condition) } : {}),
        ...(body.conditionDetail != null ? { conditionDetail: body.conditionDetail } : {}),
        ...(body.color != null ? { color: body.color } : {}),
        ...(body.sizes != null ? { sizes: body.sizes } : {}),
        ...(body.sizeStocks != null ? { sizeStocks: body.sizeStocks } : {}),
        ...(body.stock != null ? { stock: body.stock } : {}),
        ...(body.gender != null ? { gender: mapGenderToPrisma(body.gender) } : {}),
        ...(body.country != null ? { country: body.country } : {}),
        ...(body.nationalTeam != null ? { nationalTeam: body.nationalTeam } : {}),
        ...(body.status != null
          ? {
              status: mapStatusToPrisma(body.status) === "TRASHED" ? "ARCHIVED" : mapStatusToPrisma(body.status),
              ...(mapStatusToPrisma(body.status) === "ACTIVE" || mapStatusToPrisma(body.status) === "TRASHED"
                ? { deletedAt: null }
                : {}),
            }
          : {}),
        ...(body.isFeatured != null ? { isFeatured: body.isFeatured } : {}),
        ...(body.isBestSeller != null ? { isBestSeller: body.isBestSeller } : {}),
        ...(body.isClearance != null ? { isClearance: body.isClearance } : {}),
        ...(body.isPreOrder != null ? { isPreOrder: body.isPreOrder } : {}),
        ...(body.preOrderEta !== undefined ? { preOrderEta: body.preOrderEta } : {}),
        ...(body.badgeAvailable != null ? { badgeAvailable: body.badgeAvailable } : {}),
        ...(body.printAvailable != null ? { printAvailable: body.printAvailable } : {}),
        ...(body.namesetPriceBdt != null ? { namesetPriceBdt: body.namesetPriceBdt } : {}),
        ...(body.badgePriceBdt != null ? { badgePriceBdt: body.badgePriceBdt } : {}),
        ...(body.namesetLabel != null ? { namesetLabel: body.namesetLabel } : {}),
        ...(body.badgeLabel != null ? { badgeLabel: body.badgeLabel } : {}),
        ...(body.badgeOptions != null ? { badgeOptions: body.badgeOptions } : {}),
        ...(body.warehouse != null ? { warehouse: body.warehouse } : {}),
        ...(body.binCode !== undefined ? { binCode: body.binCode } : {}),
        ...(body.lowStockThreshold != null ? { lowStockThreshold: body.lowStockThreshold } : {}),
        ...(body.material != null ? { material: body.material } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(body.targetPage != null ? { targetPage: body.targetPage } : {}),
        ...(body.pageName != null ? { pageName: body.pageName } : {}),
        ...(body.pageNumber != null ? { pageNumber: body.pageNumber } : {}),
        ...(body.categoryRow != null ? { categoryRow: body.categoryRow } : {}),
        ...(body.player != null
          ? { playerName: body.player.name, playerNumber: body.player.number }
          : {}),
      },
      include: { category: true, club: true, league: true },
    });

    if (body.stock != null && body.stock !== existing.stock) {
      await prisma.stockLog.create({
        data: {
          productId: existing.id,
          productName: existing.name,
          sku: existing.sku,
          previousStock: existing.stock,
          newStock: body.stock,
          change: body.stock - existing.stock,
          reason: "MANUAL_ADJUSTMENT",
          note: req.body.stockNote || "Admin inventory adjustment",
          userId: req.user!.id,
        },
      });
    }

    await persistSizeChartId(updated.id, body.sizeChartId);
    return res.json({
      success: true,
      data: toSpaProduct({
        ...updated,
        sizeChartId: body.sizeChartId !== undefined ? body.sizeChartId || null : (updated as { sizeChartId?: string | null }).sizeChartId,
      } as Parameters<typeof toSpaProduct>[0]),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: { message: error.issues[0]?.message || "Invalid product" } });
    }
    console.error("[PUT /products/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update product" } });
  }
});

productsRouter.get("/:id/stock-logs", requirePermission("can_edit_stock"), async (req: AuthedRequest, res) => {
  try {
    const logs = await prisma.stockLog.findMany({
      where: { productId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({
      success: true,
      data: {
        items: logs.map((l) => ({
          id: l.id,
          productId: l.productId,
          productName: l.productName,
          sku: l.sku,
          previousStock: l.previousStock,
          newStock: l.newStock,
          change: l.change,
          reason: l.reason,
          note: l.note,
          timestamp: l.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[GET /products/:id/stock-logs]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load stock logs" } });
  }
});

productsRouter.delete("/:id", requirePermission("can_manage_products"), async (req: AuthedRequest, res) => {
  try {
    const key = decodeURIComponent(String(req.params.id || "")).trim();
    if (!key) {
      return res.status(400).json({ success: false, error: { message: "Product id required" } });
    }

    // Match GET lookup — clients may send id, slug, or sku
    const existing = await prisma.product.findFirst({
      where: { OR: [{ id: key }, { slug: key }, { sku: key }] },
      select: { id: true },
    });

    // Idempotent: already gone (seed-only / double-click) — let the UI clear it
    if (!existing) {
      return res.json({ success: true, data: { id: key, deleted: false } });
    }

    const productId = existing.id;

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { productId } });
      await tx.wishlistItem.deleteMany({ where: { productId } });
      await tx.stockLog.deleteMany({ where: { productId } });
      await tx.productImage.deleteMany({ where: { productId } });
      await tx.dailyDeal.deleteMany({ where: { productId } });
      await tx.orderItem.updateMany({ where: { productId }, data: { productId: null } });
      await tx.review.updateMany({ where: { productId }, data: { productId: null } });
      await tx.banner.updateMany({ where: { productId }, data: { productId: null } });
      await tx.auctionLot.updateMany({ where: { productId }, data: { productId: null } });
      await tx.product.delete({ where: { id: productId } });
    });

    return res.json({ success: true, data: { id: productId, deleted: true } });
  } catch (error: any) {
    // Race: another request already removed it
    if (error?.code === "P2025") {
      return res.json({
        success: true,
        data: { id: String(req.params.id || ""), deleted: false },
      });
    }
    console.error("[DELETE /products/:id]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to delete product" },
    });
  }
});
