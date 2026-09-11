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
    id: 'Premier League',
    name: 'Premier League',
    pageNumber: 1,
    slug: 'premier-league',
    aliases: ['PREMIER LEAGUE', 'EPL', 'premier'],
  },
  {
    id: 'La Liga',
    name: 'LALIGA',
    pageNumber: 1,
    slug: 'laliga',
    aliases: ['LALIGA', 'LaLiga', 'la liga', 'laliga'],
  },
  {
    id: 'Ligue 1',
    name: 'Ligue 1',
    pageNumber: 1,
    slug: 'ligue-1',
    aliases: ['LIGUE 1', 'Ligue1'],
  },
  {
    id: 'Serie A',
    name: 'Serie A',
    pageNumber: 1,
    slug: 'serie-a',
    aliases: ['SERIE A', 'SerieA'],
  },
  {
    id: 'Bundesliga',
    name: 'Bundesliga',
    pageNumber: 1,
    slug: 'bundesliga',
    aliases: ['BUNDESLIGA'],
  },
  {
    id: 'MLS',
    name: 'MLS',
    pageNumber: 1,
    slug: 'mls',
    aliases: ['Major League Soccer'],
  },
  {
    id: 'Other Leagues',
    name: 'Other Leagues',
    pageNumber: 2,
    slug: 'other-leagues',
    aliases: ['OTHER LEAGUES', 'Other League'],
  },
  {
    id: 'International Teams',
    name: 'International Teams',
    pageNumber: 2,
    slug: 'international-teams',
    aliases: [
      'INTERNATIONAL TEAMS',
      'International',
      'World Cup',
      'World Cup Vault',
      'National Teams',
    ],
  },
  {
    id: 'Clearance',
    name: 'Catalog',
    pageNumber: 3,
    slug: 'catalog',
    aliases: ['OUTLET', 'Outlet', 'Catalog', 'Sale', 'Clearance Vault', 'Clearance'],
  },
];

/** Top leagues shown as dedicated nav pages — everything else falls under Other Leagues. */
export const PRIMARY_LEAGUE_IDS = [
  'Premier League',
  'La Liga',
  'Ligue 1',
  'Serie A',
  'Bundesliga',
  'MLS',
] as const;

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

function productLeagueLabel(product: Product): string {
  return String(product.league || product.category || '').trim();
}

function isPrimaryLeagueLabel(value: string): boolean {
  const resolved = resolveStorefrontPage(value);
  if (resolved && (PRIMARY_LEAGUE_IDS as readonly string[]).includes(resolved.id)) {
    return true;
  }
  return (PRIMARY_LEAGUE_IDS as readonly string[]).some((id) => storefrontLabelsMatch(id, value));
}

/**
 * Product belongs on a nav / listing destination.
 * Explicit Target Page / pageName wins; league / category is fallback.
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

  if (filterPage?.id === 'Other Leagues') {
    const league = productLeagueLabel(product);
    if (!league) return false;
    if (resolveStorefrontPage(league)?.id === 'International Teams') return false;
    if (isPrimaryLeagueLabel(league)) return false;
    if (/world\s*cup|international|national/i.test(league)) return false;
    return Boolean(league);
  }

  if (filterPage?.id === 'International Teams') {
    const fields = [
      product.league,
      product.category,
      product.country,
      product.club,
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    return fields.some(
      (f) =>
        storefrontLabelsMatch(f, 'International Teams') ||
        /world\s*cup|international|national team/i.test(f),
    );
  }

  if (filterPage && (PRIMARY_LEAGUE_IDS as readonly string[]).includes(filterPage.id)) {
    const league = productLeagueLabel(product);
    if (league && storefrontLabelsMatch(league, filterPage.id)) return true;
    const cat = String(product.category || '').trim();
    if (cat && storefrontLabelsMatch(cat, filterPage.id)) return true;
    return false;
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
  international: [
    'international',
    'international teams',
    'world cup',
    'world cup vault',
    'national',
  ],
  training: ['training', 'pre match', 'pre-match', 'warmup'],
  retro: ['retro', 'legends', 'retro store'],
  'retro store': ['retro', 'legends', 'retro store'],
  outlet: ['outlet', 'clearance', 'sale', 'catalog'],
  clearance: ['outlet', 'clearance', 'sale', 'catalog'],
  catalog: ['outlet', 'clearance', 'sale', 'catalog'],
};

/**
 * Listing sidebar / nav page filter.
 * Storefront nav pages use target-page + league rules;
 * other labels match category / categoryRow with aliases.
 */
export function productMatchesListingCategory(
  product: Product,
  filter: string,
): boolean {
  if (!filter || filter === 'All') return true;

  // Nav destination pages — target-page + league matching
  if (resolveStorefrontPage(filter)) {
    return productMatchesStorefrontFilter(product, filter);
  }

  const key = norm(filter);
  const aliases = new Set([key, ...(LISTING_CATEGORY_ALIASES[key] || [])]);

  const fields = [
    product.category,
    product.pageName,
    product.targetPage,
    product.league,
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
    'Premier League',
    'La Liga',
    'Ligue 1',
    'Serie A',
    'Bundesliga',
    'MLS',
  ]) {
    names.add(core);
  }
  return [...names];
}
