/** Product list/sale price helpers (BDT amounts as integers). */

export type DiscountMode = 'amount' | 'percent';

export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
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

export function hasProductDiscount(product: {
  price: number;
  originalPrice?: number | null;
}): boolean {
  const original = Number(product.originalPrice);
  const price = Number(product.price);
  return Number.isFinite(original) && original > price && price >= 0;
}

export function getProductDiscountPercent(product: {
  price: number;
  originalPrice?: number | null;
}): number {
  if (!hasProductDiscount(product)) return 0;
  return calcDiscountPercent(Number(product.originalPrice), Number(product.price));
}
