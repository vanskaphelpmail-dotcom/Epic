import type { CartItem, Product } from '../types';

const CART_KEY = 'vault_cart';
const WISHLIST_KEY = 'vault_wishlist';
const WISHLIST_USER_PREFIX = 'vault_wishlist_user:';

function wishlistKeyForUser(userId?: string | null) {
  if (userId) return `${WISHLIST_USER_PREFIX}${userId}`;
  return WISHLIST_KEY;
}

export function loadLocalCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && item.product && item.product.id && item.selectedSize && item.quantity > 0,
    ) as CartItem[];
  } catch {
    return [];
  }
}

export function saveLocalCart(cart: CartItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* quota */
  }
}

export function clearLocalCart() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CART_KEY);
  } catch {
    /* ignore */
  }
}

function parseWishlist(raw: string | null): Product[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && p.id)
      .map((p) => ({ ...p, id: String(p.id) })) as Product[];
  } catch {
    return [];
  }
}

/** Guest wishlist, or account-scoped wishlist when userId is passed. */
export function loadLocalWishlist(userId?: string | null): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    if (userId) {
      const scoped = parseWishlist(localStorage.getItem(wishlistKeyForUser(userId)));
      if (scoped.length) return scoped;
    }
    return parseWishlist(localStorage.getItem(WISHLIST_KEY));
  } catch {
    return [];
  }
}

export function saveLocalWishlist(items: Product[], userId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = items
      .filter((p) => p && p.id)
      .map((p) => ({ ...p, id: String(p.id) }));
    const payload = JSON.stringify(normalized);
    localStorage.setItem(wishlistKeyForUser(userId), payload);
    // Keep guest key mirrored while logged in so refresh before hydrate still shows hearts
    if (userId) localStorage.setItem(WISHLIST_KEY, payload);
  } catch {
    /* quota */
  }
}

export function clearLocalWishlist(userId?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(WISHLIST_KEY);
    if (userId) localStorage.removeItem(wishlistKeyForUser(userId));
  } catch {
    /* ignore */
  }
}

export function isProductWishlisted(wishlist: Product[], productId: string): boolean {
  const id = String(productId);
  return wishlist.some((p) => String(p.id) === id);
}

/** Prefer catalog product objects — drop hearts for deleted products. */
export function mergeWishlistWithCatalog(remoteOrLocal: Product[], catalog: Product[]): Product[] {
  const byId = new Map(catalog.map((p) => [String(p.id), p]));
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const item of remoteOrLocal) {
    const id = String(item?.id || '');
    if (!id || seen.has(id)) continue;
    const live = byId.get(id);
    if (!live) continue;
    seen.add(id);
    out.push(live);
  }
  return out;
}

/** Map API cart rows — only products still in the live catalog (no deleted snapshots). */
export function mapApiCartToItems(
  apiItems: Array<{
    productId: string;
    selectedSize: string;
    quantity: number;
    customPrintName?: string | null;
    customPrintNum?: number | null;
    addBadge?: boolean;
    selectedBadgeIds?: string | null;
    product?: Partial<Product> | null;
  }>,
  catalog: Product[],
): CartItem[] {
  const byId = new Map(catalog.map((p) => [String(p.id), p]));
  const items: CartItem[] = [];
  for (const row of apiItems) {
    const product = byId.get(String(row.productId));
    if (!product) continue;
    const badges = row.selectedBadgeIds
      ? String(row.selectedBadgeIds)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    items.push({
      product,
      selectedSize: row.selectedSize || product.sizes?.[0] || 'M',
      quantity: Math.max(1, Number(row.quantity) || 1),
      customPrint:
        row.customPrintName
          ? {
              name: row.customPrintName,
              number: Number(row.customPrintNum) || 0,
            }
          : undefined,
      addBadge: row.addBadge || false,
      selectedBadges: badges,
    });
  }
  return items;
}

/** Drop bag lines whose product was deleted from the catalog. */
export function pruneCartToCatalog(cart: CartItem[], catalog: Product[]): CartItem[] {
  const ids = new Set(catalog.map((p) => String(p.id)));
  return cart.filter((item) => item?.product?.id && ids.has(String(item.product.id)));
}

/** Drop wishlist hearts for deleted products. */
export function pruneWishlistToCatalog(list: Product[], catalog: Product[]): Product[] {
  const ids = new Set(catalog.map((p) => String(p.id)));
  return list.filter((p) => p?.id && ids.has(String(p.id)));
}

export function cartToSyncPayload(cart: CartItem[]) {
  return cart.map((item) => ({
    productId: item.product.id,
    selectedSize: item.selectedSize,
    quantity: item.quantity,
    customPrintName: item.customPrint?.name || '',
    customPrintNum: item.customPrint?.number || 0,
    namesetEnabled: Boolean(item.namesetEnabled || item.customPrint),
    addBadge: item.addBadge || false,
    selectedBadgeIds: item.selectedBadges?.length ? item.selectedBadges.join(',') : '',
  }));
}
