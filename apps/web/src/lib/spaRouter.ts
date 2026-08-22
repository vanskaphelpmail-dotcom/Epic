/**
 * SPA History router — pushState/popstate so browser Back/Forward works.
 * Paths are SEO-friendly; Next.js optional catch-all serves the same App shell.
 */

export type SpaRoute = {
  page: string;
  productId?: string | null;
  category?: string;
  search?: string;
  brand?: string;
  condition?: string;
  sortBy?: string;
  /** Admin sidebar / module tab */
  adminTab?: string;
};

const SCROLL_KEY = 'vault_spa_scroll';

/** Pages that should not create endless back-stack noise when only filters change */
const LISTING_PAGES = new Set(['listing', 'shop']);

export function pathForRoute(route: SpaRoute): string {
  const page = (route.page || 'home').trim();
  const qs = new URLSearchParams();

  if (route.search?.trim()) qs.set('q', route.search.trim());
  if (route.brand && route.brand !== 'All') qs.set('brand', route.brand);
  if (route.condition && route.condition !== 'All') qs.set('condition', route.condition);
  if (route.sortBy && route.sortBy !== 'featured') qs.set('sort', route.sortBy);

  let path = '/';
  switch (page) {
    case 'home':
      path = '/';
      break;
    case 'listing': {
      const cat = route.category?.trim();
      if (cat && cat !== 'All') {
        path = `/shop/${encodeURIComponent(cat)}`;
      } else {
        path = '/shop';
      }
      break;
    }
    case 'details':
      path = route.productId ? `/product/${encodeURIComponent(route.productId)}` : '/shop';
      break;
    case 'cart':
      path = '/cart';
      break;
    case 'checkout':
      path = '/checkout';
      break;
    case 'auth':
      path = '/admin/account';
      break;
    case 'dashboard':
      path = '/account';
      break;
    case 'admin': {
      const tab = route.adminTab?.trim();
      if (tab === 'account') {
        path = '/admin/account';
        break;
      }
      path = tab && tab !== 'dashboard' ? `/admin/${encodeURIComponent(tab)}` : '/admin';
      break;
    }
    case 'order-success':
      path = '/order-success';
      break;
    case 'seller':
      path = '/seller';
      break;
    case 'faq':
    case 'about':
    case 'authenticity':
    case 'contact':
    case 'privacy':
    case 'refund':
    case 'terms':
    case 'shipping':
      path = `/${page}`;
      break;
    default:
      if (page.startsWith('page-')) {
        path = `/p/${encodeURIComponent(page.slice(5))}`;
      } else {
        path = `/${encodeURIComponent(page)}`;
      }
  }

  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}

export function parseLocation(href?: string): SpaRoute {
  if (typeof window === 'undefined' && !href) {
    return { page: 'home' };
  }
  const url = href
    ? new URL(href, 'http://localhost')
    : new URL(window.location.href);

  const segments = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const q = url.searchParams;

  const base: SpaRoute = {
    page: 'home',
    search: q.get('q') || '',
    brand: q.get('brand') || 'All',
    condition: q.get('condition') || 'All',
    sortBy: q.get('sort') || 'featured',
  };

  if (segments.length === 0) {
    return { ...base, page: 'home', category: 'All' };
  }

  const [a, b] = segments;
  switch (a) {
    case 'shop':
      return {
        ...base,
        page: 'listing',
        category: b ? decodeURIComponent(b) : 'All',
      };
    case 'product':
      return {
        ...base,
        page: 'details',
        productId: b ? decodeURIComponent(b) : null,
        category: 'All',
      };
    case 'cart':
      return { ...base, page: 'cart' };
    case 'checkout':
      return { ...base, page: 'checkout' };
    case 'auth':
      return { ...base, page: 'auth' };
    case 'account':
    case 'dashboard':
      return { ...base, page: 'dashboard' };
    case 'admin':
      if (b === 'account') {
        return { ...base, page: 'auth' };
      }
      return {
        ...base,
        page: 'admin',
        adminTab: b ? decodeURIComponent(b) : 'dashboard',
      };
    case 'order-success':
      return { ...base, page: 'order-success' };
    case 'seller':
      return { ...base, page: 'seller' };
    case 'p':
      return { ...base, page: b ? `page-${decodeURIComponent(b)}` : 'home' };
    case 'faq':
    case 'about':
    case 'authenticity':
    case 'contact':
    case 'privacy':
    case 'refund':
    case 'terms':
    case 'shipping':
      return { ...base, page: a };
    default:
      // Treat unknown first segment as a category listing (legacy menu urls)
      return {
        ...base,
        page: 'listing',
        category: decodeURIComponent(a),
      };
  }
}

function routeKey(route: SpaRoute): string {
  return pathForRoute(route);
}

function saveScroll(key: string) {
  if (typeof window === 'undefined') return;
  try {
    const map = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}') as Record<string, number>;
    map[key] = window.scrollY || 0;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function restoreScroll(key: string) {
  if (typeof window === 'undefined') return;
  try {
    const map = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}') as Record<string, number>;
    const y = map[key];
    if (typeof y === 'number') {
      requestAnimationFrame(() => window.scrollTo(0, y));
      return;
    }
  } catch {
    /* ignore */
  }
  requestAnimationFrame(() => window.scrollTo(0, 0));
}

export type NavigateOptions = {
  /** Use replaceState (auth redirects, filter tweaks) — does not add history entry */
  replace?: boolean;
  /** Skip scroll restore / jump */
  preserveScroll?: boolean;
  /** Force push even if path unchanged */
  force?: boolean;
};

/**
 * Update the URL. Returns true if the URL actually changed.
 * Caller should update React state to match.
 */
export function navigateSpa(route: SpaRoute, opts: NavigateOptions = {}): boolean {
  if (typeof window === 'undefined') return false;
  const next = pathForRoute(route);
  const current = `${window.location.pathname}${window.location.search}`;
  if (!opts.force && next === current) return false;

  const fromKey = routeKey(parseLocation());
  if (!opts.preserveScroll) {
    saveScroll(fromKey);
  }

  if (opts.replace) {
    window.history.replaceState({ spa: true, route }, '', next);
  } else {
    window.history.pushState({ spa: true, route }, '', next);
  }

  if (!opts.preserveScroll) {
    if (opts.replace && LISTING_PAGES.has(route.page)) {
      /* keep scroll when only filters replace */
    } else {
      restoreScroll(routeKey(route));
    }
  }
  return true;
}

/** Sync URL without creating history (boot / state reconciliation). */
export function replaceSpa(route: SpaRoute) {
  return navigateSpa(route, { replace: true, preserveScroll: true });
}

export function onSpaPopState(handler: (route: SpaRoute) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => {
    const route = parseLocation();
    handler(route);
    restoreScroll(routeKey(route));
  };
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
}

/** Ensure initial history state is tagged so first Back stays in-app when possible. */
export function ensureSpaHistoryBoot(route: SpaRoute) {
  if (typeof window === 'undefined') return;
  const path = pathForRoute(route);
  const current = `${window.location.pathname}${window.location.search}`;
  if (current !== path) {
    window.history.replaceState({ spa: true, route }, '', path);
  } else if (!window.history.state?.spa) {
    window.history.replaceState({ spa: true, route }, '', current);
  }
}
