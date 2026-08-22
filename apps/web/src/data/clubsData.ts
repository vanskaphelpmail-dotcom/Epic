export interface ClubCatalogItem {
  id: string;
  name: string;
  /** Search / listing filter keyword */
  categoryId: string;
  /** Best storefront search query when the card is clicked */
  searchQuery: string;
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
    logoUrl: '/logos/real-madrid.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-barcelona',
    name: 'FC Barcelona',
    categoryId: 'Barcelona',
    searchQuery: 'Barcelona',
    logoUrl: '/logos/fc-barcelona.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-manchester-united',
    name: 'Manchester United',
    categoryId: 'Manchester United',
    searchQuery: 'Manchester United',
    logoUrl: '/logos/manchester-united.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-liverpool',
    name: 'Liverpool',
    categoryId: 'Liverpool',
    searchQuery: 'Liverpool',
    logoUrl: '/logos/liverpool.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-arsenal',
    name: 'Arsenal',
    categoryId: 'Arsenal',
    searchQuery: 'Arsenal',
    logoUrl: '/logos/arsenal.png?v=3',
    status: 'Active',
  },
  {
    id: 'club-bayern',
    name: 'Bayern Munich',
    categoryId: 'Bayern',
    searchQuery: 'Bayern',
    logoUrl: '/logos/bayern-munich.png?v=3',
    status: 'Active',
  },
];
