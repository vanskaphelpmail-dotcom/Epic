import type { Product } from "../types";

/** Standard adult jersey sizes offered in admin + storefront. */
export const STANDARD_PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"] as const;

/** Kids kit sizes (numeric kit sizes matching Kids Size Chart). */
export const KIDS_PRODUCT_SIZES = ["16", "18", "20", "22", "24", "26", "28"] as const;

/** Default per-size stock when creating a new product in admin. */
export const DEFAULT_PRODUCT_SIZE_STOCKS: Record<string, number> = {
  S: 2,
  M: 3,
  L: 3,
  XL: 2,
  "2XL": 1,
};

export const DEFAULT_KIDS_SIZE_STOCKS: Record<string, number> = {
  "16": 1,
  "18": 1,
  "20": 2,
  "22": 2,
  "24": 2,
  "26": 1,
  "28": 1,
};

export const DEFAULT_FALLBACK_SIZES = ["S", "M", "L", "XL", "2XL"];

/** Legacy listings may still use XXL — treat as 2XL for display when normalizing. */
export function normalizeSizeLabel(size: string): string {
  return size.trim().toUpperCase() === "XXL" ? "2XL" : size;
}

/** Stock for one size. Uses sizeStocks when present; otherwise falls back to total stock for listed sizes. */
export function getSizeStock(product: Product, size: string): number {
  const map = product.sizeStocks;
  const lookup = size === "2XL" && map?.XXL !== undefined ? "XXL" : size;
  if (map && Object.keys(map).length > 0) {
    const n = Number(map[lookup] ?? map[size]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  const sizes = (product.sizes || []).map(normalizeSizeLabel);
  if (sizes.includes(size) && (product.stock || 0) > 0) {
    return product.stock;
  }
  return 0;
}

export function isSizeAvailable(product: Product, size: string): boolean {
  if (product.isPreOrder) {
    const sizes = getProductSizes(product);
    return sizes.includes(size);
  }
  return getSizeStock(product, size) > 0;
}

/** Sizes shown on storefront (prefer keys from sizeStocks, else product.sizes), ordered S→3XL. */
export function getProductSizes(product: Product): string[] {
  const fromMap = product.sizeStocks ? Object.keys(product.sizeStocks) : [];
  const raw = fromMap.length
    ? fromMap.map(normalizeSizeLabel)
    : product.sizes?.length
      ? product.sizes.map(normalizeSizeLabel)
      : [...DEFAULT_FALLBACK_SIZES];
  return sortProductSizes(raw);
}

/** Stable storefront order: XS, S, M, L, XL, 2XL, 3XL, then any extras. */
export function sortProductSizes(sizes: string[]): string[] {
  const order = new Map(STANDARD_PRODUCT_SIZES.map((s, i) => [s, i]));
  const unique = Array.from(new Set(sizes.map(normalizeSizeLabel).filter(Boolean)));
  return unique.sort((a, b) => {
    const ia = order.has(a as (typeof STANDARD_PRODUCT_SIZES)[number])
      ? order.get(a as (typeof STANDARD_PRODUCT_SIZES)[number])!
      : 1000 + unique.indexOf(a);
    const ib = order.has(b as (typeof STANDARD_PRODUCT_SIZES)[number])
      ? order.get(b as (typeof STANDARD_PRODUCT_SIZES)[number])!
      : 1000 + unique.indexOf(b);
    return ia - ib;
  });
}

/** Display label: show XXL for 2XL on storefront buttons. */
export function displaySizeLabel(size: string): string {
  const n = normalizeSizeLabel(size);
  return n === '2XL' ? 'XXL' : n;
}
