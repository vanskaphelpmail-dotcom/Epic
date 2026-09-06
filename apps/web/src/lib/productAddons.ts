import type { Product, ProductBadgeOption } from '../types';

export const DEFAULT_NAMESET_PRICE_BDT = 300;
export const DEFAULT_BADGE_PRICE_BDT = 100;
export const DEFAULT_NAMESET_LABEL = 'Custom Font';
export const DEFAULT_BADGE_LABEL = 'Select Tournament Patch';

export function getNamesetPriceBdt(product: Pick<Product, 'namesetPriceBdt'>): number {
  const n = Number(product.namesetPriceBdt);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_NAMESET_PRICE_BDT;
}

export function getBadgePriceBdt(product: Pick<Product, 'badgePriceBdt'>): number {
  const n = Number(product.badgePriceBdt);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_BADGE_PRICE_BDT;
}

export function getNamesetLabel(product: Pick<Product, 'namesetLabel'>): string {
  const raw = (product.namesetLabel || '').trim();
  // Migrate old storefront copy
  if (!raw || /nameset/i.test(raw)) return DEFAULT_NAMESET_LABEL;
  return raw;
}

export function getBadgeLabel(product: Pick<Product, 'badgeLabel'>): string {
  const raw = (product.badgeLabel || '').trim();
  if (
    !raw ||
    /sleeve\s*badge/i.test(raw) ||
    /tournament\s*patch/i.test(raw) ||
    raw === 'Tournament Sleeve Badges' ||
    raw === 'WC 26' ||
    raw === "WC '26"
  ) {
    return DEFAULT_BADGE_LABEL;
  }
  return raw;
}

export function normalizeBadgeOption(entry: unknown, index: number): ProductBadgeOption | null {
  if (!entry || typeof entry !== 'object') return null;
  const row = entry as Record<string, unknown>;
  const label = String(row.label || '').trim();
  if (!label) return null;
  const image = String(row.image || row.imageUrl || '').trim();
  return {
    id: String(row.id || `patch-${index + 1}`),
    label,
    priceBdt: Math.max(0, Math.round(Number(row.priceBdt) || 0)),
    ...(image ? { image } : {}),
  };
}

export function normalizeBadgeOptionsList(raw: unknown): ProductBadgeOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBadgeOption).filter((b): b is ProductBadgeOption => Boolean(b));
}

/**
 * Tournament patch options for a product.
 * Prefer global inventory patches (all jerseys), then product-level, then defaults.
 */
export function getProductBadgeOptions(
  product?: Pick<Product, 'badgeAvailable' | 'badgeOptions' | 'badgeLabel' | 'badgePriceBdt'>,
  globalPatches?: ProductBadgeOption[] | null,
): ProductBadgeOption[] {
  if (product?.badgeAvailable === false) return [];

  const fromGlobal = normalizeBadgeOptionsList(globalPatches);
  if (fromGlobal.length > 0) return fromGlobal;

  const fromProduct = normalizeBadgeOptionsList(product?.badgeOptions);
  if (fromProduct.length > 0) return fromProduct;

  // Legacy single badge label → one option
  const legacyLabel = (product?.badgeLabel || '').trim();
  if (legacyLabel && !/sleeve\s*badge/i.test(legacyLabel)) {
    return [
      {
        id: 'patch-legacy',
        label: legacyLabel,
        priceBdt: getBadgePriceBdt(product || {}),
      },
    ];
  }

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
  globalPatches?: ProductBadgeOption[] | null,
): number {
  const selected = new Set(selectedIds);
  return getProductBadgeOptions(product, globalPatches)
    .filter((option) => selected.has(option.id))
    .reduce((sum, option) => sum + option.priceBdt, 0);
}

export function getSelectedBadgeLabels(
  product: Pick<Product, 'badgeAvailable' | 'badgeOptions' | 'badgeLabel' | 'badgePriceBdt'>,
  selectedIds: string[],
  globalPatches?: ProductBadgeOption[] | null,
): string[] {
  const selected = new Set(selectedIds);
  return getProductBadgeOptions(product, globalPatches)
    .filter((option) => selected.has(option.id))
    .map((option) => option.label);
}

export function createDefaultBadgeOptions(): ProductBadgeOption[] {
  return [
    { id: 'patch-wc26', label: 'WC 26', priceBdt: DEFAULT_BADGE_PRICE_BDT },
    { id: 'patch-ucl', label: 'UCL', priceBdt: DEFAULT_BADGE_PRICE_BDT },
    { id: 'patch-pl', label: 'Premier League', priceBdt: DEFAULT_BADGE_PRICE_BDT },
    { id: 'patch-laliga', label: 'La Liga', priceBdt: DEFAULT_BADGE_PRICE_BDT },
  ];
}

export function cartBadgesMatch(a?: string[], b?: string[]): boolean {
  return formatSelectedBadgeIds(a || []) === formatSelectedBadgeIds(b || []);
}
