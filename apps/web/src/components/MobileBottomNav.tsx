import React from 'react';
import { Home, Search, LayoutGrid, Heart, ShoppingBag } from 'lucide-react';

export type MobileTab = 'home' | 'search' | 'categories' | 'wishlist' | 'cart';

interface MobileBottomNavProps {
  currentPage: string;
  searchQuery?: string;
  wishlistCount?: number;
  cartCount?: number;
  onHome: () => void;
  onSearch: () => void;
  onCategories: () => void;
  onWishlist: () => void;
  onCart: () => void;
}

function resolveActiveTab(currentPage: string, searchQuery?: string): MobileTab | null {
  if (currentPage === 'home') return 'home';
  if (currentPage === 'cart') return 'cart';
  if (currentPage === 'listing') {
    return searchQuery && searchQuery.trim() ? 'search' : 'categories';
  }
  if (currentPage === 'dashboard') return null;
  return null;
}

/**
 * Always-fixed bottom tab bar — mobile / tablet only (hidden from lg up).
 * Stays visible while scrolling; top header is unchanged.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  searchQuery = '',
  wishlistCount = 0,
  cartCount = 0,
  onHome,
  onSearch,
  onCategories,
  onWishlist,
  onCart,
}) => {
  const [forcedTab, setForcedTab] = React.useState<MobileTab | null>(null);
  const pageTab = resolveActiveTab(currentPage, searchQuery);
  const active: MobileTab =
    forcedTab || pageTab || (currentPage === 'dashboard' ? 'wishlist' : 'home');

  React.useEffect(() => {
    if (currentPage === 'dashboard') return;
    setForcedTab(null);
  }, [currentPage, searchQuery]);

  if (currentPage === 'admin' || currentPage === 'checkout' || currentPage === 'order-success' || currentPage === 'auth') {
    return null;
  }

  const itemClass = (tab: MobileTab) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 transition-colors cursor-pointer ${
      active === tab ? 'text-zinc-800' : 'text-zinc-600'
    }`;

  const go = (tab: MobileTab, action: () => void) => {
    setForcedTab(tab);
    action();
  };

  return (
    <nav
      aria-label="Mobile primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-[45] bg-white border-t border-zinc-100/90 shadow-[0_-4px_20px_rgba(4,36,22,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-between px-1 pt-1 max-w-lg mx-auto">
        <button type="button" className={itemClass('home')} onClick={() => go('home', onHome)} aria-current={active === 'home' ? 'page' : undefined}>
          <Home size={22} strokeWidth={active === 'home' ? 2.5 : 1.75} />
          <span className={`text-[10px] leading-none ${active === 'home' ? 'font-bold' : 'font-medium'}`}>Home</span>
        </button>

        <button type="button" className={itemClass('search')} onClick={() => go('search', onSearch)}>
          <Search size={22} strokeWidth={active === 'search' ? 2.5 : 1.75} />
          <span className={`text-[10px] leading-none ${active === 'search' ? 'font-bold' : 'font-medium'}`}>Search</span>
        </button>

        <button type="button" className={itemClass('categories')} onClick={() => go('categories', onCategories)} aria-current={active === 'categories' ? 'page' : undefined}>
          <LayoutGrid size={22} strokeWidth={active === 'categories' ? 2.5 : 1.75} />
          <span className={`text-[10px] leading-none ${active === 'categories' ? 'font-bold' : 'font-medium'}`}>Categories</span>
        </button>

        <button type="button" className={itemClass('wishlist')} onClick={() => go('wishlist', onWishlist)} aria-current={active === 'wishlist' ? 'page' : undefined}>
          <span className="relative inline-flex">
            <Heart size={22} strokeWidth={active === 'wishlist' ? 2.5 : 1.75} />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-zinc-700 text-white text-[8px] font-black flex items-center justify-center">
                {wishlistCount > 9 ? '9+' : wishlistCount}
              </span>
            )}
          </span>
          <span className={`text-[10px] leading-none ${active === 'wishlist' ? 'font-bold' : 'font-medium'}`}>Wishlist</span>
        </button>

        <button type="button" className={itemClass('cart')} onClick={() => go('cart', onCart)} aria-current={active === 'cart' ? 'page' : undefined}>
          <span className="relative inline-flex">
            <ShoppingBag size={22} strokeWidth={active === 'cart' ? 2.5 : 1.75} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-zinc-700 text-white text-[8px] font-black flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </span>
          <span className={`text-[10px] leading-none ${active === 'cart' ? 'font-bold' : 'font-medium'}`}>Cart</span>
        </button>
      </div>
    </nav>
  );
};
