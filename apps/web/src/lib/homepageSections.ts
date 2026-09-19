import { PageSection, Product, CategoryItem } from '../types';
import { resolveStorefrontPage, storefrontLabelsMatch } from './storefrontPages';
import { getProductCategories } from './sizeCharts';

/** Sections permanently removed from the live storefront (still may exist in old DB rows). */
export const REMOVED_HOMEPAGE_SECTION_IDS = new Set([
  'all-jerseys',
  'latest-products',
  'best-sellers',
  'current-season',
  'kids-collection',
  'fan-edition',
  'preorder-jacket',
  'preorder-track-suit',
  'preorder-badminton',
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

/**
 * Homepage product-row categories that must never appear
 * (also strips auto-created product-row-* sections).
 * Keys are stored normalized via categoryKey() — never put raw titles here.
 */
const REMOVED_HOMEPAGE_CATEGORY_RAW = [
  'new in',
  'newin',
  'classic',
  'club classic',
  'club classics',
  'legends',
  'england',
  'best sellers',
  'bestsellers',
  'current season',
  'currentseason',
  'mls',
  'other leagues',
  'other league',
  'league',
  'kids',
  'fan edition',
  'fanedition',
  'jacket',
  'track suit',
  'tracksuit',
  'badminton racket',
  'badminton',
  'pre-order jacket',
  'pre-order track suit',
  'pre-order badminton racket',
  'preorder jacket',
  'preorder track suit',
  'preorder badminton',
  'pre order jacket',
  'pre order track suit',
  'pre order badminton racket',
];

function categoryKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[·•]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export const REMOVED_HOMEPAGE_CATEGORY_KEYS = new Set(
  REMOVED_HOMEPAGE_CATEGORY_RAW.flatMap((raw) => {
    const key = categoryKey(raw);
    return key ? [key, key.replace(/\s+/g, '')] : [];
  }),
);

export function isRemovedHomepageCategory(value?: string | null): boolean {
  const key = categoryKey(value || '');
  if (!key) return false;
  if (REMOVED_HOMEPAGE_CATEGORY_KEYS.has(key)) return true;
  const compact = key.replace(/\s+/g, '');
  if (REMOVED_HOMEPAGE_CATEGORY_KEYS.has(compact)) return true;
  // Titles like "PRE-ORDER · JACKET" / "PRE-ORDER · BADMINTON RACKET"
  if (/^pre\s*order\b/.test(key) && /\b(jacket|track\s*suit|badminton)\b/.test(key)) return true;
  return false;
}

function shouldDropHomepageSection(s: PageSection): boolean {
  if (!s?.id || REMOVED_HOMEPAGE_SECTION_IDS.has(s.id)) return true;
  if (isRemovedHomepageCategory(s.productCategory)) return true;
  if (isRemovedHomepageCategory(s.title)) return true;
  if (isRemovedHomepageCategory(s.name)) return true;
  // Homepage dump row only — does not affect the All Jerseys listing page or nav
  if (/^all\s*jerseys$/i.test(String(s.title || '').trim())) return true;
  if (/^all\s*jerseys$/i.test(String(s.name || '').trim())) return true;
  // Auto rows: product-row-mls, product-row-new-in, etc.
  if (/^product-row-/i.test(s.id)) {
    const fromId = s.id.replace(/^product-row-/i, '').replace(/-/g, ' ');
    if (isRemovedHomepageCategory(fromId)) return true;
  }
  return false;
}

/** Strip All Jerseys dump row — removed from landing page. */
export function ensureAllJerseysSection(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => s.id !== 'all-jerseys');
}

const COMMUNITY_GALLERY_SECTION: PageSection = {
  id: 'community-gallery',
  name: 'Community Gallery',
  visible: true,
  bgColor: 'bg-transparent',
  padding: 'py-14',
  margin: 'my-0',
  title: 'JOIN THE VANSKAP COMMUNITY',
  subtitle: '+6,783 Members Since 2024.',
  status: 'active',
};

function isPremierLeagueProductRow(s: PageSection): boolean {
  if (!isProductRowSection(s)) return false;
  const cat = resolveSectionCategory(s) || '';
  const blob = `${s.id} ${s.title || ''} ${s.name || ''} ${cat}`;
  return /premier\s*league|\bepl\b/i.test(blob);
}

/** Keep Community Gallery directly after the Premier League product row. */
export function ensureCommunityGalleryAfterPremierLeague(sections: PageSection[]): PageSection[] {
  const existing = sections.find((s) => s.id === 'community-gallery');
  const section: PageSection = {
    ...COMMUNITY_GALLERY_SECTION,
    ...(existing || {}),
    id: 'community-gallery',
    // Always on for storefront — disable via communityGallery.enabled in settings
    visible: true,
    status: 'active',
    bgColor: 'bg-white',
    padding: 'py-14',
    margin: 'my-0',
    title: existing?.title || COMMUNITY_GALLERY_SECTION.title,
    subtitle: existing?.subtitle || COMMUNITY_GALLERY_SECTION.subtitle,
  };

  const without = sections.filter((s) => s.id !== 'community-gallery');
  const premierIdx = without.findIndex(isPremierLeagueProductRow);
  if (premierIdx >= 0) {
    return [
      ...without.slice(0, premierIdx + 1),
      section,
      ...without.slice(premierIdx + 1),
    ];
  }
  const insertAt = without.findIndex(
    (s) => s.id === 'store-locations' || s.id === 'newsletter' || s.id === 'clearance',
  );
  if (insertAt >= 0) {
    return [...without.slice(0, insertAt), section, ...without.slice(insertAt)];
  }
  return [...without, section];
}

const CUSTOMER_FEEDBACK_SECTION: PageSection = {
  id: 'customer-feedback-gallery',
  name: 'Customers Feedback',
  visible: true,
  bgColor: 'bg-white',
  padding: 'py-14',
  margin: 'my-0',
  title: 'CUSTOMERS FEEDBACK',
  subtitle: 'Real photos from verified buyers',
  status: 'active',
};

/** Keep Customers Feedback directly before Physical Outlets on the homepage. */
export function ensureCustomerFeedbackBeforeStoreLocations(
  sections: PageSection[],
): PageSection[] {
  const existing = sections.find((s) => s.id === 'customer-feedback-gallery');
  const section: PageSection = {
    ...CUSTOMER_FEEDBACK_SECTION,
    ...(existing || {}),
    id: 'customer-feedback-gallery',
    visible: true,
    status: 'active',
    bgColor: 'bg-white',
    padding: 'py-14',
    margin: 'my-0',
    title: existing?.title || CUSTOMER_FEEDBACK_SECTION.title,
    subtitle: existing?.subtitle || CUSTOMER_FEEDBACK_SECTION.subtitle,
  };

  const without = sections.filter((s) => s.id !== 'customer-feedback-gallery');
  const insertAt = without.findIndex((s) => s.id === 'store-locations');
  if (insertAt >= 0) {
    return [...without.slice(0, insertAt), section, ...without.slice(insertAt)];
  }
  const fallback = without.findIndex(
    (s) => s.id === 'newsletter' || s.id === 'clearance',
  );
  if (fallback >= 0) {
    return [...without.slice(0, fallback), section, ...without.slice(fallback)];
  }
  return [...without, section];
}

export function normalizeHomepageSections(sections: PageSection[]): PageSection[] {
  const seen = new Set<string>();
  const filtered = sections.filter((s) => {
    if (shouldDropHomepageSection(s)) return false;
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
    ensureCustomerFeedbackBeforeStoreLocations(
      ensureCommunityGalleryAfterPremierLeague(
        ensureAllJerseysSection(ensureJerseyHomepageOrder(darkened)),
      ),
    ),
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

const CLUB_LEAGUE_LABELS = [
  'La Liga',
  'Premier League',
  'Ligue 1',
  'Serie A',
  'Bundesliga',
  'MLS',
  'Saudi Pro League',
] as const;

function productHasClubLeagueSignal(p: Product, productCats: string[]): boolean {
  const fields = [
    ...productCats,
    p.category,
    p.league,
    p.targetPage,
    p.pageName,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return fields.some((f) =>
    CLUB_LEAGUE_LABELS.some((league) => storefrontLabelsMatch(f, league)),
  );
}

function isWorldCupHomepageCategory(cat: string): boolean {
  const t = cat.trim();
  return /^world\s*cup(\s*vault)?$/i.test(t) || storefrontLabelsMatch(t, 'World Cup');
}

/** Exact / literal World Cup signals — never treat "International Teams" alone as World Cup. */
function productHasExplicitWorldCupSignal(p: Product, productCats: string[]): boolean {
  const fields = [
    ...productCats,
    p.category,
    p.league,
    p.pageName,
    p.targetPage,
    ...(p.tags || []),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (fields.some((f) => /world\s*cup/i.test(f))) return true;
  if (/world\s*cup/i.test(p.name || '')) return true;
  // National-team kit without a club league assignment
  if (p.nationalTeam && !p.club && !productHasClubLeagueSignal(p, productCats)) return true;
  return false;
}

/**
 * Match product fields to a homepage row category.
 * Uses exact/normalized equality first; does NOT collapse International Teams ↔ World Cup
 * (that alias is for nav listing only).
 */
function homepageFieldMatchesCategory(field: string, cat: string): boolean {
  const a = String(field || '').trim();
  const b = String(cat || '').trim();
  if (!a || !b) return false;
  const na = a.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const nb = b.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (na === nb) return true;
  // Allow known equal pairs without International↔WorldCup collapse
  if (storefrontLabelsMatch(a, b)) {
    const pa = resolveStorefrontPage(a);
    const pb = resolveStorefrontPage(b);
    // Same storefront page id only when neither side is a World Cup *category row* mismatch
    if (pa && pb && pa.id === pb.id) {
      const aIsWorldCupLiteral = /world\s*cup/i.test(a);
      const bIsWorldCupLiteral = /world\s*cup/i.test(b);
      const aIsIntl = /international/i.test(a) || pa.id === 'International Teams';
      const bIsIntl = /international/i.test(b) || pb.id === 'International Teams';
      // International Teams target must not satisfy a "World Cup" homepage category
      if ((aIsIntl && bIsWorldCupLiteral && !aIsWorldCupLiteral) || (bIsIntl && aIsWorldCupLiteral && !bIsWorldCupLiteral)) {
        return false;
      }
      return true;
    }
    return true;
  }
  return false;
}

/** Match homepage product-row category — club leagues never bleed into World Cup. */
export function productMatchesHomepageCategory(p: Product, cat: string): boolean {
  if (!cat?.trim()) return false;
  if (/^all(\s*jerseys)?$/i.test(cat.trim())) return true;
  const productCats = getProductCategories(p);

  // World Cup homepage row: national / WC kits only — never club (La Liga, etc.) products
  if (isWorldCupHomepageCategory(cat)) {
    if (productHasClubLeagueSignal(p, productCats)) return false;
    return productHasExplicitWorldCupSignal(p, productCats);
  }

  if (productCats.some((c) => homepageFieldMatchesCategory(c, cat))) return true;
  if (homepageFieldMatchesCategory(p.category || '', cat)) return true;
  if (homepageFieldMatchesCategory(p.targetPage || '', cat)) return true;
  if (homepageFieldMatchesCategory(p.pageName || '', cat)) return true;
  if (homepageFieldMatchesCategory(p.league || '', cat)) return true;
  if (homepageFieldMatchesCategory(p.club || '', cat)) return true;
  if (homepageFieldMatchesCategory(p.nationalTeam || '', cat)) return true;
  if (homepageFieldMatchesCategory(p.country || '', cat)) return true;
  if ((p.tags || []).some((t) => homepageFieldMatchesCategory(t, cat))) return true;

  if (
    storefrontLabelsMatch(cat, 'Retro') &&
    (storefrontLabelsMatch(p.category || '', 'Legends') ||
      storefrontLabelsMatch(p.targetPage || '', 'Legends') ||
      storefrontLabelsMatch(p.pageName || '', 'Retro Store') ||
      /retro/i.test(p.name || ''))
  ) {
    return true;
  }
  if (
    storefrontLabelsMatch(cat, 'La Liga') &&
    (homepageFieldMatchesCategory(p.targetPage || '', 'La Liga') ||
      homepageFieldMatchesCategory(p.pageName || '', 'La Liga') ||
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

  // Fuzzy name includes — skip for short / ambiguous category tokens like "cup"
  const catLower = cat.toLowerCase().trim();
  if (catLower.length >= 4 && !/^world\s*cup/i.test(catLower)) {
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

  // Latest Workshop Drops — removed; never fill with random stock
  if (section.id === 'latest-products') {
    return [];
  }

  const cat = resolveSectionCategory(section);

  if (cat) {
    if (isRemovedHomepageCategory(cat)) return [];
    const byCategory = mainPool
      .filter((p) => productMatchesHomepageCategory(p, cat))
      .sort(sortByCategoryRow);
    // Strict: empty category rows stay empty (renderer hides them)
    return byCategory.slice(0, max);
  }

  if (section.id === 'featured-collection') {
    const featured = mainPool.filter((p) => p.isFeatured).sort(sortByCategoryRow);
    return featured.slice(0, max);
  }
  if (section.id === 'best-sellers') {
    const best = mainPool.filter((p) => p.isBestSeller).sort(sortByCategoryRow);
    return best.slice(0, max);
  }

  // Never dump unrelated stock into a product-row — hide instead
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
 * Ensure storefront categories that actually have products get a homepage row.
 * Skips removed/blocked categories and never creates empty rows.
 * When products are provided, also strips empty product-row shells (except core rows).
 */
export function ensureHomepageRowsForCategories(
  sections: PageSection[],
  categoryNames: string[],
  products: Product[] = [],
): PageSection[] {
  let next = normalizeHomepageSections(sections);

  const coreKeepIds = new Set([
    'featured-collection',
    'retro-collection',
    'player-edition',
    'customised-kit',
    'clearance',
    'product-row-la-liga',
    'product-row-world-cup',
    'hero-slider',
    'trending-searches',
    'daily-deals',
    'community-gallery',
    'customer-feedback-gallery',
    'store-locations',
  ]);

  // Drop empty / blocked product rows that still linger in CMS
  if (products.length > 0) {
    next = next.filter((s) => {
      if (!isProductRowSection(s)) return true;
      if (coreKeepIds.has(s.id)) return true;
      if (shouldDropHomepageSection(s)) return false;
      const count = getProductsForHomepageSection(s, products).length;
      return count > 0;
    });
    next = normalizeHomepageSections(next);
  }

  const existingCats = new Set(
    next
      .filter(isProductRowSection)
      .map((s) => resolveSectionCategory(s)?.toLowerCase().trim())
      .filter(Boolean) as string[],
  );

  for (const rawName of categoryNames) {
    const name = String(rawName || '').trim();
    if (!name || isRemovedHomepageCategory(name)) continue;
    const key = name.toLowerCase();
    const already = [...existingCats].some((c) => storefrontLabelsMatch(c, name));
    if (already) continue;

    // Only auto-create when at least one active product matches
    const hasStock =
      products.length === 0
        ? false
        : products.some(
            (p) =>
              !p.isTrashed &&
              !p.isArchived &&
              (!p.status || p.status === 'Active') &&
              productMatchesHomepageCategory(p, name),
          );
    if (!hasStock) continue;

    const id = slugifySectionId(name);
    if (next.some((s) => s.id === id) || REMOVED_HOMEPAGE_SECTION_IDS.has(id)) {
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
