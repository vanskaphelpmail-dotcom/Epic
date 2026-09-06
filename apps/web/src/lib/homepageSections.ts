import { PageSection, Product, CategoryItem } from '../types';
import { storefrontLabelsMatch } from './storefrontPages';
import { getProductCategories } from './sizeCharts';

/** Sections permanently removed from the live storefront (still may exist in old DB rows). */
export const REMOVED_HOMEPAGE_SECTION_IDS = new Set([
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
]);

export function normalizeHomepageSections(sections: PageSection[]): PageSection[] {
  const seen = new Set<string>();
  const filtered = sections.filter((s) => {
    if (!s?.id || REMOVED_HOMEPAGE_SECTION_IDS.has(s.id)) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  const darkened = filtered.map((s) => {
    const bg = String(s.bgColor || '');
    const isLightOrTinted =
      !bg ||
      /\bbg-white\b/.test(bg) ||
      /\bbg-zinc-50\b/.test(bg) ||
      /\bbg-gray-50\b/.test(bg) ||
      /\bbg-amber-/.test(bg) ||
      /\bbg-emerald-/.test(bg) ||
      /\bbg-red-/.test(bg) ||
      /from-purple|to-indigo|gradient/i.test(bg);
    return isLightOrTinted ? { ...s, bgColor: 'bg-black' } : s;
  });
  return ensureJerseyHomepageOrder(darkened);
}

const LATEST_PRODUCTS_SECTION: PageSection = {
  id: 'latest-products',
  name: 'Latest Products Row',
  visible: true,
  bgColor: 'bg-black',
  padding: 'py-12',
  margin: 'my-0',
  title: 'LATEST WORKSHOP DROPS',
  subtitle: 'Freshly authenticated physical catalog arrivals',
  status: 'active',
  sectionType: 'product-row',
  productCategory: 'New In',
  buttonText: '',
  maxProducts: 4,
};

const RETRO_SECTION: PageSection = {
  id: 'retro-collection',
  name: 'Retro Collection Row',
  visible: true,
  bgColor: 'bg-black',
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
  bgColor: 'bg-black',
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
  bgColor: 'bg-black',
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
  bgColor: 'bg-black',
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
  'latest-products',
  'retro-collection',
  'product-row-la-liga',
  'product-row-world-cup',
  'player-edition',
] as const;

const JERSEY_SECTION_DEFAULTS: Record<string, PageSection> = {
  'latest-products': LATEST_PRODUCTS_SECTION,
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
 * Latest → Retro → La Liga → World Cup → Player Edition
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

export function getProductsForHomepageSection(section: PageSection, products: Product[]): Product[] {
  const max = Math.max(4, section.maxProducts ?? 4);
  const activeProducts = products.filter(isActiveCatalogProduct);
  const manualIds = section.selectedProductIds || [];

  if (usesManualProductSelection(section) && manualIds.length > 0) {
    const byId = new Map(activeProducts.map((p) => [p.id, p]));
    return manualIds.map((id) => byId.get(id)).filter((p): p is Product => !!p).slice(0, max);
  }

  if (section.productSelectionMode === 'manual') {
    return [];
  }

  // Latest drops = newest catalog items (don't require a "New In" category match)
  if (section.id === 'latest-products') {
    return activeProducts.slice(0, max);
  }

  const cat = resolveSectionCategory(section);

  if (cat) {
    const byCategory = activeProducts
      .filter((p) => {
        const productCats = getProductCategories(p);
        if (productCats.some((c) => storefrontLabelsMatch(c, cat))) return true;
        if (storefrontLabelsMatch(p.category || '', cat)) return true;
        // Legends / Retro Store products also fill the Retro homepage row
        if (
          storefrontLabelsMatch(cat, 'Retro') &&
          (storefrontLabelsMatch(p.category || '', 'Legends') ||
            storefrontLabelsMatch(p.targetPage || '', 'Legends') ||
            storefrontLabelsMatch(p.pageName || '', 'Retro Store'))
        ) {
          return true;
        }
        // World Cup row also picks vault / page-tagged kits
        if (
          storefrontLabelsMatch(cat, 'World Cup') &&
          (storefrontLabelsMatch(p.targetPage || '', 'World Cup') ||
            storefrontLabelsMatch(p.targetPage || '', 'World Cup Vault') ||
            storefrontLabelsMatch(p.pageName || '', 'World Cup') ||
            /world\s*cup/i.test(p.name || ''))
        ) {
          return true;
        }
        // La Liga row also matches league / name tags
        if (
          storefrontLabelsMatch(cat, 'La Liga') &&
          (storefrontLabelsMatch(p.targetPage || '', 'La Liga') ||
            storefrontLabelsMatch(p.pageName || '', 'La Liga') ||
            /la\s*liga/i.test(p.name || '') ||
            /real madrid|barcelona|atletico|athletic club|sevilla|valencia/i.test(p.name || ''))
        ) {
          return true;
        }
        return false;
      })
      .sort(sortByCategoryRow);
    if (byCategory.length > 0) return byCategory.slice(0, max);
  }

  if (section.id === 'featured-collection') {
    const featured = activeProducts.filter((p) => p.isFeatured).sort(sortByCategoryRow);
    if (featured.length) return featured.slice(0, max);
  }
  if (section.id === 'best-sellers') {
    const best = activeProducts.filter((p) => p.isBestSeller).sort(sortByCategoryRow);
    if (best.length) return best.slice(0, max);
  }
  if (section.id === 'clearance') {
    const clearance = activeProducts
      .filter((p) => p.category === 'Clearance' || p.originalPrice || p.isClearance)
      .sort(sortByCategoryRow);
    if (clearance.length) return clearance.slice(0, max);
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
      bgColor: 'bg-black',
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
