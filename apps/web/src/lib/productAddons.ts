import type { Product, ProductBadgeOption } from '../types';

export const DEFAULT_NAMESET_PRICE_BDT = 300;
export const DEFAULT_BADGE_PRICE_BDT = 100;
export const DEFAULT_NAMESET_LABEL = 'Custom Nameset Printing';
export const DEFAULT_BADGE_LABEL = 'Tournament Sleeve Badges';

export function getNamesetPriceBdt(product: Pick<Product, 'namesetPriceBdt'>): number {
  const n = Number(product.namesetPriceBdt);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_NAMESET_PRICE_BDT;
}

export function getBadgePriceBdt(product: Pick<Product, 'badgePriceBdt'>): number {
  const n = Number(product.badgePriceBdt);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_BADGE_PRICE_BDT;
}

export function getNamesetLabel(product: Pick<Product, 'namesetLabel'>): string {
  return (product.namesetLabel || '').trim() || DEFAULT_NAMESET_LABEL;
}

export function getBadgeLabel(product: Pick<Product, 'badgeLabel'>): string {
  return (product.badgeLabel || '').trim() || DEFAULT_BADGE_LABEL;
}

/** Standard tournament sleeve badges for every jersey product. */
export function getProductBadgeOptions(
  _product?: Pick<Product, 'badgeAvailable' | 'badgeOptions' | 'badgeLabel' | 'badgePriceBdt'>,
): ProductBadgeOption[] {
  return createDefaultBadgeOptions();
}

export function formatSelectedBadgeIds(ids: string[]): string {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort().join(',');
}

export function parseSelectedBadgeIds(raw?: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function sumSelectedBadgePrices(
  product: Pick<Product, 'badgeAvailable' | 'badgeOptions' | 'badgeLabel' | 'badgePriceBdt'>,
  selectedIds: string[],
): number {
  const selected = new Set(selectedIds);
  return getProductBadgeOptions(product)
    .filter((option) => selected.has(option.id))
    .reduce((sum, option) => sum + option.priceBdt, 0);
}

export function getSelectedBadgeLabels(
  product: Pick<Product, 'badgeAvailable' | 'badgeOptions' | 'badgeLabel' | 'badgePriceBdt'>,
  selectedIds: string[],
): string[] {
  const selected = new Set(selectedIds);
  return getProductBadgeOptions(product)
    .filter((option) => selected.has(option.id))
    .map((option) => option.label);
}

export function createDefaultBadgeOptions(): ProductBadgeOption[] {
  return [
    { id: 'badge-wc26', label: 'WC 26', priceBdt: DEFAULT_BADGE_PRICE_BDT },
    { id: 'badge-ucl', label: 'UCL', priceBdt: DEFAULT_BADGE_PRICE_BDT },
    { id: 'badge-pl', label: 'Premier League', priceBdt: DEFAULT_BADGE_PRICE_BDT },
    { id: 'badge-laliga', label: 'La Liga', priceBdt: DEFAULT_BADGE_PRICE_BDT },
  ];
}

export function cartBadgesMatch(a?: string[], b?: string[]): boolean {
  return formatSelectedBadgeIds(a || []) === formatSelectedBadgeIds(b || []);
}
