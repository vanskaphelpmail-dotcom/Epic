/** Product list/sale price helpers (BDT amounts as integers). */

export type DiscountMode = 'amount' | 'percent';

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function moneyOrNaN(v: unknown): number {
  if (v == null || v === '') return NaN;
  if (typeof v === 'object' && v !== null && 'toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
    return Number((v as { toNumber: () => number }).toNumber());
  }
  return Number(v);
}

/** Final selling price from original + amount or percent off. */
export function calcSalePrice(
  originalPrice: number,
  mode: DiscountMode,
  discountAmount: number,
  discountPercent: number,
): number {
  const original = roundMoney(originalPrice);
  if (original <= 0) return 0;
  if (mode === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    if (pct <= 0) return original;
    return roundMoney(original * (1 - pct / 100));
  }
  const amount = Math.max(0, Number(discountAmount) || 0);
  if (amount <= 0) return original;
  return roundMoney(Math.max(0, original - amount));
}

export function calcDiscountAmount(originalPrice: number, salePrice: number): number {
  const original = roundMoney(originalPrice);
  const sale = roundMoney(salePrice);
  if (original <= 0 || sale >= original) return 0;
  return original - sale;
}

export function calcDiscountPercent(originalPrice: number, salePrice: number): number {
  const original = roundMoney(originalPrice);
  const sale = roundMoney(salePrice);
  if (original <= 0 || sale >= original) return 0;
  return Math.round(((original - sale) / original) * 100);
}

type PricedProduct = {
  price?: number | null;
  sellingPrice?: number | null;
  originalPrice?: number | null;
  discount?: number | null;
};

/** Active checkout / card price (sale). Handles legacy price vs sellingPrice mismatches. */
export function getProductSalePrice(product: PricedProduct): number {
  const price = moneyOrNaN(product.price);
  const selling = moneyOrNaN(product.sellingPrice);
  const original = moneyOrNaN(product.originalPrice);
  const candidates = [price, selling].filter((n) => Number.isFinite(n) && n >= 0);
  if (!candidates.length) return 0;

  if (Number.isFinite(original) && original > 0) {
    const belowOriginal = candidates.filter((n) => n < original);
    if (belowOriginal.length) return roundMoney(Math.min(...belowOriginal));
  }

  if (Number.isFinite(selling) && selling > 0) return roundMoney(selling);
  return roundMoney(Number.isFinite(price) ? price : 0);
}

/** Pre-discount list / MRP when a real discount is active; otherwise 0. */
export function getProductListPrice(product: PricedProduct): number {
  const sale = getProductSalePrice(product);
  const original = moneyOrNaN(product.originalPrice);
  if (Number.isFinite(original) && original > sale) return roundMoney(original);

  const price = moneyOrNaN(product.price);
  const selling = moneyOrNaN(product.sellingPrice);
  // Legacy: MRP kept on `price`, sale on `sellingPrice`
  if (Number.isFinite(price) && Number.isFinite(selling) && price > selling && selling >= 0) {
    return roundMoney(price);
  }

  const discountAmt = moneyOrNaN(product.discount);
  if (Number.isFinite(discountAmt) && discountAmt > 0 && sale > 0) {
    return roundMoney(sale + discountAmt);
  }

  return 0;
}

export function hasProductDiscount(product: PricedProduct): boolean {
  const sale = getProductSalePrice(product);
  const list = getProductListPrice(product);
  return list > sale && sale >= 0;
}

export function getProductDiscountPercent(product: PricedProduct): number {
  if (!hasProductDiscount(product)) return 0;
  return calcDiscountPercent(getProductListPrice(product), getProductSalePrice(product));
}

/**
 * Normalize catalog rows so `price` is always the active sale price and
 * `originalPrice` is the pre-discount MRP when a discount applies.
 */
export function normalizeProductPricing<T extends PricedProduct>(product: T): T {
  const sale = getProductSalePrice(product);
  const list = getProductListPrice(product);
  const discountAmt = list > sale ? list - sale : 0;
  return {
    ...product,
    price: sale,
    sellingPrice: sale,
    originalPrice: discountAmt > 0 ? list : null,
    discount: discountAmt > 0 ? discountAmt : null,
  };
}
