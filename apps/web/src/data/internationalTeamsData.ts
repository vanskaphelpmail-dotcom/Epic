export interface InternationalTeamCatalogItem {
  id: string;
  name: string;
  /** Search / listing filter keyword */
  categoryId: string;
  /** Best storefront search query when the card is clicked */
  searchQuery: string;
  flagUrl: string;
  status: 'Active' | 'Inactive';
}

/** National team cards for SHOP BY INTERNATIONAL TEAM (?v=1 cache bust) */
export const DEFAULT_INTERNATIONAL_TEAMS: InternationalTeamCatalogItem[] = [
  {
    id: 'team-argentina',
    name: 'Argentina',
    categoryId: 'Argentina',
    searchQuery: 'Argentina',
    flagUrl: '/logos/flags/argentina.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-brazil',
    name: 'Brazil',
    categoryId: 'Brazil',
    searchQuery: 'Brazil',
    flagUrl: '/logos/flags/brazil.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-france',
    name: 'France',
    categoryId: 'France',
    searchQuery: 'France',
    flagUrl: '/logos/flags/france.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-germany',
    name: 'Germany',
    categoryId: 'Germany',
    searchQuery: 'Germany',
    flagUrl: '/logos/flags/germany.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-spain',
    name: 'Spain',
    categoryId: 'Spain',
    searchQuery: 'Spain',
    flagUrl: '/logos/flags/spain.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-portugal',
    name: 'Portugal',
    categoryId: 'Portugal',
    searchQuery: 'Portugal',
    flagUrl: '/logos/flags/portugal.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-italy',
    name: 'Italy',
    categoryId: 'Italy',
    searchQuery: 'Italy',
    flagUrl: '/logos/flags/italy.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-england',
    name: 'England',
    categoryId: 'England National',
    /** Distinct query so listing search uses national-team matcher, not BD Classic page id */
    searchQuery: 'England',
    flagUrl: '/logos/flags/england.png?v=2',
    status: 'Active',
  },
  {
    id: 'team-netherlands',
    name: 'Netherlands',
    categoryId: 'Netherlands',
    searchQuery: 'Netherlands',
    flagUrl: '/logos/flags/netherlands.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-japan',
    name: 'Japan',
    categoryId: 'Japan',
    searchQuery: 'Japan',
    flagUrl: '/logos/flags/japan.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-belgium',
    name: 'Belgium',
    categoryId: 'Belgium',
    searchQuery: 'Belgium',
    flagUrl: '/logos/flags/belgium.png?v=1',
    status: 'Active',
  },
  {
    id: 'team-croatia',
    name: 'Croatia',
    categoryId: 'Croatia',
    searchQuery: 'Croatia',
    flagUrl: '/logos/flags/croatia.png?v=1',
    status: 'Active',
  },
];
