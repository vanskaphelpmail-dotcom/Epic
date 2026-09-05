export interface LeagueCatalogItem {
  id: string;
  name: string;
  categoryId: string;
  count: number;
  /** Best storefront search query when the card is clicked */
  searchQuery?: string;
  /** CSS/SVG mark key used by LeagueLogo */
  mark: 'premier' | 'laliga' | 'seriea' | 'bundesliga' | 'ligue1' | 'mls' | 'worldcup' | 'bangladesh';
  /** Optional remote/custom logo URL managed via admin */
  logoUrl?: string;
  status: 'Active' | 'Inactive';
}

export const DEFAULT_LEAGUES: LeagueCatalogItem[] = [
  {
    id: 'league-premier',
    name: 'Premier League',
    categoryId: 'Premier League',
    searchQuery: 'Premier League',
    count: 18,
    mark: 'premier',
    logoUrl: '/logos/premier-league.png?v=3',
    status: 'Active',
  },
  {
    id: 'league-laliga',
    name: 'La Liga',
    categoryId: 'La Liga',
    searchQuery: 'La Liga',
    count: 14,
    mark: 'laliga',
    logoUrl: '/logos/la-liga.png?v=3',
    status: 'Active',
  },
  {
    id: 'league-seriea',
    name: 'Serie A',
    categoryId: 'Serie A',
    searchQuery: 'Serie A',
    count: 12,
    mark: 'seriea',
    logoUrl: '/logos/serie-a.png?v=3',
    status: 'Active',
  },
  {
    id: 'league-bundesliga',
    name: 'Bundesliga',
    categoryId: 'Bundesliga',
    searchQuery: 'Bundesliga',
    count: 8,
    mark: 'bundesliga',
    logoUrl: '/logos/bundesliga.png?v=3',
    status: 'Active',
  },
  {
    id: 'league-ligue1',
    name: 'Ligue 1',
    categoryId: 'Ligue 1',
    searchQuery: 'Ligue 1',
    count: 10,
    mark: 'ligue1',
    logoUrl: '/logos/ligue-1.png?v=3',
    status: 'Active',
  },
  {
    id: 'league-mls',
    name: 'MLS',
    categoryId: 'MLS',
    searchQuery: 'MLS',
    count: 8,
    mark: 'mls',
    logoUrl: '/logos/mls.png?v=3',
    status: 'Active',
  },
];
