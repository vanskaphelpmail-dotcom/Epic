import type { Product } from '../types';

type NavigateOpts = {
  setCurrentPage: (page: string) => void;
  setSelectedCategory?: (cat: string) => void;
  products?: Product[];
  onSelectProduct?: (p: Product) => void;
  openNewTab?: boolean;
};

/**
 * Resolves CMS / banner CTA URLs into in-app navigation.
 * Supports: listing, home, product:<id>, details:<id>, category:<name>,
 * page keys, hashes (#listing), and absolute http(s) links.
 */
export function navigateFromCmsUrl(rawUrl: string | undefined | null, opts: NavigateOpts) {
  const {
    setCurrentPage,
    setSelectedCategory,
    products = [],
    onSelectProduct,
    openNewTab = false,
  } = opts;

  if (!rawUrl || !String(rawUrl).trim()) {
    setSelectedCategory?.('All');
    setCurrentPage('listing');
    return;
  }

  const url = String(rawUrl).trim();

  if (/^https?:\/\//i.test(url)) {
    if (openNewTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.href = url;
    return;
  }

  let path = url.replace(/^#/, '').replace(/^\//, '');
  if (path.startsWith('product/') || path.startsWith('details/')) {
    path = path.replace(/^(product|details)\//, 'product:');
  }

  const lower = path.toLowerCase();

  if (lower === 'listing' || lower === 'shop' || lower === 'catalog') {
    setSelectedCategory?.('All');
    setCurrentPage('listing');
    return;
  }

  if (lower === 'home' || lower === '') {
    setCurrentPage('home');
    return;
  }

  if (lower.startsWith('product:') || lower.startsWith('details:')) {
    const id = path.split(':')[1]?.trim();
    const product = products.find((p) => p.id === id || p.sku === id);
    if (product && onSelectProduct) {
      onSelectProduct(product);
      return;
    }
    setCurrentPage('listing');
    return;
  }

  if (lower.startsWith('category:')) {
    const cat = path.slice(path.indexOf(':') + 1).trim() || 'All';
    setSelectedCategory?.(cat);
    setCurrentPage('listing');
    return;
  }

  const known = [
    'cart',
    'checkout',
    'dashboard',
    'seller',
    'faq',
    'about',
    'authenticity',
    'contact',
    'privacy',
    'refund',
    'terms',
    'shipping',
    'blogs',
  ];
  if (lower === 'admin' || lower === 'auth' || lower.startsWith('admin/')) {
    return;
  }
  if (known.includes(lower)) {
    setCurrentPage(lower);
    return;
  }

  if (lower.startsWith('page-')) {
    setCurrentPage(path);
    return;
  }

  // Unknown CMS paths → catalog filter (avoids blank pages with empty custom layouts)
  setSelectedCategory?.(path);
  setCurrentPage('listing');
}
