export interface ClubCatalogItem {
  id: string;
  name: string;
  /** Search / listing filter keyword */
  categoryId: string;
  /** Best storefront search query when the card is clicked */
  searchQuery: string;
  /** Fallback / display count when live catalog match is empty */
  count: number;
  logoUrl: string;
  status: 'Active' | 'Inactive';
}

/** ?v=3 busts cache after white-background logo processing */
export const DEFAULT_CLUBS: ClubCatalogItem[] = [
  {
    id: 'club-real-madrid',
    name: 'Real Madrid',
    categoryId: 'Real Madrid',
    searchQuery: 'Real Madrid',
    count: 25,
    logoUrl: '/logos/real-madrid.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-barcelona',
    name: 'FC Barcelona',
    categoryId: 'Barcelona',
    searchQuery: 'Barcelona',
    count: 22,
    logoUrl: '/logos/fc-barcelona.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-manchester-united',
    name: 'Manchester United',
    categoryId: 'Manchester United',
    searchQuery: 'Manchester United',
    count: 9,
    logoUrl: '/logos/manchester-united.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-liverpool',
    name: 'Liverpool',
    categoryId: 'Liverpool',
    searchQuery: 'Liverpool',
    count: 9,
    logoUrl: '/logos/liverpool.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-arsenal',
    name: 'Arsenal',
    categoryId: 'Arsenal',
    searchQuery: 'Arsenal',
    count: 5,
    logoUrl: '/logos/arsenal.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-bayern',
    name: 'Bayern Munich',
    categoryId: 'Bayern',
    searchQuery: 'Bayern',
    count: 2,
    logoUrl: '/logos/bayern-munich.png?v=3',
    status: 'Active',
  },
];

/** Name aliases used to predict clubs from jersey titles / club fields */
const CLUB_NAME_ALIASES: Record<string, string[]> = {
  'real madrid': ['real madrid', 'madrid'],
  'fc barcelona': ['fc barcelona', 'barcelona', 'barca'],
  barcelona: ['barcelona', 'barca', 'fc barcelona'],
  'manchester united': ['manchester united', 'man united', 'man utd', 'manu'],
  liverpool: ['liverpool'],
  arsenal: ['arsenal'],
  'bayern munich': ['bayern munich', 'bayern', 'fc bayern', 'munchen', 'münchen'],
  bayern: ['bayern', 'bayern munich', 'fc bayern'],
  'manchester city': ['manchester city', 'man city', 'mcfc'],
  chelsea: ['chelsea'],
  tottenham: ['tottenham', 'spurs'],
  'ac milan': ['ac milan', 'milan'],
  inter: ['inter milan', 'inter'],
  juventus: ['juventus', 'juve'],
  psg: ['psg', 'paris saint-germain', 'paris saint germain'],
  'borussia dortmund': ['borussia dortmund', 'dortmund', 'bvb'],
  ajax: ['ajax'],
};

export function normalizeClubShowcase(
  clubs: ClubCatalogItem[] | null | undefined,
): ClubCatalogItem[] {
  if (!Array.isArray(clubs) || clubs.length === 0) return DEFAULT_CLUBS.map((c) => ({ ...c }));
  return clubs
    .map((c, i) => ({
      id: String(c.id || `club-${i + 1}`).trim() || `club-${i + 1}`,
      name: String(c.name || '').trim() || `Club ${i + 1}`,
      categoryId: String(c.categoryId || c.name || '').trim(),
      searchQuery: String(c.searchQuery || c.name || '').trim(),
      count: Math.max(0, Math.round(Number(c.count) || 0)),
      logoUrl: String(c.logoUrl || '').trim(),
      status: c.status === 'Inactive' ? ('Inactive' as const) : ('Active' as const),
    }))
    .filter((c) => c.name);
}

type JerseyLike = {
  name?: string;
  club?: string;
  brand?: string;
  nationalTeam?: string;
  tags?: string[];
  status?: string;
  isTrashed?: boolean;
  isArchived?: boolean;
};

function jerseyHaystack(p: JerseyLike): string {
  return [
    p.name,
    p.club,
    p.nationalTeam,
    p.brand,
    ...(Array.isArray(p.tags) ? p.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function clubMatchScore(hay: string, club: ClubCatalogItem): number {
  const keys = [
    club.name,
    club.searchQuery,
    club.categoryId,
    ...(CLUB_NAME_ALIASES[club.name.toLowerCase()] || []),
    ...(CLUB_NAME_ALIASES[club.searchQuery.toLowerCase()] || []),
  ]
    .map((k) => String(k || '').toLowerCase().trim())
    .filter((k) => k.length >= 3);

  let best = 0;
  for (const key of keys) {
    if (!hay.includes(key)) continue;
    best = Math.max(best, key.length >= 8 ? 3 : key.length >= 5 ? 2 : 1);
  }
  return best;
}

/**
 * Predict club logo carousel entries from live jersey names (+ club/tags).
 * Ranks by how often each club appears in the catalog; keeps logo URLs from admin/defaults.
 */
export function predictClubsFromJerseys(
  products: JerseyLike[],
  catalogClubs?: ClubCatalogItem[] | null,
): ClubCatalogItem[] {
  const catalog = normalizeClubShowcase(catalogClubs);
  const activeProducts = products.filter(
    (p) =>
      !p.isTrashed &&
      !p.isArchived &&
      (!p.status || p.status === 'Active' || p.status === 'Draft'),
  );

  const scored = catalog
    .filter((c) => c.status === 'Active')
    .map((club) => {
      let hits = 0;
      let weight = 0;
      for (const p of activeProducts) {
        const score = clubMatchScore(jerseyHaystack(p), club);
        if (score > 0) {
          hits += 1;
          weight += score;
        }
      }
      return {
        club: {
          ...club,
          count: hits > 0 ? hits : club.count,
          searchQuery: club.searchQuery || club.name,
        },
        hits,
        weight,
      };
    });

  const predicted = scored
    .filter((row) => row.hits > 0)
    .sort((a, b) => b.weight - a.weight || b.hits - a.hits || a.club.name.localeCompare(b.club.name))
    .map((row) => row.club);

  const predictedIds = new Set(predicted.map((c) => c.id));
  const fillers = scored
    .filter((row) => !predictedIds.has(row.club.id) && row.club.logoUrl)
    .map((row) => row.club);

  const merged = [...predicted, ...fillers];
  return merged.length > 0 ? merged : DEFAULT_CLUBS.map((c) => ({ ...c }));
}
