import type { DailyDealItem, Product } from '../types';
import { calcDiscountPercent, roundMoney } from './productPricing';

/** Normalize raw CMS / localStorage deal rows into a clean sorted list. */
export function normalizeDailyDealItems(raw: unknown): DailyDealItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: DailyDealItem[] = [];

  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const productId = typeof r.productId === 'string' ? r.productId.trim() : '';
    if (!productId || seen.has(productId)) continue;
    const dealPrice = roundMoney(Number(r.dealPrice));
    if (!Number.isFinite(dealPrice) || dealPrice < 0) continue;
    seen.add(productId);
    const compareRaw = r.compareAtPrice;
    const compareAtPrice =
      compareRaw === null || compareRaw === undefined || compareRaw === ''
        ? null
        : roundMoney(Number(compareRaw));
    const stockRaw = r.stockLeft;
    const claimedRaw = r.claimedPercent;
    items.push({
      productId,
      dealPrice,
      compareAtPrice:
        compareAtPrice != null && Number.isFinite(compareAtPrice) && compareAtPrice > 0
          ? compareAtPrice
          : null,
      isHotDeal: r.isHotDeal === true,
      stockLeft:
        stockRaw === null || stockRaw === undefined || stockRaw === ''
          ? null
          : Math.max(0, Math.round(Number(stockRaw)) || 0),
      claimedPercent:
        claimedRaw === null || claimedRaw === undefined || claimedRaw === ''
          ? null
          : Math.min(100, Math.max(0, Math.round(Number(claimedRaw)) || 0)),
      sortOrder: Number.isFinite(Number(r.sortOrder)) ? Number(r.sortOrder) : items.length,
    });
  }

  return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Migrate legacy single-product setting into items list when needed. */
export function resolveDailyDealItems(config: {
  dailyDealItems?: DailyDealItem[] | null;
  dailyDealProductId?: string | null;
}): DailyDealItem[] {
  const fromItems = normalizeDailyDealItems(config.dailyDealItems);
  if (fromItems.length > 0) return fromItems;
  const legacyId = config.dailyDealProductId?.trim();
  if (!legacyId) return [];
  return [];
}

export function dealCompareAtPrice(deal: DailyDealItem, product: Product): number {
  const compare = Number(deal.compareAtPrice);
  if (Number.isFinite(compare) && compare > deal.dealPrice) return roundMoney(compare);
  const catalogOriginal = Number(product.originalPrice);
  if (Number.isFinite(catalogOriginal) && catalogOriginal > deal.dealPrice) {
    return roundMoney(catalogOriginal);
  }
  const catalogPrice = Number(product.price);
  if (Number.isFinite(catalogPrice) && catalogPrice > deal.dealPrice) {
    return roundMoney(catalogPrice);
  }
  return deal.dealPrice;
}

export function dealSavePercent(deal: DailyDealItem, product: Product): number {
  return calcDiscountPercent(dealCompareAtPrice(deal, product), deal.dealPrice);
}

/** Product snapshot priced at the admin-fixed deal (for cart / checkout). */
export function productWithDealPrice(product: Product, deal: DailyDealItem): Product {
  const compareAt = dealCompareAtPrice(deal, product);
  return {
    ...product,
    price: roundMoney(deal.dealPrice),
    originalPrice: compareAt > deal.dealPrice ? compareAt : null,
    sellingPrice: roundMoney(deal.dealPrice),
  };
}

export function msUntilDealEnds(endsAt?: string | null): number | null {
  if (!endsAt) return null;
  const t = new Date(endsAt).getTime();
  if (!Number.isFinite(t)) return null;
  return t - Date.now();
}

export function timePartsFromMs(ms: number): { hrs: number; mins: number; secs: number } {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const hrs = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  return { hrs, mins, secs };
}

/** Default deal price suggestion: use existing sale price, else ~30% off catalog. */
export function suggestDealPrice(product: Product): number {
  const price = roundMoney(Number(product.price) || 0);
  const original = roundMoney(Number(product.originalPrice) || 0);
  if (original > price && price > 0) return price;
  if (price > 0) return roundMoney(price * 0.7);
  return 0;
}

export function suggestCompareAtPrice(product: Product): number {
  const price = roundMoney(Number(product.price) || 0);
  const original = roundMoney(Number(product.originalPrice) || 0);
  if (original > price) return original;
  return price;
}
