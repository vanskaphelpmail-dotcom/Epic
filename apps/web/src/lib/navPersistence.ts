/** Persist SPA storefront route across refresh for deep links only.
 * Bare `/` always boots Home in App (never restore listing from this key).
 */

const NAV_KEY = 'vault_nav_state';

export type NavState = {
  page: string;
  productId?: string | null;
  category?: string;
  search?: string;
};

/** Never restore these on refresh — land on home instead (avoids Admin trap). */
const EPHEMERAL_PAGES = new Set([
  'auth',
  'order-success',
  'admin',
  'dashboard',
  'checkout',
  'seller',
  'wishlist', // no dedicated route — heart icon opens dashboard
]);

/** Storefront pages that are safe to restore after refresh. */
const PERSISTABLE_PAGES = new Set([
  'home',
  'listing',
  'details',
  'cart',
  'faq',
  'about',
  'authenticity',
  'contact',
  'privacy',
  'refund',
  'terms',
  'shipping',
]);

function isPersistablePage(page: string): boolean {
  if (!page || EPHEMERAL_PAGES.has(page)) return false;
  if (PERSISTABLE_PAGES.has(page)) return true;
  // Custom CMS pages (page-*) only — do not restore arbitrary category strings as blank routes
  if (page.startsWith('page-')) return true;
  return false;
}

export function loadNavState(): NavState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NAV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavState;
    if (!parsed?.page || typeof parsed.page !== 'string') return null;
    if (!isPersistablePage(parsed.page)) return { page: 'home' };
    return parsed;
  } catch {
    return null;
  }
}

export function saveNavState(state: NavState) {
  if (typeof window === 'undefined') return;
  try {
    if (!isPersistablePage(state.page)) {
      localStorage.setItem(NAV_KEY, JSON.stringify({ page: 'home' }));
      return;
    }
    localStorage.setItem(NAV_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function clearNavState() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(NAV_KEY);
  } catch {
    /* ignore */
  }
}
