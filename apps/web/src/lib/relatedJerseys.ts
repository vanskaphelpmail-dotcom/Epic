import type { Product } from '../types';
import { getProductCategories, inferSizeChartId } from './sizeCharts';

/** UI shows 4 related cards — keep algorithm aligned with ProductDetails. */
export const RELATED_JERSEYS_LIMIT = 4;

const SCORE = {
  sameTeam: 100,
  sameEdition: 80,
  sameSeason: 60,
  sameCollection: 45,
  sameKitType: 35,
  sameLeague: 25,
  sameCountry: 15,
  sameCompetition: 10,
  /** Soft nudge so same-season peers rank above older same-team stock when scores tie. */
  seasonTieBreak: 5,
} as const;

type EditionKey = 'player' | 'fan' | 'retro' | 'custom' | 'kids' | 'other';
type KitType = 'home' | 'away' | 'third' | 'fourth' | 'gk' | 'training' | 'other';

function normalizeKey(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse "FC Barcelona" / "Barcelona CF" → comparable keys. */
function normalizeTeamKey(value: string | null | undefined): string {
  let key = normalizeKey(value);
  if (!key) return '';
  key = key
    .replace(/^(fc|cf|sc|ac|as|ssc|afc|cfc|rcd|ud|cd|sd)\s+/i, '')
    .replace(/\s+(fc|cf|sc|ac|afc|cfc)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Common short forms
  if (key === 'barca' || key === 'barça') return 'barcelona';
  if (key === 'man utd' || key === 'man united' || key === 'manchester utd') return 'manchester united';
  if (key === 'man city' || key === 'manchester city fc') return 'manchester city';
  if (key === 'inter' || key === 'inter milan' || key === 'fc internazionale') return 'inter milan';
  if (key === 'psg' || key === 'paris sg') return 'paris saint germain';
  if (key === 'bayern' || key === 'bayern munchen' || key === 'fc bayern') return 'bayern munich';
  if (key === 'atletico' || key === 'atletico de madrid' || key === 'atm') return 'atletico madrid';
  if (key === 'real' && value && /real\s+madrid/i.test(String(value))) return 'real madrid';
  return key;
}

function teamsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  // Avoid weak substring hits ("united" matching every United club)
  if (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

const KIT_MARKERS =
  /\b(home|away|third|4th|fourth|goalkeeper|gk|training|pre[\s-]?match|player|fan|retro|kit|jersey|edition)\b/i;

/** Infer club/national side from product title when club field is empty. */
function inferTeamFromName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const primary = raw.split(/[—–|]/)[0]?.trim() || raw;
  const cut = primary.search(KIT_MARKERS);
  const candidate = (cut > 0 ? primary.slice(0, cut) : primary).trim();
  // Drop trailing season fragments accidentally left in
  return candidate.replace(/\s+\d{4}(\s*\/\s*\d{2,4})?\s*$/u, '').trim();
}

function productTeamKey(product: Product): string {
  const fromClub = normalizeTeamKey(product.club);
  if (fromClub) return fromClub;
  const fromNational = normalizeTeamKey(product.nationalTeam);
  if (fromNational) return fromNational;
  return normalizeTeamKey(inferTeamFromName(product.name));
}

/** Normalize "2026/2027", "2026-27", "2026/27" → "2026/27". */
export function normalizeSeasonKey(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const m = raw.match(/(\d{4})\s*[/\-–—]\s*(\d{2,4})/);
  if (m) {
    const start = m[1];
    const endRaw = m[2];
    const end = endRaw.length === 2 ? `${start.slice(0, 2)}${endRaw}` : endRaw;
    return `${start}/${end.slice(-2)}`;
  }
  const yearOnly = raw.match(/\b(19|20)\d{2}\b/);
  if (yearOnly) return yearOnly[0];
  return normalizeKey(raw);
}

function productSeasonKey(product: Product): string {
  const fromSeason = normalizeSeasonKey(product.season);
  if (fromSeason) return fromSeason;
  if (product.year && product.year > 1900) return String(product.year);
  return normalizeSeasonKey(product.name);
}

function editionFromText(text: string): EditionKey | '' {
  const key = normalizeKey(text);
  if (!key) return '';
  if (key.includes('player')) return 'player';
  if (key.includes('fan') || key.includes('replica')) return 'fan';
  if (
    key.includes('retro') ||
    key.includes('vintage') ||
    key.includes('classic') ||
    key.includes('legend') ||
    key.includes('historical')
  ) {
    return 'retro';
  }
  if (key.includes('custom')) return 'custom';
  if (key.includes('kid') || key.includes('junior') || key.includes('youth')) return 'kids';
  return '';
}

function chartIdToEdition(chartId: string | null | undefined): EditionKey | '' {
  const id = normalizeKey(chartId).replace(/\s+/g, '-');
  if (id === 'player-edition' || id.includes('player')) return 'player';
  if (id === 'fan-edition' || id.includes('fan')) return 'fan';
  if (id === 'retro' || id.includes('retro')) return 'retro';
  if (id === 'custom' || id.includes('custom')) return 'custom';
  if (id === 'kids' || id.includes('kid')) return 'kids';
  return '';
}

function productEditionKey(product: Product): EditionKey {
  const charts = [
    ...(Array.isArray(product.sizeChartIds) ? product.sizeChartIds : []),
    product.sizeChartId,
  ].filter(Boolean) as string[];
  for (const id of charts) {
    const fromChart = chartIdToEdition(id);
    if (fromChart) return fromChart;
  }

  const cats = getProductCategories(product);
  for (const c of cats) {
    const fromCat = editionFromText(c) || chartIdToEdition(inferSizeChartId(c));
    if (fromCat) return fromCat;
  }

  const fromCategory = editionFromText(product.category) || chartIdToEdition(inferSizeChartId(product.category));
  if (fromCategory) return fromCategory;

  const fromName = editionFromText(product.name);
  if (fromName) return fromName;

  const fromTags = (product.tags || []).map(editionFromText).find(Boolean);
  if (fromTags) return fromTags;

  return 'other';
}

function productKitType(product: Product): KitType {
  const hay = normalizeKey(`${product.name} ${product.color || ''} ${(product.tags || []).join(' ')}`);
  if (/\b(goalkeeper|gk)\b/.test(hay)) return 'gk';
  if (/\b(training|pre match|prematch)\b/.test(hay)) return 'training';
  if (/\b(fourth|4th)\b/.test(hay)) return 'fourth';
  if (/\bthird\b/.test(hay)) return 'third';
  if (/\baway\b/.test(hay)) return 'away';
  if (/\bhome\b/.test(hay)) return 'home';
  return 'other';
}

function productLeagueKey(product: Product): string {
  const league = normalizeKey(product.league);
  if (league) return league;
  // Fall back to category when it looks like a league label
  const cat = normalizeKey(product.category);
  if (
    /liga|premier|serie|bundesliga|ligue|mls|championship|eredivisie|liga mx|saudi|world cup/.test(
      cat,
    )
  ) {
    return cat.replace(/\s+/g, ' ');
  }
  return '';
}

function productCountryKey(product: Product): string {
  return normalizeKey(product.country);
}

function productCollections(product: Product): Set<string> {
  const out = new Set<string>();
  for (const c of getProductCategories(product)) {
    const k = normalizeKey(c);
    if (k) out.add(k);
  }
  const target = normalizeKey(product.targetPage || product.pageName);
  if (target) out.add(target);
  return out;
}

function collectionOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) {
    if (b.has(x)) return true;
  }
  return false;
}

function isStorefrontEligible(product: Product): boolean {
  if (product.isTrashed || product.isArchived) return false;
  if (product.status && product.status !== 'Active') return false;
  if (product.category === 'Mystery' || /mystery/i.test(product.name || '')) return false;
  return true;
}

function productRecencyMs(product: Product): number {
  const raw = product.updatedAt || product.createdAt;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : 0;
}

export function scoreRelatedJersey(current: Product, candidate: Product): number {
  if (!current || !candidate || current.id === candidate.id) return -1000;

  const curTeam = productTeamKey(current);
  const candTeam = productTeamKey(candidate);
  const sameTeam = Boolean(curTeam && candTeam && teamsMatch(curTeam, candTeam));

  const curEdition = productEditionKey(current);
  const candEdition = productEditionKey(candidate);
  const sameEdition =
    curEdition !== 'other' && candEdition !== 'other' && curEdition === candEdition;

  const curSeason = productSeasonKey(current);
  const candSeason = productSeasonKey(candidate);
  const sameSeason = Boolean(curSeason && candSeason && curSeason === candSeason);

  const curLeague = productLeagueKey(current);
  const candLeague = productLeagueKey(candidate);
  const sameLeague = Boolean(curLeague && candLeague && curLeague === candLeague);

  const curCountry = productCountryKey(current);
  const candCountry = productCountryKey(candidate);
  const sameCountry = Boolean(curCountry && candCountry && curCountry === candCountry);

  const sameKit =
    productKitType(current) !== 'other' &&
    productKitType(current) === productKitType(candidate);

  const sameCollection = collectionOverlap(productCollections(current), productCollections(candidate));

  const curComp = curLeague || normalizeKey((current.tags || []).join(' '));
  const candComp = candLeague || normalizeKey((candidate.tags || []).join(' '));
  const sameCompetition =
    Boolean(curLeague && candLeague && curLeague === candLeague) ||
    (/\bworld cup\b/.test(curComp) && /\bworld cup\b/.test(candComp));

  let score = 0;
  if (sameTeam) score += SCORE.sameTeam;
  if (sameEdition) score += SCORE.sameEdition;
  if (sameSeason) score += SCORE.sameSeason;
  if (sameCollection) score += SCORE.sameCollection;
  if (sameKit) score += SCORE.sameKitType;
  if (sameLeague) score += SCORE.sameLeague;
  if (sameCountry) score += SCORE.sameCountry;
  if (sameCompetition) score += SCORE.sameCompetition;
  if (sameTeam && sameSeason) score += SCORE.seasonTieBreak;

  return score;
}

function isSameTeam(current: Product, candidate: Product): boolean {
  const a = productTeamKey(current);
  const b = productTeamKey(candidate);
  return Boolean(a && b && teamsMatch(a, b));
}

/**
 * Team → edition → season → league recommendation list for the product details page.
 * Excludes the current product and storefront-ineligible items. Does not mutate inputs.
 */
export function getRelatedJerseys(
  current: Product | null | undefined,
  catalog: Product[],
  limit: number = RELATED_JERSEYS_LIMIT,
): Product[] {
  if (!current || !Array.isArray(catalog) || limit <= 0) return [];

  const ranked = catalog
    .filter((p) => p && p.id !== current.id && isStorefrontEligible(p))
    .map((product) => ({
      product,
      sameTeam: isSameTeam(current, product),
      score: scoreRelatedJersey(current, product),
      recency: productRecencyMs(product),
      year: Number(product.year) || 0,
    }))
    .sort((a, b) => {
      // Hard rule: any same-team product beats every other club
      if (a.sameTeam !== b.sameTeam) return a.sameTeam ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      if (b.recency !== a.recency) return b.recency - a.recency;
      if (b.year !== a.year) return b.year - a.year;
      return String(b.product.id).localeCompare(String(a.product.id));
    });

  const seen = new Set<string>();
  const out: Product[] = [];
  for (const row of ranked) {
    if (seen.has(row.product.id)) continue;
    seen.add(row.product.id);
    out.push(row.product);
    if (out.length >= limit) break;
  }
  return out;
}
