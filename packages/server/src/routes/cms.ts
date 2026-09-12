import { Router } from "express";
import { z } from "zod";
import { prisma, type BannerType, type PublishStatus, type PageSectionStatus } from "@jab/db";
import { requireStaff, type AuthedRequest } from "../middleware/auth";
import { requirePermission, requireAnyPermission } from "../lib/permissions";

export const cmsRouter = Router();

const BANNER_UI_TO_PRISMA: Record<string, BannerType> = {
  "Hero Slider": "HERO_SLIDER",
  "Category Banner": "CATEGORY_BANNER",
  "Collection Banner": "COLLECTION_BANNER",
  "League Banner": "LEAGUE_BANNER",
  "Popup Banner": "POPUP_BANNER",
  "Offer Banner": "OFFER_BANNER",
  "Newsletter Banner": "NEWSLETTER_BANNER",
  "Footer Banner": "FOOTER_BANNER",
  "Blog Banner": "BLOG_BANNER",
  "Mobile Banner": "MOBILE_BANNER",
  HERO_SLIDER: "HERO_SLIDER",
  CATEGORY_BANNER: "CATEGORY_BANNER",
  COLLECTION_BANNER: "COLLECTION_BANNER",
  LEAGUE_BANNER: "LEAGUE_BANNER",
  POPUP_BANNER: "POPUP_BANNER",
  OFFER_BANNER: "OFFER_BANNER",
  NEWSLETTER_BANNER: "NEWSLETTER_BANNER",
  FOOTER_BANNER: "FOOTER_BANNER",
  BLOG_BANNER: "BLOG_BANNER",
  MOBILE_BANNER: "MOBILE_BANNER",
};

const BANNER_PRISMA_TO_UI: Record<BannerType, string> = {
  HERO_SLIDER: "Hero Slider",
  CATEGORY_BANNER: "Category Banner",
  COLLECTION_BANNER: "Collection Banner",
  LEAGUE_BANNER: "League Banner",
  POPUP_BANNER: "Popup Banner",
  OFFER_BANNER: "Offer Banner",
  NEWSLETTER_BANNER: "Newsletter Banner",
  FOOTER_BANNER: "Footer Banner",
  BLOG_BANNER: "Blog Banner",
  MOBILE_BANNER: "Mobile Banner",
};

function mapPublishStatus(raw?: string): PublishStatus {
  const s = String(raw || "DRAFT").trim().toUpperCase();
  if (s === "ACTIVE" || s === "LIVE" || s === "PUBLISHED") return "ACTIVE";
  if (s === "INACTIVE" || s === "DISABLED" || s === "OFF" || s === "HIDDEN") return "INACTIVE";
  return "DRAFT";
}

function publishToUi(s: PublishStatus): "Active" | "Inactive" | "Draft" {
  if (s === "ACTIVE") return "Active";
  if (s === "INACTIVE") return "Inactive";
  return "Draft";
}

function toSpaBanner(b: any) {
  const meta = (b.meta && typeof b.meta === "object" ? b.meta : {}) as Record<string, unknown>;
  return {
    id: b.id,
    name: b.name ?? undefined,
    type: BANNER_PRISMA_TO_UI[b.type as BannerType] || b.type,
    desktopImage: b.desktopImage,
    tabletImage: b.tabletImage,
    mobileImage: b.mobileImage,
    image: b.desktopImage,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    cta: b.cta,
    ctaText: b.cta,
    buttonUrl: b.buttonUrl,
    productId: b.productId ?? undefined,
    openNewTab: b.openNewTab,
    scheduleStart: b.scheduleStart ? b.scheduleStart.toISOString().slice(0, 10) : "",
    scheduleEnd: b.scheduleEnd ? b.scheduleEnd.toISOString().slice(0, 10) : "",
    status: publishToUi(b.status),
    sortOrder: b.sortOrder,
    badge: typeof meta.badge === "string" ? meta.badge : undefined,
    primaryColor: typeof meta.primaryColor === "string" ? meta.primaryColor : undefined,
  };
}

function toSpaCarouselSlide(b: any) {
  const meta = (b.meta && typeof b.meta === "object" ? b.meta : {}) as Record<string, unknown>;
  return {
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    badge: (meta.badge as string) || b.cta || "FEATURED",
    primaryColor: (meta.primaryColor as string) || "#064e3b",
    productId: b.productId || "",
    customImage: b.desktopImage || undefined,
  };
}

function mapSectionStatus(raw?: string): PageSectionStatus {
  const s = String(raw || "ACTIVE").toUpperCase();
  if (s === "DRAFT") return "DRAFT";
  if (s === "INACTIVE") return "INACTIVE";
  return "ACTIVE";
}

function sectionStatusToUi(s: PageSectionStatus): "active" | "draft" | "inactive" {
  if (s === "DRAFT") return "draft";
  if (s === "INACTIVE") return "inactive";
  return "active";
}

function toSpaHomepageSection(s: {
  id: string;
  sectionKey: string;
  name: string;
  visible: boolean;
  bgColor: string;
  padding: string;
  margin: string;
  imageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  animation: string | null;
  status: PageSectionStatus;
  meta: unknown;
}) {
  const meta = (s.meta && typeof s.meta === "object" ? s.meta : {}) as Record<string, unknown>;
  return {
    id: s.sectionKey || s.id,
    name: s.name,
    visible: s.visible,
    bgColor: s.bgColor,
    padding: s.padding,
    margin: s.margin,
    image: s.imageUrl ?? undefined,
    title: s.title ?? undefined,
    subtitle: s.subtitle ?? undefined,
    buttonText: s.buttonText ?? undefined,
    buttonUrl: s.buttonUrl ?? undefined,
    animation: (s.animation || "none") as "none" | "fadeIn" | "slideUp" | "bounce" | "pulse",
    status: sectionStatusToUi(s.status),
    sectionType: meta.sectionType as "product-row" | "content" | "special" | undefined,
    productCategory: typeof meta.productCategory === "string" ? meta.productCategory : undefined,
    selectedProductIds: Array.isArray(meta.selectedProductIds)
      ? (meta.selectedProductIds as string[])
      : undefined,
    productSelectionMode:
      meta.productSelectionMode === "manual" || meta.productSelectionMode === "category"
        ? meta.productSelectionMode
        : undefined,
    maxProducts: typeof meta.maxProducts === "number" ? meta.maxProducts : undefined,
  };
}

/** Keep first occurrence of each sectionKey (homepage rows can race-duplicate on save). */
function isDailyDealSectionLive(section: { visible?: boolean; status?: string } | null | undefined): boolean {
  if (!section) return false;
  const st = String(section.status || "active").toLowerCase();
  return section.visible === true && st !== "inactive" && st !== "draft";
}

function applyDailyDealVisibilityToSections<T extends { id?: string; visible?: boolean; status?: string }>(
  sections: T[],
  enabled: boolean,
): T[] {
  return sections.map((s) =>
    s.id === "daily-deals"
      ? {
          ...s,
          visible: enabled,
          status: enabled ? "active" : "inactive",
        }
      : s,
  );
}

function dedupeHomepageRows<T extends { id?: string; sectionKey?: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = row.sectionKey || row.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function cleanupDuplicateHomepageSections<T extends { id: string; sectionKey: string }>(
  rows: T[],
): Promise<T[]> {
  const seen = new Set<string>();
  const keep: T[] = [];
  const dropIds: string[] = [];
  for (const row of rows) {
    if (seen.has(row.sectionKey)) {
      dropIds.push(row.id);
    } else {
      seen.add(row.sectionKey);
      keep.push(row);
    }
  }
  if (dropIds.length > 0) {
    void prisma.pageSection
      .deleteMany({ where: { id: { in: dropIds } } })
      .catch((err) => console.error("[cms] homepage section dedupe cleanup failed", err));
  }
  return keep;
}

const homepageSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  visible: z.boolean().optional(),
  bgColor: z.string().optional(),
  padding: z.string().optional(),
  margin: z.string().optional(),
  image: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  buttonText: z.string().optional(),
  buttonUrl: z.string().optional(),
  animation: z.string().optional(),
  status: z.string().optional(),
  sectionType: z.string().optional(),
  productCategory: z.string().optional(),
  selectedProductIds: z.array(z.string()).optional(),
  productSelectionMode: z.enum(["manual", "category"]).optional(),
  maxProducts: z.number().int().optional(),
});

function toSpaPage(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    isCustom: p.isCustom,
    visible: p.visible,
    sections: (p.sections || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      visible: s.visible,
      bgColor: s.bgColor,
      padding: s.padding,
      margin: s.margin,
      image: s.imageUrl ?? undefined,
      title: s.title ?? undefined,
      subtitle: s.subtitle ?? undefined,
      buttonText: s.buttonText ?? undefined,
      buttonUrl: s.buttonUrl ?? undefined,
      animation: s.animation || "none",
      status: String(s.status || "ACTIVE").toLowerCase(),
    })),
  };
}

cmsRouter.get("/homepage", async (_req, res) => {
  try {
    // One banners query — derive active hero slides in memory (was a duplicate Neon round-trip)
    const [banners, rawSections, settings, leagues, locations, pages] = await Promise.all([
      prisma.banner.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.pageSection.findMany({
        where: { isHomepage: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.storeSettings.findUnique({ where: { id: "default" } }),
      prisma.league.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          status: true,
          categoryId: true,
        },
      }),
      prisma.storeLocation.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.cmsPage.findMany({
        include: { sections: { orderBy: { sortOrder: "asc" } } },
        orderBy: { name: "asc" },
      }),
    ]);

    // Concurrent homepage saves can leave every sectionKey twice — keep first, delete extras.
    const sections = await cleanupDuplicateHomepageSections(rawSections);

    const heroSlides = banners.filter((b) => b.type === "HERO_SLIDER" && b.status === "ACTIVE");

    const normalizedSettings = settings
      ? {
          ...settings,
          bkashPaymentMode:
            settings.bkashPaymentMode === "partial"
              ? "partial"
              : "both",
          dailyDealEnabled:
            typeof settings.dailyDealEnabled === "boolean"
              ? settings.dailyDealEnabled
              : isDailyDealSectionLive(
                  sections.find((s) => s.sectionKey === "daily-deals"),
                ),
          dailyDealItems: Array.isArray(settings.dailyDealItems)
            ? settings.dailyDealItems
            : [],
          dailyDealEndsAt: settings.dailyDealEndsAt
            ? new Date(settings.dailyDealEndsAt).toISOString()
            : null,
          tournamentPatches: Array.isArray(
            (settings as { tournamentPatches?: unknown }).tournamentPatches,
          )
            ? ((settings as { tournamentPatches: unknown[] }).tournamentPatches || [])
                .map((entry, index) => {
                  if (!entry || typeof entry !== "object") return null;
                  const row = entry as Record<string, unknown>;
                  const label = String(row.label || "").trim();
                  if (!label) return null;
                  const image = String(row.image || row.imageUrl || "").trim();
                  return {
                    id: String(row.id || `patch-${index + 1}`),
                    label,
                    priceBdt: Math.max(0, Math.round(Number(row.priceBdt) || 0)),
                    ...(image ? { image } : {}),
                  };
                })
                .filter(Boolean)
            : settings
              ? []
              : undefined,
          clubShowcase: Array.isArray((settings as { clubShowcase?: unknown }).clubShowcase)
            ? (settings as { clubShowcase: unknown[] }).clubShowcase
            : undefined,
        }
      : null;

    const homepageSectionsOut = applyDailyDealVisibilityToSections(
      sections.map(toSpaHomepageSection).filter((s) => s.id !== "popular-teams"),
      normalizedSettings?.dailyDealEnabled === true,
    );

    return res.json({
      success: true,
      data: {
        banners: banners.map(toSpaBanner),
        sections,
        homepageSections: homepageSectionsOut,
        settings: normalizedSettings,
        leagues,
        locations,
        pages: pages.map(toSpaPage),
        slides: heroSlides.map(toSpaCarouselSlide),
      },
    });
  } catch (error) {
    console.error("[GET /cms/homepage]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to load CMS" } });
  }
});

cmsRouter.put("/homepage-sections", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const parsed = z.array(homepageSectionSchema).parse(req.body.sections || []);
    const sections = dedupeHomepageRows(parsed);
    const categoryItems = req.body.categoryItems;

    // Neon + pgbouncer: interactive txs die (P2028) when we await many round-trips.
    // One deleteMany + one createMany keeps the transaction short.
    // Advisory lock prevents concurrent saves from doubling every sectionKey.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(87201402)`;
        await tx.pageSection.deleteMany({ where: { isHomepage: true } });
        if (sections.length > 0) {
          await tx.pageSection.createMany({
            data: sections.map((s, i) => ({
              sectionKey: s.id,
              name: s.name,
              visible: s.visible ?? true,
              bgColor: s.bgColor || "bg-white",
              padding: s.padding || "py-12",
              margin: s.margin || "my-0",
              imageUrl: s.image || null,
              title: s.title || null,
              subtitle: s.subtitle || null,
              buttonText: s.buttonText || null,
              buttonUrl: s.buttonUrl || null,
              animation: s.animation || "none",
              status: mapSectionStatus(s.status),
              sortOrder: i,
              isHomepage: true,
              meta: {
                sectionType: s.sectionType,
                productCategory: s.productCategory,
                selectedProductIds: s.selectedProductIds || [],
                productSelectionMode: s.productSelectionMode,
                maxProducts: s.maxProducts,
              },
            })),
          });
        }

        const dailyDealsSection = sections.find((s) => s.id === "daily-deals");
        if (dailyDealsSection) {
          await tx.storeSettings.upsert({
            where: { id: "default" },
            update: { dailyDealEnabled: isDailyDealSectionLive(dailyDealsSection) },
            create: {
              id: "default",
              footerAbout: "",
              footerCopyright: `© ${new Date().getFullYear()} Epic Vanskap`,
              dailyDealEnabled: isDailyDealSectionLive(dailyDealsSection),
            },
          });
        }

        if (categoryItems !== undefined) {
          await tx.storeSettings.upsert({
            where: { id: "default" },
            update: { categoryItems },
            create: {
              id: "default",
              footerAbout: "",
              footerCopyright: `© ${new Date().getFullYear()} Epic Vanskap`,
              categoryItems,
            },
          });
        }
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    const saved = await prisma.pageSection.findMany({
      where: { isHomepage: true },
      orderBy: { sortOrder: "asc" },
    });
    return res.json({
      success: true,
      data: { homepageSections: dedupeHomepageRows(saved.map(toSpaHomepageSection)) },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid homepage sections" },
      });
    }
    console.error("[PUT /cms/homepage-sections]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to save homepage sections" },
    });
  }
});

cmsRouter.put("/settings", requirePermission("can_manage_system_settings"), async (req: AuthedRequest, res) => {
  try {
    const settingsSchema = z
      .object({
        logoText: z.string().optional(),
        logoSubtext: z.string().optional().nullable(),
        theme: z.string().optional(),
        footerAbout: z.string().optional(),
        footerCopyright: z.string().optional(),
        currencySymbol: z.string().optional(),
        currencyCode: z.string().optional(),
        exchangeRate: z.coerce.number().optional(),
        timerTeam1: z.string().optional().nullable(),
        timerTeam1Emoji: z.string().optional().nullable(),
        timerTeam2: z.string().optional().nullable(),
        timerTeam2Emoji: z.string().optional().nullable(),
        timerLabel: z.string().optional().nullable(),
        timerTargetHours: z.number().int().optional().nullable(),
        timerEnabled: z.boolean().optional(),
        dailyDealProductId: z.string().optional().nullable(),
        dailyDealEnabled: z.boolean().optional(),
        dailyDealEndsAt: z.union([z.string().min(1), z.null()]).optional(),
        dailyDealItems: z
          .array(
            z.object({
              productId: z.string().min(1),
              dealPrice: z.coerce.number().min(0),
              compareAtPrice: z.union([z.coerce.number().min(0), z.null()]).optional(),
              isHotDeal: z.boolean().optional(),
              stockLeft: z.union([z.coerce.number().int().min(0), z.null()]).optional(),
              claimedPercent: z
                .union([z.coerce.number().int().min(0).max(100), z.null()])
                .optional(),
              sortOrder: z.coerce.number().int().optional(),
            }),
          )
          .optional()
          .nullable(),
        announcementText: z.string().optional().nullable(),
        announcementSpeed: z.number().int().optional().nullable(),
        vatPercent: z.coerce.number().optional(),
        deliveryInside: z.coerce.number().optional(),
        deliveryOutside: z.coerce.number().optional(),
        bkashPersonalNumber: z.string().optional(),
        bkashEnabled: z.boolean().optional(),
        bkashPaymentMode: z.enum(['full', 'partial', 'both']).optional(),
        bkashPartialAmountBdt: z.coerce.number().int().min(1).optional(),
        categoryItems: z.any().optional(),
        menuItems: z.any().optional(),
        footerLocations: z.any().optional(),
        tournamentPatches: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              priceBdt: z.coerce.number().int().nonnegative(),
              image: z.string().optional(),
            }),
          )
          .optional()
          .nullable(),
        clubShowcase: z
          .array(
            z.object({
              id: z.string().min(1),
              name: z.string().min(1),
              categoryId: z.string().optional(),
              searchQuery: z.string().optional(),
              count: z.coerce.number().int().nonnegative().optional(),
              logoUrl: z.string().optional(),
              status: z.enum(["Active", "Inactive"]).optional(),
            }),
          )
          .optional()
          .nullable(),
        customSizeCharts: z.any().optional().nullable(),
      })
      .strict();
    const body = settingsSchema.parse(req.body || {});

    const updateData: Record<string, unknown> = { ...body };

    if (body.tournamentPatches !== undefined) {
      const items = Array.isArray(body.tournamentPatches) ? body.tournamentPatches : [];
      updateData.tournamentPatches = items.map((item, index) => ({
        id: item.id || `patch-${index + 1}`,
        label: String(item.label || "").trim(),
        priceBdt: Math.max(0, Math.round(Number(item.priceBdt) || 0)),
        ...(item.image?.trim() ? { image: item.image.trim() } : {}),
      })).filter((item) => item.label);
    }

    if (body.clubShowcase !== undefined) {
      const items = Array.isArray(body.clubShowcase) ? body.clubShowcase : [];
      updateData.clubShowcase = items
        .map((item, index) => ({
          id: String(item.id || `club-${index + 1}`).trim() || `club-${index + 1}`,
          name: String(item.name || "").trim(),
          categoryId: String(item.categoryId || item.name || "").trim(),
          searchQuery: String(item.searchQuery || item.name || "").trim(),
          count: Math.max(0, Math.round(Number(item.count) || 0)),
          logoUrl: String(item.logoUrl || "").trim(),
          status: item.status === "Inactive" ? "Inactive" : "Active",
        }))
        .filter((item) => item.name);
    }

    if (body.customSizeCharts !== undefined) {
      const items = Array.isArray(body.customSizeCharts) ? body.customSizeCharts : [];
      updateData.customSizeCharts = items;
    }

    if (body.dailyDealItems !== undefined) {
      const items = Array.isArray(body.dailyDealItems) ? body.dailyDealItems : [];
      const normalized = items.map((item, index) => ({
        productId: item.productId,
        dealPrice: Math.round(Number(item.dealPrice) || 0),
        compareAtPrice:
          item.compareAtPrice == null || item.compareAtPrice === undefined
            ? null
            : Math.round(Number(item.compareAtPrice) || 0),
        isHotDeal: item.isHotDeal === true,
        stockLeft:
          item.stockLeft == null || item.stockLeft === undefined
            ? null
            : Math.max(0, Math.round(Number(item.stockLeft) || 0)),
        claimedPercent:
          item.claimedPercent == null || item.claimedPercent === undefined
            ? null
            : Math.min(100, Math.max(0, Math.round(Number(item.claimedPercent) || 0))),
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
      }));
      updateData.dailyDealItems = normalized;
      // Keep legacy single-id field in sync with the first deal
      if (body.dailyDealProductId === undefined) {
        updateData.dailyDealProductId = normalized[0]?.productId ?? null;
      }
    }

    if (body.dailyDealEndsAt !== undefined) {
      updateData.dailyDealEndsAt =
        body.dailyDealEndsAt === null ? null : new Date(body.dailyDealEndsAt);
    }

    const settings = await prisma.storeSettings.upsert({
      where: { id: "default" },
      update: updateData,
      create: {
        id: "default",
        logoText: body.logoText || "Epic Vanskap",
        footerAbout: body.footerAbout || "",
        footerCopyright:
          body.footerCopyright || `© ${new Date().getFullYear()} Epic Vanskap`,
        ...updateData,
      } as Parameters<typeof prisma.storeSettings.create>[0]["data"],
    });
    return res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid settings payload" },
      });
    }
    console.error("[PUT /cms/settings]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to save settings" } });
  }
});

const tournamentPatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(120),
  priceBdt: z.coerce.number().int().nonnegative(),
  image: z.string().max(4000).optional().nullable(),
});

/** Inventory Tournament Patch catalog — Admin / Inventory Manager can publish (not only Super Admin). */
cmsRouter.put(
  "/tournament-patches",
  requireAnyPermission(
    "can_manage_products",
    "can_manage_content",
    "can_manage_system_settings",
  ),
  async (req: AuthedRequest, res) => {
    try {
      const body = z
        .object({
          tournamentPatches: z.array(tournamentPatchSchema).min(1),
        })
        .parse(req.body || {});

      const tournamentPatches = body.tournamentPatches
        .map((item, index) => ({
          id: item.id || `patch-${index + 1}`,
          label: String(item.label || "").trim(),
          priceBdt: Math.max(0, Math.round(Number(item.priceBdt) || 0)),
          ...(item.image && String(item.image).trim()
            ? { image: String(item.image).trim() }
            : {}),
        }))
        .filter((item) => item.label.length > 0);

      if (tournamentPatches.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: "Add at least one patch with a name." },
        });
      }

      const settings = await prisma.storeSettings.upsert({
        where: { id: "default" },
        update: { tournamentPatches },
        create: {
          id: "default",
          logoText: "Epic Vanskap",
          footerAbout: "",
          footerCopyright: `© ${new Date().getFullYear()} Epic Vanskap`,
          tournamentPatches,
        },
      });

      // Keep product-level badgeOptions in sync so every jersey (and POS/orders) sees the same images
      await prisma.product.updateMany({
        where: { deletedAt: null },
        data: { badgeOptions: tournamentPatches },
      });

      return res.json({
        success: true,
        data: {
          tournamentPatches: settings.tournamentPatches ?? tournamentPatches,
          syncedProducts: true,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: { message: error.issues[0]?.message || "Invalid patch catalog" },
        });
      }
      console.error("[PUT /cms/tournament-patches]", error);
      return res.status(400).json({
        success: false,
        error: { message: "Failed to publish tournament patches" },
      });
    }
  },
);

// ---------- Banners ----------
cmsRouter.get("/banners", requirePermission("can_manage_content"), async (_req, res) => {
  try {
    const rows = await prisma.banner.findMany({ orderBy: [{ type: "asc" }, { sortOrder: "asc" }] });
    return res.json({ success: true, data: { items: rows.map(toSpaBanner) } });
  } catch (error) {
    console.error("[GET /cms/banners]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list banners" } });
  }
});

const bannerSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.string(),
  desktopImage: z.string().min(1),
  tabletImage: z.string().optional(),
  mobileImage: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  cta: z.string().optional(),
  buttonUrl: z.string().optional(),
  productId: z.string().nullable().optional(),
  openNewTab: z.boolean().optional(),
  scheduleStart: z.string().optional().nullable(),
  scheduleEnd: z.string().optional().nullable(),
  status: z.string().optional(),
  sortOrder: z.number().int().optional(),
  badge: z.string().optional(),
  primaryColor: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

cmsRouter.post("/banners", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const body = bannerSchema.parse(req.body);
    const type = BANNER_UI_TO_PRISMA[body.type] || "HERO_SLIDER";
    const meta = {
      ...(body.meta || {}),
      ...(body.badge != null ? { badge: body.badge } : {}),
      ...(body.primaryColor != null ? { primaryColor: body.primaryColor } : {}),
    };
    const data = {
      name: body.name,
      type,
      desktopImage: body.desktopImage,
      tabletImage: body.tabletImage || body.desktopImage,
      mobileImage: body.mobileImage || body.desktopImage,
      title: body.title ?? "",
      subtitle: body.subtitle ?? "",
      description: body.description ?? "",
      cta: body.cta ?? "",
      buttonUrl: body.buttonUrl ?? "",
      productId: body.productId || null,
      openNewTab: body.openNewTab ?? false,
      scheduleStart: body.scheduleStart ? new Date(body.scheduleStart) : null,
      scheduleEnd: body.scheduleEnd ? new Date(body.scheduleEnd) : null,
      status: mapPublishStatus(body.status),
      sortOrder: body.sortOrder ?? 0,
      meta,
    };

    // Upsert when client sends a stable SPA id — avoids Unique constraint on re-sync / race
    const bannerId = body.id?.trim();
    if (bannerId) {
      const saved = await prisma.banner.upsert({
        where: { id: bannerId },
        create: { id: bannerId, ...data },
        update: data,
      });
      return res.status(200).json({ success: true, data: toSpaBanner(saved) });
    }

    const created = await prisma.banner.create({ data });
    return res.status(201).json({ success: true, data: toSpaBanner(created) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { message: error.issues[0]?.message || "Invalid banner" },
      });
    }
    console.error("[POST /cms/banners]", error);
    return res.status(400).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : "Failed to create banner",
      },
    });
  }
});

cmsRouter.put("/banners/reorder", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const ids = z.array(z.string()).parse(req.body.ids || []);
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.banner.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return res.json({ success: true, data: { reordered: ids.length } });
  } catch (error) {
    console.error("[PUT /cms/banners/reorder]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to reorder" } });
  }
});

cmsRouter.put("/banners/:id", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const body = bannerSchema.partial().parse(req.body);
    const existing = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { message: "Banner not found" } });
    }
    const prevMeta =
      existing.meta && typeof existing.meta === "object"
        ? (existing.meta as Record<string, unknown>)
        : {};
    const meta = {
      ...prevMeta,
      ...(body.meta || {}),
      ...(body.badge != null ? { badge: body.badge } : {}),
      ...(body.primaryColor != null ? { primaryColor: body.primaryColor } : {}),
    };
    const updated = await prisma.banner.update({
      where: { id: req.params.id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.type != null
          ? { type: BANNER_UI_TO_PRISMA[body.type] || existing.type }
          : {}),
        ...(body.desktopImage != null ? { desktopImage: body.desktopImage } : {}),
        ...(body.tabletImage != null
          ? { tabletImage: body.tabletImage }
          : body.desktopImage
            ? { tabletImage: body.desktopImage }
            : {}),
        ...(body.mobileImage != null
          ? { mobileImage: body.mobileImage }
          : body.desktopImage
            ? { mobileImage: body.desktopImage }
            : {}),
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.subtitle != null ? { subtitle: body.subtitle } : {}),
        ...(body.description != null ? { description: body.description } : {}),
        ...(body.cta != null ? { cta: body.cta } : {}),
        ...(body.buttonUrl != null ? { buttonUrl: body.buttonUrl } : {}),
        ...(body.productId !== undefined ? { productId: body.productId || null } : {}),
        ...(body.openNewTab != null ? { openNewTab: body.openNewTab } : {}),
        ...(body.scheduleStart !== undefined
          ? { scheduleStart: body.scheduleStart ? new Date(body.scheduleStart) : null }
          : {}),
        ...(body.scheduleEnd !== undefined
          ? { scheduleEnd: body.scheduleEnd ? new Date(body.scheduleEnd) : null }
          : {}),
        ...(body.status != null ? { status: mapPublishStatus(body.status) } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
        meta,
      },
    });
    return res.json({ success: true, data: toSpaBanner(updated) });
  } catch (error) {
    console.error("[PUT /cms/banners/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update banner" } });
  }
});

cmsRouter.delete("/banners/:id", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    await prisma.banner.delete({ where: { id: req.params.id } });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("[DELETE /cms/banners/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to delete banner" } });
  }
});

// ---------- Carousel slides (HERO_SLIDER convenience) ----------
cmsRouter.put("/carousel", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const slides = z
      .array(
        z.object({
          id: z.string().optional(),
          title: z.string(),
          subtitle: z.string().optional(),
          description: z.string().optional(),
          badge: z.string().optional(),
          primaryColor: z.string().optional(),
          productId: z.string().optional(),
          customImage: z.string().optional(),
        }),
      )
      .parse(req.body.slides || []);

    // Empty carousel → turn hero banners OFF (keep rows so Banner Management still works)
    if (slides.length === 0) {
      await prisma.banner.updateMany({
        where: { type: "HERO_SLIDER" },
        data: { status: "INACTIVE" },
      });
      return res.json({ success: true, data: { slides: [] } });
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.banner.findMany({
        where: { type: "HERO_SLIDER" },
        orderBy: { sortOrder: "asc" },
      });
      const keepIds = new Set<string>();

      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        const img =
          s.customImage ||
          "https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1600";
        const preferredId =
          s.id && !String(s.id).startsWith("slide-") ? s.id : existing[i]?.id || `banner-hero-${i + 1}`;
        keepIds.add(preferredId);

        await tx.banner.upsert({
          where: { id: preferredId },
          create: {
            id: preferredId,
            type: "HERO_SLIDER",
            name: `Hero ${i + 1}`,
            desktopImage: img,
            tabletImage: img,
            mobileImage: img,
            title: s.title,
            subtitle: s.subtitle || "",
            description: s.description || "",
            cta: s.badge || "SHOP NOW",
            buttonUrl: s.productId ? `product:${s.productId}` : "listing",
            productId: s.productId || null,
            status: "ACTIVE",
            sortOrder: i,
            meta: { badge: s.badge || "FEATURED", primaryColor: s.primaryColor || "#064e3b" },
          },
          update: {
            name: `Hero ${i + 1}`,
            desktopImage: img,
            tabletImage: img,
            mobileImage: img,
            title: s.title,
            subtitle: s.subtitle || "",
            description: s.description || "",
            cta: s.badge || "SHOP NOW",
            buttonUrl: s.productId ? `product:${s.productId}` : "listing",
            productId: s.productId || null,
            status: "ACTIVE",
            sortOrder: i,
            meta: { badge: s.badge || "FEATURED", primaryColor: s.primaryColor || "#064e3b" },
          },
        });
      }

      // Heroes not in the new carousel → Inactive (do not hard-delete)
      for (const row of existing) {
        if (!keepIds.has(row.id)) {
          await tx.banner.update({
            where: { id: row.id },
            data: { status: "INACTIVE" },
          });
        }
      }
    });

    const hero = await prisma.banner.findMany({
      where: { type: "HERO_SLIDER", status: "ACTIVE" },
      orderBy: { sortOrder: "asc" },
    });
    return res.json({ success: true, data: { slides: hero.map(toSpaCarouselSlide) } });
  } catch (error) {
    console.error("[PUT /cms/carousel]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to save carousel" },
    });
  }
});

// ---------- CMS Pages ----------
cmsRouter.get("/pages", requirePermission("can_manage_content"), async (_req, res) => {
  try {
    const pages = await prisma.cmsPage.findMany({
      include: { sections: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, data: { items: pages.map(toSpaPage) } });
  } catch (error) {
    console.error("[GET /cms/pages]", error);
    return res.status(500).json({ success: false, error: { message: "Failed to list pages" } });
  }
});

const pageSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  isCustom: z.boolean().optional(),
  visible: z.boolean().optional(),
  sections: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string(),
        visible: z.boolean().optional(),
        bgColor: z.string().optional(),
        padding: z.string().optional(),
        margin: z.string().optional(),
        image: z.string().optional(),
        title: z.string().optional(),
        subtitle: z.string().optional(),
        buttonText: z.string().optional(),
        buttonUrl: z.string().optional(),
        animation: z.string().optional(),
        status: z.string().optional(),
      }),
    )
    .optional(),
});

cmsRouter.post("/pages", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const body = pageSchema.parse(req.body);
    const created = await prisma.cmsPage.create({
      data: {
        id: body.id,
        name: body.name,
        slug: body.slug,
        isCustom: body.isCustom ?? true,
        visible: body.visible ?? true,
        sections: body.sections?.length
          ? {
              create: body.sections.map((s, i) => ({
                id: s.id,
                sectionKey: s.name.toLowerCase().replace(/\s+/g, "-"),
                name: s.name,
                visible: s.visible ?? true,
                bgColor: s.bgColor || "bg-white",
                padding: s.padding || "py-12",
                margin: s.margin || "my-0",
                imageUrl: s.image,
                title: s.title,
                subtitle: s.subtitle,
                buttonText: s.buttonText,
                buttonUrl: s.buttonUrl,
                animation: s.animation || "none",
                status: "ACTIVE",
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
    return res.status(201).json({ success: true, data: toSpaPage(created) });
  } catch (error) {
    console.error("[POST /cms/pages]", error);
    return res.status(400).json({
      success: false,
      error: { message: error instanceof Error ? error.message : "Failed to create page" },
    });
  }
});

cmsRouter.put("/pages/:id", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    const body = pageSchema.partial().extend({ name: z.string().min(1).optional() }).parse(req.body);
    await prisma.$transaction(async (tx) => {
      await tx.cmsPage.update({
        where: { id: req.params.id },
        data: {
          ...(body.name != null ? { name: body.name } : {}),
          ...(body.slug != null ? { slug: body.slug } : {}),
          ...(body.isCustom != null ? { isCustom: body.isCustom } : {}),
          ...(body.visible != null ? { visible: body.visible } : {}),
        },
      });
      if (body.sections) {
        await tx.pageSection.deleteMany({ where: { pageId: req.params.id } });
        for (let i = 0; i < body.sections.length; i++) {
          const s = body.sections[i];
          await tx.pageSection.create({
            data: {
              pageId: req.params.id,
              sectionKey: s.name.toLowerCase().replace(/\s+/g, "-"),
              name: s.name,
              visible: s.visible ?? true,
              bgColor: s.bgColor || "bg-white",
              padding: s.padding || "py-12",
              margin: s.margin || "my-0",
              imageUrl: s.image,
              title: s.title,
              subtitle: s.subtitle,
              buttonText: s.buttonText,
              buttonUrl: s.buttonUrl,
              animation: s.animation || "none",
              status: "ACTIVE",
              sortOrder: i,
            },
          });
        }
      }
    });
    const page = await prisma.cmsPage.findUnique({
      where: { id: req.params.id },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    });
    return res.json({ success: true, data: toSpaPage(page) });
  } catch (error) {
    console.error("[PUT /cms/pages/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to update page" } });
  }
});

cmsRouter.delete("/pages/:id", requirePermission("can_manage_content"), async (req: AuthedRequest, res) => {
  try {
    await prisma.cmsPage.delete({ where: { id: req.params.id } });
    return res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    console.error("[DELETE /cms/pages/:id]", error);
    return res.status(400).json({ success: false, error: { message: "Failed to delete page" } });
  }
});
