import type { Product } from '../types';
import { resolveStorefrontPage } from './storefrontPages';

/**
 * Storefront destination fields often use legacy ids (e.g. England → Bangladesh Classic).
 * Prefer the display name in search text so national-team queries like "England"
 * do not match the entire Bangladesh Classic catalog.
 */
function storefrontSearchLabel(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const page = resolveStorefrontPage(raw);
  if (page) return `${page.name} ${page.slug}`.toLowerCase();
  return raw.toLowerCase();
}

/** Build a searchable haystack from catalog product fields (DB-backed keywords). */
export function productSearchText(product: Product): string {
  return [
    product.name,
    product.brand,
    storefrontSearchLabel(product.category),
    product.sku,
    product.club,
    product.country,
    product.nationalTeam,
    product.league,
    product.season,
    product.shortDescription,
    product.description,
    product.player?.name,
    storefrontSearchLabel(product.targetPage),
    storefrontSearchLabel(product.pageName),
    product.color,
    String(product.year || ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Normalize query tokens — "man city" / "barcelona jersey" → tokens. */
export function tokenizeSearchQuery(query: string): string[] {
  return String(query || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s+/.-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Known club / league name aliases for card-click + search matching */
const QUERY_ALIASES: Record<string, string[]> = {
  'premier league': ['premier league', 'premier', 'epl'],
  'la liga': ['la liga', 'laliga'],
  'serie a': ['serie a', 'seriea'],
  bundesliga: ['bundesliga'],
  'ligue 1': ['ligue 1', 'ligue1'],
  mls: ['mls', 'major league soccer'],
  'real madrid': ['real madrid', 'madrid'],
  barcelona: ['barcelona', 'barca', 'fc barcelona'],
  'manchester united': ['manchester united', 'man united', 'man utd'],
  liverpool: ['liverpool'],
  arsenal: ['arsenal'],
  bayern: ['bayern', 'bayern munich', 'munchen', 'münchen'],
  argentina: ['argentina', 'albiceleste'],
  brazil: ['brazil', 'brasil', 'selecao'],
  france: ['france', 'les bleus'],
  germany: ['germany', 'deutschland', 'dfb'],
  spain: ['spain', 'espana', 'españa', 'la roja'],
  portugal: ['portugal', 'selecao portuguesa'],
  italy: ['italy', 'italia', 'azzurri'],
  england: ['england', 'three lions'],
  netherlands: ['netherlands', 'holland', 'oranje', 'dutch'],
  japan: ['japan', 'nippon', 'samurai blue'],
  belgium: ['belgium', 'belgie', 'belgique'],
  croatia: ['croatia', 'hrvatska'],
};

/** Match international-team cards by jersey name (and club when it is the national side).
 * Same idea as search: "Argentina" / "Brazil" / "Spain" in the product name.
 * Does not use country or default nationalTeam (those inflated England to the full catalog). */
export function productMatchesNationalTeam(product: Product, teamName: string): boolean {
  const key = String(teamName || '')
    .toLowerCase()
    .trim();
  if (!key) return true;

  // Prefer the primary country name first; skip very weak one-word aliases for matching
  const weakAlias = new Set(['dutch', 'oranje', 'dfb', 'nippon']);
  const aliases = [key, ...(QUERY_ALIASES[key] || [])]
    .map((a) => a.toLowerCase().trim())
    .filter((a) => a.length >= 4 && !weakAlias.has(a));

  const name = String(product.name || '').toLowerCase();
  const club = String(product.club || '')
    .toLowerCase()
    .trim();
  const nationalTeam = String(product.nationalTeam || '')
    .toLowerCase()
    .trim();

  const nameHasTeam = (alias: string) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(name);
  };

  for (const alias of aliases) {
    // Primary: jersey title contains the country / team name
    if (name && nameHasTeam(alias)) return true;
    // Club field is the national side (e.g. club: "Argentina")
    if (club === alias) return true;
  }

  // Explicit nationalTeam only when club is empty or also the national side
  // (avoids default nationalTeam="England" on Premier League club kits)
  if (aliases.some((a) => nationalTeam === a) && (!club || aliases.some((a) => club === a))) {
    return true;
  }

  return false;
}

/** True when every query token appears in the product's searchable fields. */
export function productMatchesSearchQuery(product: Product, query: string): boolean {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return true;

  // International team names: match country/team/name only (not Bangladesh Classic page id "England")
  const nationalTeams = new Set([
    'argentina',
    'brazil',
    'france',
    'germany',
    'spain',
    'portugal',
    'italy',
    'england',
    'netherlands',
    'holland',
    'japan',
    'belgium',
    'croatia',
  ]);
  if (nationalTeams.has(q)) {
    return productMatchesNationalTeam(product, q);
  }

  const hay = productSearchText(product);
  if (hay.includes(q)) return true;

  const aliasList = QUERY_ALIASES[q] || [q];
  for (const alias of aliasList) {
    if (hay.includes(alias)) return true;
    const tokens = tokenizeSearchQuery(alias);
    if (tokens.length > 0 && tokens.every((t) => hay.includes(t))) return true;
  }

  const tokens = tokenizeSearchQuery(q);
  if (!tokens.length) return false;
  return tokens.every((t) => hay.includes(t));
}

const STOP = new Set([
  'the',
  'and',
  'for',
  'with',
  'jersey',
  'kit',
  'home',
  'away',
  'shirt',
  'edition',
  'classic',
  'retro',
  'season',
  'official',
]);

/**
 * Popular / suggestion keywords derived from live catalog (clubs, teams, names).
 * Falls back to curated seeds when the catalog is empty.
 */
export function buildCatalogSearchKeywords(
  products: Product[],
  limit = 16,
): string[] {
  const counts = new Map<string, number>();

  const bump = (raw?: string | null, weight = 1) => {
    const v = String(raw || '').trim();
    if (v.length < 3) return;
    const key = v.replace(/\s+/g, ' ');
    const lower = key.toLowerCase();
    if (STOP.has(lower)) return;
    counts.set(key, (counts.get(key) || 0) + weight);
  };

  for (const p of products) {
    if (p.status && p.status !== 'Active') continue;
    if (p.isTrashed || p.isArchived) continue;
    bump(p.club, 3);
    bump(p.nationalTeam || p.country, 3);
    bump(p.league, 2);
    bump(p.brand, 1);
    bump(p.player?.name, 2);
    // Short product-name phrases (e.g. "Barcelona", "Argentina 1986")
    const name = String(p.name || '').trim();
    if (name) {
      bump(name, 2);
      const parts = name.split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w.toLowerCase()));
      if (parts[0]) bump(parts[0], 1);
      if (parts.length >= 2) bump(`${parts[0]} ${parts[1]}`, 2);
    }
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k]) => k);

  const seeds = [
    'Barcelona',
    'Real Madrid',
    'Argentina',
    'Brazil',
    'Manchester City',
    'Manchester United',
    'Messi',
    'Ronaldo',
    'England',
    'Spain',
    'Arsenal',
    'Germany',
  ];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const term of [...ranked, ...seeds]) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}

/** Live typeahead matches from catalog while typing. */
export function suggestProductsForQuery(
  products: Product[],
  query: string,
  limit = 8,
): Product[] {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  return products
    .filter(
      (p) =>
        (!p.status || p.status === 'Active') &&
        !p.isTrashed &&
        !p.isArchived &&
        productMatchesSearchQuery(p, q),
    )
    .slice(0, limit);
}
