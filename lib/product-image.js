/** Dummy / featured product photos under /public/products */
const FEATURED_IMAGES = [
  {
    match: (p) =>
      /non\s*stop/i.test(p?.name || '') ||
      /non\s*stop/i.test(p?.brand || '') ||
      p?.sku === 'TOU-NONSTOP' ||
      p?.sku === 'TOU-000017' ||
      p?.barcode === '49000017' ||
      p?.barcode === '49000028',
    src: '/products/bujairami-non-stop.png'
  },
  {
    match: (p) =>
      /ansaam/i.test(p?.name || '') ||
      p?.sku === 'TOU-ANSAAM' ||
      p?.sku === 'TOU-000001' ||
      p?.barcode === '49000001',
    src: '/products/ansaam-gold.png'
  }
];

/**
 * Resolve product image for Inventory, POS, cart, etc.
 * Uses DB image when set; otherwise featured dummy photos.
 */
export function productImageOf(product) {
  if (!product) return '';
  const stored = String(product.image || '').trim();
  if (stored && !stored.startsWith('blob:')) return stored;
  for (const row of FEATURED_IMAGES) {
    if (row.match(product)) return row.src;
  }
  return '';
}

/** Attach resolved image onto a product list for UI rendering. */
export function withProductImages(products) {
  if (!Array.isArray(products)) return [];
  return products.map((p) => ({
    ...p,
    image: productImageOf(p) || p.image || null
  }));
}
