/** The Ouds catalog seed data — selling prices from store listings. */
export type CatalogProduct = {
  name: string;
  brand: string;
  category: string;
  size?: string;
  sellingPrice: number;
  purchasePrice?: number;
  stockQuantity?: number;
  image?: string;
};

export const CATALOG: CatalogProduct[] = [
  {
    name: 'Ansaam Gold Perfume 100ml EDP Lattafa Pride',
    brand: 'Lattafa Pride',
    category: "Women's Perfume",
    size: '100ml',
    sellingPrice: 32.95,
    purchasePrice: 13.85,
    stockQuantity: 30,
    image: '/products/ansaam-gold.png'
  },
  { name: 'Pinnace Perfume 100ml EDP French Avenue by Fragrance World', brand: 'French Avenue', category: "Women's Perfume", size: '100ml', sellingPrice: 39.95 },
  { name: 'Summer Pink EDP 100ml Perfume By Reef', brand: 'Reef', category: "Women's Perfume", size: '100ml', sellingPrice: 64.95 },
  { name: 'Imperial Valley Unisex Eau De Parfum 200ml Signature Collection By Gissah', brand: 'Gissah', category: 'Unisex Perfume', size: '200ml', sellingPrice: 135 },
  { name: 'Osma Bonsoir', brand: 'OSMA', category: 'Perfume', size: '100ml', sellingPrice: 60 },
  { name: 'Osma M Perfume', brand: 'OSMA', category: 'Perfume', size: '100ml', sellingPrice: 60 },
  { name: 'Osma Rouge', brand: 'OSMA', category: 'Perfume', size: '100ml', sellingPrice: 60 },
  { name: 'Osma Noir Perfume', brand: 'OSMA', category: 'Perfume', size: '100ml', sellingPrice: 60 },
  { name: 'Dirham Oud Ard Al Zaafaran for women and men', brand: 'Ard Al Zaafaran', category: 'Unisex Perfume', size: '100ml', sellingPrice: 17.95 },
  { name: 'Ramz Lattafa Gold Perfume 100ml EDP Lattafa', brand: 'Lattafa', category: 'Perfume', size: '100ml', sellingPrice: 18.95 },
  { name: 'Teriaq Intense Perfume 100ml EDP Lattafa', brand: 'Lattafa', category: 'Perfume', size: '100ml', sellingPrice: 38, stockQuantity: 0 },
  { name: 'Victoria Perfume by Lattafa 100ml EDP', brand: 'Lattafa', category: "Women's Perfume", size: '100ml', sellingPrice: 34.95 },
  { name: 'Al Qiam Silver Perfume 100ml EDP Lattafa Pride', brand: 'Lattafa Pride', category: "Men's Perfume", size: '100ml', sellingPrice: 35 },
  { name: 'Freeze Extrait de Parfum 100ml Riiffs', brand: 'Riiffs', category: "Men's Perfume", size: '100ml', sellingPrice: 34.95 },
  { name: 'Pinnace Oryn Perfume 100ml EDP French Avenue By Fragrance World', brand: 'French Avenue', category: "Men's Perfume", size: '100ml', sellingPrice: 39.95 },
  { name: 'Hawas Elixir Perfume 100ml EDP Rasasi', brand: 'Rasasi', category: "Men's Perfume", size: '100ml', sellingPrice: 42.95 },
  {
    name: 'Bujairami Non Stop 100ml Extrait De Parfum Bujairami Sydney',
    brand: 'Non Stop',
    category: "Men's Perfume",
    size: '100ml',
    sellingPrice: 52.95,
    purchasePrice: 22.5,
    stockQuantity: 20,
    image: '/products/bujairami-non-stop.png'
  },
  { name: 'Bujairami Hectic Extrait de Parfum 100ml Bujairami Sydney', brand: 'Bujairami', category: "Men's Perfume", size: '100ml', sellingPrice: 52.95 },
  { name: '9pm Night Out 100ml Extrait De Parfum by Afnan', brand: 'Afnan', category: "Men's Perfume", size: '100ml', sellingPrice: 46.95 },
  { name: 'Khamrah Waha Eau de Parfum 100ml by Lattafa', brand: 'Lattafa', category: 'Unisex Perfume', size: '100ml', sellingPrice: 45.9 }
];

export function randomCost(sellingPrice: number) {
  const ratio = 0.38 + Math.random() * 0.27; // 38%–65% of sell price
  return Math.round(sellingPrice * ratio * 100) / 100;
}

export function randomStock(forced?: number) {
  if (typeof forced === 'number') return forced;
  return Math.floor(Math.random() * 36) + 2; // 2–37
}
