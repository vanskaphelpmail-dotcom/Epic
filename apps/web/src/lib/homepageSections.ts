import { PageSection, Product, CategoryItem } from '../types';
import { resolveStorefrontPage, storefrontLabelsMatch } from './storefrontPages';
import { getProductCategories } from './sizeCharts';

/** Sections permanently removed from the live storefront (still may exist in old DB rows). */
export const REMOVED_HOMEPAGE_SECTION_IDS = new Set([
  'latest-products',
  'mystery-box',
  'instagram-feed',
  'video-banner',
  'worldcup-collection',
  'live-auction',
  'popular-teams',
  'shop-by-legends',
  'shop-by-league',
  'shop-by-club',
  'shop-by-international-team',
  'newsletter',
  'community-gallery',
]);

/** Ensure All Jerseys row exists so the homepage always lists the full catalog. */
export function ensureAllJerseysSection(sections: PageSection[]): PageSection[] {
  const existing = sections.find((s) => s.id === 'all-jerseys');
  const row: PageSection = {
    id: 'all-jerseys',
    name: 'All Jerseys Row',
    visible: true,
    bgColor: 'bg-transparent',
    padding: 'py-12',
    margin: 'my-0',
    title: 'ALL JERSEYS',
    subtitle: 'Complete storefront catalog — every kit in stock',
    status: 'active',
    sectionType: 'product-row',
    productCategory: 'All',
    productSelectionMode: 'category',
    buttonText: 'VIEW ALL',
    buttonUrl: 'listing',
    maxProducts: Math.max(500, existing?.maxProducts ?? 500),
  };
  if (existing) {
    return sections.map((s) =>
      s.id === 'all-jerseys'
        ? {
            ...row,
            ...existing,
            id: 'all-jerseys',
            visible: true,
            status: 'active',
            sectionType: 'product-row',
            productCategory: existing.productCategory || 'All',
            maxProducts: Math.max(500, existing.maxProducts ?? 500),
            title: existing.title || row.title,
            subtitle: existing.subtitle || row.subtitle,
          }
        : s,
    );
  }
  const afterFeatured = sections.findIndex((s) => s.id === 'featured-collection');
  if (afterFeatured >= 0) {
    return [...sections.slice(0, afterFeatured + 1), row, ...sections.slice(afterFeatured + 1)];
  }
  return [row, ...sections];
}

export function normalizeHomepageSections(sections: PageSection[]): PageSection[] {
  const seen = new Set<string>();
  const filtered = sections.filter((s) => {
    if (!s?.id || REMOVED_HOMEPAGE_SECTION_IDS.has(s.id)) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  const darkened = filtered.map((s) => ({
    ...s,
    // Storefront is light — never keep dark CMS section paints
    bgColor: 'bg-transparent',
  }));
  return ensureCatalogSectionAtBottom(
    ensureAllJerseysSection(ensureJerseyHomepageOrder(darkened)),
  );
}

const RETRO_SECTION: PageSection = {
  id: 'retro-collection',
  name: 'Retro Collection Row',
  visible: true,
  bgColor: 'bg-transparent',
  padding: 'py-12',
  margin: 'my-0',
  title: 'RETRO',
  subtitle: 'Rare 80s, 90s & 2000s vintage reissues',
  status: 'active',
  sectionType: 'product-row',
  productCategory: 'Retro',
  buttonText: 'VIEW ALL',
  buttonUrl: 'listing',
  maxProducts: 4,
};

const LA_LIGA_SECTION: PageSection = {
  id: 'product-row-la-liga',
  name: 'La Liga Row',
  visible: true,
  bgColor: 'bg-transparent',
  padding: 'py-12',
  margin: 'my-0',
  title: 'LA LIGA',
  subtitle: 'Shop La Liga — curated picks for collectors',
  status: 'active',
  sectionType: 'product-row',
  productCategory: 'La Liga',
  productSelectionMode: 'category',
  buttonText: 'VIEW ALL',
  buttonUrl: 'listing',
  maxProducts: 4,
};

const WORLD_CUP_SECTION: PageSection = {
  id: 'product-row-world-cup',
  name: 'World Cup Row',
  visible: true,
  bgColor: 'bg-transparent',
  padding: 'py-12',
  margin: 'my-0',
  title: 'WORLD CUP',
  subtitle: 'National team World Cup kits & vault classics',
  status: 'active',
  sectionType: 'product-row',
  productCategory: 'World Cup',
  productSelectionMode: 'category',
  buttonText: 'VIEW ALL',
  buttonUrl: 'listing',
  maxProducts: 4,
};

const PLAYER_EDITION_SECTION: PageSection = {
  id: 'player-edition',
  name: 'Player Edition Row',
  visible: true,
  bgColor: 'bg-transparent',
  padding: 'py-12',
  margin: 'my-0',
  title: 'PLAYER EDITION',
  subtitle: 'Slim-fit match issue quality kits',
  status: 'active',
  sectionType: 'product-row',
  productCategory: 'Player Edition',
  buttonText: 'VIEW ALL',
  buttonUrl: 'listing',
  maxProducts: 4,
};

/** Canonical jersey browsing block order on the homepage. */
export const JERSEY_HOMEPAGE_SECTION_IDS = [
  'retro-collection',
  'product-row-la-liga',
  'product-row-world-cup',
  'player-edition',
] as const;

const JERSEY_SECTION_DEFAULTS: Record<string, PageSection> = {
  'retro-collection': RETRO_SECTION,
  'product-row-la-liga': LA_LIGA_SECTION,
  'product-row-world-cup': WORLD_CUP_SECTION,
  'player-edition': PLAYER_EDITION_SECTION,
};

function isLaLigaSection(s: PageSection): boolean {
  if (s.id === 'product-row-la-liga' || s.id === 'la-liga') return true;
  const cat = resolveSectionCategory(s) || '';
  return storefrontLabelsMatch(cat, 'La Liga') || /la\s*liga/i.test(s.title || s.name || '');
}

function isWorldCupProductRow(s: PageSection): boolean {
  if (s.id === 'product-row-world-cup' || s.id === 'world-cup-row') return true;
  if (s.id === 'worldcup-collection') return false;
  const cat = resolveSectionCategory(s) || '';
  return (
    storefrontLabelsMatch(cat, 'World Cup') ||
    storefrontLabelsMatch(cat, 'World Cup Vault') ||
    (/world\s*cup/i.test(s.title || s.name || '') && s.sectionType === 'product-row')
  );
}

function pickJerseySection(sections: PageSection[], id: string): PageSection {
  const fallback = JERSEY_SECTION_DEFAULTS[id];
  let existing: PageSection | undefined;
  if (id === 'product-row-la-liga') {
    existing = sections.find(isLaLigaSection);
  } else if (id === 'product-row-world-cup') {
    existing = sections.find(isWorldCupProductRow);
  } else {
    existing = sections.find((s) => s.id === id);
  }
  return {
    ...(fallback || {}),
    ...(existing || {}),
    id,
    name: existing?.name || fallback?.name || id,
    visible: true,
    status: 'active' as const,
    bgColor: existing?.bgColor || fallback?.bgColor || 'bg-black',
    padding: existing?.padding || fallback?.padding || 'py-12',
    margin: existing?.margin || fallback?.margin || 'my-0',
    title: fallback?.title || existing?.title,
    subtitle: fallback?.subtitle || existing?.subtitle,
    ...(fallback?.sectionType
      ? {
          sectionType: existing?.sectionType || fallback.sectionType,
          productCategory: existing?.productCategory || fallback.productCategory,
          maxProducts: Math.max(4, existing?.maxProducts ?? fallback.maxProducts ?? 4),
          buttonText: existing?.buttonText ?? fallback.buttonText,
          buttonUrl: existing?.buttonUrl || fallback.buttonUrl,
        }
      : {}),
  };
}

/**
 * Keep the main jersey sections in this fixed order after hero / trending / featured:
 * Retro → La Liga → World Cup → Player Edition
 */
export function ensureJerseyHomepageOrder(sections: PageSection[]): PageSection[] {
  const jerseyIds = new Set<string>(JERSEY_HOMEPAGE_SECTION_IDS);
  const jerseyBlock = JERSEY_HOMEPAGE_SECTION_IDS.map((id) => pickJerseySection(sections, id));

  const rest = sections.filter((s) => {
    if (jerseyIds.has(s.id)) return false;
    if (isLaLigaSection(s)) return false;
    if (isWorldCupProductRow(s)) return false;
    return true;
  });

  const anchorIds = ['featured-collection', 'daily-deals', 'trending-searches', 'hero-slider'];
  let insertAt = 0;
  // Insert after the last early anchor present (hero → trending → deals → featured)
  for (const anchor of [...anchorIds].reverse()) {
    const idx = rest.findIndex((s) => s.id === anchor);
    if (idx >= 0) {
      insertAt = idx + 1;
      break;
    }
  }

  return [...rest.slice(0, insertAt), ...jerseyBlock, ...rest.slice(insertAt)];
}

/** Catalog (legacy Clearance/Outlet) product row always sits near the page bottom. */
export function ensureCatalogSectionAtBottom(sections: PageSection[]): PageSection[] {
  const catalogIdx = sections.findIndex((s) => s.id === 'clearance');
  if (catalogIdx < 0) return sections;
  const catalog = {
    ...sections[catalogIdx],
    title: 'CATALOG',
    subtitle: sections[catalogIdx].subtitle?.includes('deadstock')
      ? 'Browse the full Catalog collection'
      : sections[catalogIdx].subtitle || 'Browse the full Catalog collection',
    buttonText: /outlet|explore/i.test(sections[catalogIdx].buttonText || '')
      ? 'VIEW CATALOG'
      : sections[catalogIdx].buttonText || 'VIEW CATALOG',
  };
  const without = sections.filter((_, i) => i !== catalogIdx);
  const endAnchor = without.findIndex(
    (s) => s.id === 'store-locations' || s.id === 'newsletter',
  );
  if (endAnchor >= 0) {
    return [...without.slice(0, endAnchor), catalog, ...without.slice(endAnchor)];
  }
  return [...without, catalog];
}

/** Products assigned to Catalog / Clearance / Outlet — only belong in the Catalog homepage row. */
export function isCatalogAssignedProduct(p: Product): boolean {
  if (p.isClearance) return true;
  const fields = [p.category, p.pageName, p.targetPage, ...(getProductCategories(p) || [])].filter(
    (v) => String(v || '').trim(),
  );
  return fields.some((v) => {
    const page = resolveStorefrontPage(String(v));
    if (page?.id === 'Clearance' || page?.slug === 'catalog') return true;
    const key = String(v).toLowerCase().trim();
    return (
      /^(clearance|outlet|catalog)$/.test(key) ||
      key === 'clearance vault' ||
      key === 'catalog collection'
    );
  });
}

/** @deprecated use ensureJerseyHomepageOrder */
export function ensureShopByLeagueAfterPlayerEdition(sections: PageSection[]): PageSection[] {
  return ensureJerseyHomepageOrder(sections);
}

/** @deprecated use ensureJerseyHomepageOrder */
export function ensureShopByClubBeforeLatestProducts(sections: PageSection[]): PageSection[] {
  return ensureJerseyHomepageOrder(sections);
}

/** @deprecated use ensureJerseyHomepageOrder */
export function ensureShopByInternationalTeamSection(sections: PageSection[]): PageSection[] {
  return ensureJerseyHomepageOrder(sections);
}

export const LEGACY_PRODUCT_CATEGORY: Record<string, string> = {
  'featured-collection': 'Featured',
  'player-edition': 'Player Edition',
  'retro-collection': 'Retro',
  'kids-collection': 'Kids',
  'customised-kit': 'Customised Kit',
  'fan-edition': 'Fan Edition',
  'preorder-jacket': 'Jacket',
  'preorder-track-suit': 'Track Suit',
  'preorder-badminton': 'Badminton Racket',
  'product-row-la-liga': 'La Liga',
  'product-row-world-cup': 'World Cup',
  'current-season': 'Current Season',
  clearance: 'Clearance',
  'best-sellers': 'Best Sellers',
  'latest-products': 'New In',
  'all-jerseys': 'All',
};

export function resolveSectionCategory(section: PageSection): string | undefined {
  return section.productCategory || LEGACY_PRODUCT_CATEGORY[section.id];
}

export function isProductRowSection(section: PageSection): boolean {
  return (
    section.sectionType === 'product-row' ||
    !!section.productCategory ||
    !!section.selectedProductIds?.length ||
    section.id in LEGACY_PRODUCT_CATEGORY
  );
}

export function isActiveCatalogProduct(p: Product): boolean {
  return (
    p.status !== 'Trashed' &&
    p.status !== 'Archived' &&
    !p.isTrashed &&
    !p.isArchived
  );
}

export function getInStockProducts(products: Product[]): Product[] {
  return products.filter((p) => isActiveCatalogProduct(p) && (Number(p.stock) || 0) > 0);
}

export function usesManualProductSelection(section: PageSection): boolean {
  return (
    section.productSelectionMode === 'manual' ||
    (section.selectedProductIds?.length ?? 0) > 0
  );
}

function sortByCategoryRow(a: Product, b: Product): number {
  const ra = Number(a.categoryRow);
  const rb = Number(b.categoryRow);
  const aN = Number.isFinite(ra) && ra > 0 ? ra : 9999;
  const bN = Number.isFinite(rb) && rb > 0 ? rb : 9999;
  if (aN !== bN) return aN - bN;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

/** Broad match so homepage rows fill from category, page, league, tags, or name. */
export function productMatchesHomepageCategory(p: Product, cat: string): boolean {
  if (!cat?.trim()) return false;
  if (/^all(\s*jerseys)?$/i.test(cat.trim())) return true;
  const productCats = getProductCategories(p);
  if (productCats.some((c) => storefrontLabelsMatch(c, cat))) return true;
  if (storefrontLabelsMatch(p.category || '', cat)) return true;
  if (storefrontLabelsMatch(p.targetPage || '', cat)) return true;
  if (storefrontLabelsMatch(p.pageName || '', cat)) return true;
  if (storefrontLabelsMatch(p.league || '', cat)) return true;
  if (storefrontLabelsMatch(p.club || '', cat)) return true;
  if (storefrontLabelsMatch(p.nationalTeam || '', cat)) return true;
  if (storefrontLabelsMatch(p.country || '', cat)) return true;
  if ((p.tags || []).some((t) => storefrontLabelsMatch(t, cat))) return true;

  if (
    storefrontLabelsMatch(cat, 'Retro') &&
    (storefrontLabelsMatch(p.category || '', 'Legends') ||
      storefrontLabelsMatch(p.targetPage || '', 'Legends') ||
      storefrontLabelsMatch(p.pageName || '', 'Retro Store'))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'World Cup') &&
    (storefrontLabelsMatch(p.targetPage || '', 'World Cup') ||
      storefrontLabelsMatch(p.targetPage || '', 'World Cup Vault') ||
      storefrontLabelsMatch(p.pageName || '', 'World Cup') ||
      /world\s*cup/i.test(p.name || ''))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'La Liga') &&
    (storefrontLabelsMatch(p.targetPage || '', 'La Liga') ||
      storefrontLabelsMatch(p.pageName || '', 'La Liga') ||
      /la\s*liga/i.test(p.name || '') ||
      /real madrid|barcelona|atletico|athletic club|sevilla|valencia/i.test(p.name || ''))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Premier League') &&
    (/premier\s*league|\bepl\b/i.test(p.name || '') ||
      /arsenal|chelsea|liverpool|manchester|tottenham|newcastle/i.test(p.name || ''))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Player Edition') &&
    /player\s*(edition|version|fit)/i.test(p.name || '')
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Fan Edition') &&
    /fan\s*(edition|version|fit)/i.test(p.name || '')
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Current Season') &&
    /20\d{2}\s*\/\s*2\d|current\s*season/i.test(`${p.name || ''} ${p.season || ''}`)
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Best Sellers') &&
    (p.isBestSeller || storefrontLabelsMatch(p.category || '', 'Best Sellers'))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Featured') &&
    (p.isFeatured || storefrontLabelsMatch(p.category || '', 'Featured'))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'Clearance') ||
    storefrontLabelsMatch(cat, 'Catalog') ||
    storefrontLabelsMatch(cat, 'Outlet')
  ) {
    return isCatalogAssignedProduct(p);
  }

  const catLower = cat.toLowerCase().trim();
  if (catLower.length >= 3) {
    const hay = [p.name, p.brand, ...(p.tags || [])].join(' ').toLowerCase();
    if (hay.includes(catLower)) return true;
  }
  return false;
}

export function getProductsForHomepageSection(section: PageSection, products: Product[]): Product[] {
  const max = Math.max(4, section.maxProducts ?? 4);
  const activeProducts = products.filter(isActiveCatalogProduct);
  if (activeProducts.length === 0) return [];

  const catalogProducts = activeProducts.filter(isCatalogAssignedProduct);
  // Prefer non-Catalog kits for Featured/Latest/league rows; fall back so rows never blank
  const nonCatalog = activeProducts.filter((p) => !isCatalogAssignedProduct(p));
  const mainPool = nonCatalog.length > 0 ? nonCatalog : activeProducts;
  const isCatalogRow = section.id === 'clearance';

  const manualIds = section.selectedProductIds || [];

  // Manual pick only when IDs exist — empty manual mode must not blank the homepage
  if (manualIds.length > 0 && usesManualProductSelection(section)) {
    const byId = new Map(activeProducts.map((p) => [p.id, p]));
    const picked = manualIds.map((id) => byId.get(id)).filter((p): p is Product => !!p);
    if (isCatalogRow) {
      const scoped = picked.filter(isCatalogAssignedProduct);
      if (scoped.length > 0) return scoped.slice(0, max);
    } else if (picked.length > 0) {
      return picked.slice(0, max);
    }
  }

  // Catalog page products → Catalog row (bottom)
  if (isCatalogRow) {
    if (catalogProducts.length > 0) {
      return [...catalogProducts].sort(sortByCategoryRow).slice(0, max);
    }
    return [];
  }

  // All Jerseys — every active kit as ProductCards (no Catalog exclusion, no low cap)
  if (section.id === 'all-jerseys') {
    return [...activeProducts].sort(sortByCategoryRow);
  }

  // Latest Workshop Drops — prefer non-Catalog, never blank
  if (section.id === 'latest-products') {
    return mainPool.slice(0, max);
  }

  const cat = resolveSectionCategory(section);

  if (cat) {
    const byCategory = mainPool
      .filter((p) => productMatchesHomepageCategory(p, cat))
      .sort(sortByCategoryRow);
    if (byCategory.length > 0) return byCategory.slice(0, max);
  }

  if (section.id === 'featured-collection') {
    const featured = mainPool.filter((p) => p.isFeatured).sort(sortByCategoryRow);
    if (featured.length) return featured.slice(0, max);
    return mainPool.slice(0, max);
  }
  if (section.id === 'best-sellers') {
    const best = mainPool.filter((p) => p.isBestSeller).sort(sortByCategoryRow);
    if (best.length) return best.slice(0, max);
    return mainPool.slice(0, max);
  }

  // Unknown product-row with no category hits: show stock rather than hide forever
  if (isProductRowSection(section)) {
    return mainPool.slice(0, max);
  }

  return [];
}

export function enrichProductRowSection(section: PageSection): PageSection {
  const cat = resolveSectionCategory(section);
  if (!cat) return section;
  return {
    sectionType: section.sectionType || 'product-row',
    productCategory: section.productCategory || cat,
    maxProducts: section.maxProducts ?? 4,
    ...section,
  };
}

export function ensureCategoryForSection(
  categoryItems: CategoryItem[] | undefined,
  categoryName: string,
): CategoryItem[] {
  const items = categoryItems || [];
  if (!categoryName.trim()) return items;
  if (items.some((c) => c.name.toLowerCase() === categoryName.toLowerCase())) return items;
  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return [
    ...items,
    {
      id: `cat-${slug}`,
      name: categoryName.trim(),
      slug,
      pageNumber: 1,
      rowOrder: items.length + 1,
      status: 'Active',
      icon: 'Shirt',
      description: `Homepage section category: ${categoryName.trim()}`,
    },
  ];
}

function slugifySectionId(categoryName: string): string {
  return `product-row-${categoryName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'category'}`;
}

/**
 * Ensure every storefront category has a visible homepage product-row section
 * showing at least 4 products (serial / categoryRow order).
 */
export function ensureHomepageRowsForCategories(
  sections: PageSection[],
  categoryNames: string[],
): PageSection[] {
  let next = normalizeHomepageSections(sections);
  const existingCats = new Set(
    next
      .filter(isProductRowSection)
      .map((s) => resolveSectionCategory(s)?.toLowerCase().trim())
      .filter(Boolean) as string[],
  );

  for (const rawName of categoryNames) {
    const name = String(rawName || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const already = [...existingCats].some((c) => storefrontLabelsMatch(c, name));
    if (already) continue;

    const id = slugifySectionId(name);
    if (next.some((s) => s.id === id)) {
      existingCats.add(key);
      continue;
    }

    const row: PageSection = {
      id,
      name: `${name} Row`,
      visible: true,
      bgColor: 'bg-transparent',
      padding: 'py-12',
      margin: 'my-0',
      title: name.toUpperCase(),
      subtitle: `Shop ${name} — curated picks for collectors`,
      status: 'active',
      sectionType: 'product-row',
      productCategory: name,
      productSelectionMode: 'category',
      buttonText: 'VIEW ALL',
      buttonUrl: 'listing',
      maxProducts: 4,
    };
    const insertAt = next.findIndex((s) => s.id === 'newsletter' || s.id === 'store-locations');
    if (insertAt >= 0) {
      next = [...next.slice(0, insertAt), row, ...next.slice(insertAt)];
    } else {
      next = [...next, row];
    }
    existingCats.add(key);
  }

  next = next.map((s) =>
    isProductRowSection(s)
      ? {
          ...s,
          maxProducts: Math.max(4, s.maxProducts ?? 4),
          visible: s.visible !== false,
          status: s.status || 'active',
        }
      : s,
  );

  return normalizeHomepageSections(next);
}

export function countProductsInSection(section: PageSection, products: Product[]): number {
  return getProductsForHomepageSection(section, products).length;
}

export function toggleSectionProductId(section: PageSection, productId: string): PageSection {
  const ids = section.selectedProductIds || [];
  const nextIds = ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId];
  return {
    ...section,
    selectedProductIds: nextIds,
    productSelectionMode: 'manual',
  };
}
