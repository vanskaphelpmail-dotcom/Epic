import type { Product } from '../types';

/** Canonical storefront destination pages (nav URL id ↔ display name). */
export type StorefrontPageDef = {
  id: string;
  name: string;
  pageNumber: number;
  slug: string;
  /** Extra aliases that resolve to this page (legacy category names, labels) */
  aliases?: string[];
};

export const STOREFRONT_PAGES: StorefrontPageDef[] = [
  {
    id: 'World Cup',
    name: 'World Cup Vault',
    pageNumber: 1,
    slug: 'world-cup',
    aliases: ['World Cup Vault', 'world-cup', 'WorldCup'],
  },
  {
    id: 'England',
    name: 'Bangladesh Classic',
    pageNumber: 1,
    slug: 'bangladesh',
    // Do NOT alias plain "Bangladesh" — that matches product.country for the whole catalog
    aliases: ['Bangladesh Classic', 'england', 'England Classic'],
  },
  {
    id: 'Legends',
    name: 'Retro Store',
    pageNumber: 2,
    slug: 'retro-store',
    aliases: ['Retro Store', 'Retro', 'Legends Tribute', 'retro-store', 'Legends Store'],
  },
  {
    id: 'Current Season',
    name: 'Current Season',
    pageNumber: 2,
    slug: 'current-season',
    aliases: ['current-season'],
  },
  {
    id: 'Clearance',
    name: 'Clearance',
    pageNumber: 3,
    slug: 'clearance',
    aliases: ['Outlet', 'Sale', 'Clearance Vault'],
  },
  {
    id: 'Classic',
    name: 'Club Classic',
    pageNumber: 4,
    slug: 'classic',
    aliases: ['Club Classic', 'club-classic', 'Club Classics'],
  },
  {
    id: 'Accessories',
    name: 'Accessories',
    pageNumber: 3,
    slug: 'accessories',
    aliases: [],
  },
];

function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

/** All strings that should match a storefront page (id + name + aliases). */
export function pageMatchKeys(page: StorefrontPageDef): string[] {
  return [page.id, page.name, page.slug, ...(page.aliases || [])].map(norm);
}

export function resolveStorefrontPage(
  value: string | null | undefined,
): StorefrontPageDef | null {
  if (!value || !String(value).trim()) return null;
  const key = norm(value);
  for (const page of STOREFRONT_PAGES) {
    if (pageMatchKeys(page).includes(key)) return page;
  }
  return null;
}

/** Canonical id to persist on products (nav-compatible). Falls back to trimmed input. */
export function canonicalTargetPageId(value: string | null | undefined): string {
  const resolved = resolveStorefrontPage(value);
  if (resolved) return resolved.id;
  return String(value || '').trim();
}

export function canonicalTargetPageName(value: string | null | undefined): string {
  const resolved = resolveStorefrontPage(value);
  if (resolved) return resolved.name;
  return String(value || '').trim();
}

/**
 * Whether two labels refer to the same storefront destination.
 * Exact / alias only — no substring includes (avoids Retro ↔ Bangladesh Classic bleed).
 */
export function storefrontLabelsMatch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const pa = resolveStorefrontPage(a);
  const pb = resolveStorefrontPage(b);
  if (pa && pb && pa.id === pb.id) return true;
  if (pa && pageMatchKeys(pa).includes(nb)) return true;
  if (pb && pageMatchKeys(pb).includes(na)) return true;
  return false;
}

/**
 * Product belongs on a nav / listing destination.
 * Explicit Target Page / pageName wins; category is fallback only.
 * Never uses country, name, brand, or club (those caused Bangladesh Classic ↔ Retro bleed).
 */
export function productMatchesStorefrontFilter(
  product: Product,
  filter: string,
): boolean {
  if (!filter || filter === 'All') return true;

  const filterPage = resolveStorefrontPage(filter);
  const filterKey = norm(filter);

  const explicit =
    resolveStorefrontPage(product.targetPage) ||
    resolveStorefrontPage(product.pageName);

  if (explicit) {
    if (filterPage) return explicit.id === filterPage.id;
    return (
      pageMatchKeys(explicit).includes(filterKey) ||
      norm(explicit.id) === filterKey ||
      norm(explicit.name) === filterKey
    );
  }

  // No Target Page set — match category only (exact / alias)
  const cat = String(product.category || '').trim();
  if (!cat) return false;
  if (storefrontLabelsMatch(cat, filter)) return true;
  if (!filterPage && norm(cat) === filterKey) return true;
  return false;
}

/** Whether a main-nav item is the active listing destination. */
export function isStorefrontNavActive(
  itemUrl: string,
  selectedCategory: string,
  currentPage: string,
): boolean {
  const url = String(itemUrl || '').trim();
  if (!url) return false;

  const onListing = currentPage === 'listing';
  if (url === 'All' || url === 'listing' || url === 'shop') {
    return onListing && (!selectedCategory || selectedCategory === 'All');
  }

  if (!onListing) return false;
  if (!selectedCategory || selectedCategory === 'All') return false;
  return storefrontLabelsMatch(selectedCategory, url);
}

/** Extra sidebar labels that map onto real catalog category / page values. */
const LISTING_CATEGORY_ALIASES: Record<string, string[]> = {
  'club jerseys': ['classic', 'club classic', 'club jerseys', 'club', 'club classics'],
  legends: ['legends', 'retro', 'retro store', 'legends tribute', 'legends store'],
  international: ['international', 'world cup', 'world cup vault', 'national'],
  training: ['training', 'pre match', 'pre-match', 'warmup'],
  retro: ['retro', 'legends', 'retro store'],
  'retro store': ['retro', 'legends', 'retro store'],
};

/**
 * Listing sidebar / All Jerseys filter.
 * Storefront nav pages (England, Legends, …) use target-page rules;
 * other labels match category / categoryRow with aliases.
 */
export function productMatchesListingCategory(
  product: Product,
  filter: string,
): boolean {
  if (!filter || filter === 'All') return true;

  // Nav destination pages — strict target-page matching
  if (resolveStorefrontPage(filter)) {
    return productMatchesStorefrontFilter(product, filter);
  }

  const key = norm(filter);
  const aliases = new Set([key, ...(LISTING_CATEGORY_ALIASES[key] || [])]);

  const fields = [
    product.category,
    product.pageName,
    product.targetPage,
  ]
    .map((v) => norm(String(v || '')))
    .filter(Boolean);

  for (const field of fields) {
    if (aliases.has(field) || field === key) return true;
  }
  return false;
}

export function productMatchesBrand(product: Product, brand: string): boolean {
  if (!brand || brand === 'All') return true;
  const want = norm(brand);
  const have = norm(product.brand || '');
  if (!have) return false;
  return have === want || have.includes(want) || want.includes(have);
}

export function productMatchesCondition(product: Product, condition: string): boolean {
  if (!condition || condition === 'All') return true;
  return norm(product.condition || '') === norm(condition);
}

/** Category names that should get a homepage product-row section. */
export function homepageRowCategoryCandidates(products: Product[]): string[] {
  const skip = new Set(['mystery', 'all']);
  const names = new Set<string>();
  for (const p of products) {
    const cat = String(p.category || '').trim();
    if (!cat || skip.has(cat.toLowerCase())) continue;
    names.add(cat);
  }
  for (const core of [
    'Featured',
    'Player Edition',
    'Retro',
    'Fan Edition',
    'Kids',
    'Customised Kit',
    'Jacket',
    'Track Suit',
    'Badminton Racket',
    'Current Season',
    'Clearance',
    'Best Sellers',
    'New In',
  ]) {
    names.add(core);
  }
  return [...names];
}
