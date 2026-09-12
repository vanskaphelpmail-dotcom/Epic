import React from 'react';
import { Home, Search, LayoutGrid, ShoppingBag } from 'lucide-react';

export type MobileTab = 'home' | 'categories' | 'cart' | 'whatsapp' | 'search';

const WHATSAPP_NUMBER = '8801865962232';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const WHATSAPP_GREEN = 'text-[#25D366]';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

interface MobileBottomNavProps {
  currentPage: string;
  searchQuery?: string;
  cartCount?: number;
  onHome: () => void;
  onSearch: () => void;
  onCategories: () => void;
  onCart: () => void;
}

function resolveActiveTab(currentPage: string, searchQuery?: string): MobileTab | null {
  if (currentPage === 'home') return 'home';
  if (currentPage === 'cart') return 'cart';
  if (currentPage === 'listing') {
    return searchQuery && searchQuery.trim() ? 'search' : 'categories';
  }
  return null;
}

/**
 * Always-fixed bottom tab bar — mobile / tablet only (hidden from lg up).
 * Order: Home · Categories · Cart · WhatsApp · Search
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentPage,
  searchQuery = '',
  cartCount = 0,
  onHome,
  onSearch,
  onCategories,
  onCart,
}) => {
  const [forcedTab, setForcedTab] = React.useState<MobileTab | null>(null);
  const pageTab = resolveActiveTab(currentPage, searchQuery);
  const active: MobileTab = forcedTab || pageTab || 'home';

  React.useEffect(() => {
    setForcedTab(null);
  }, [currentPage, searchQuery]);

  if (currentPage === 'admin' || currentPage === 'checkout' || currentPage === 'order-success' || currentPage === 'auth') {
    return null;
  }

  const itemClass = (tab: MobileTab) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 transition-colors cursor-pointer ${
      active === tab ? 'text-[#E30613]' : 'text-[#0A0A0A]'
    }`;

  const go = (tab: MobileTab, action: () => void) => {
    setForcedTab(tab);
    action();
  };

  return (
    <nav
      aria-label="Mobile primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-[45] bg-white border-t border-[#E5E5E5] shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-stretch justify-between px-0.5 pt-1 max-w-lg mx-auto">
        <button type="button" className={itemClass('home')} onClick={() => go('home', onHome)} aria-current={active === 'home' ? 'page' : undefined}>
          <Home size={22} strokeWidth={active === 'home' ? 2.5 : 1.75} />
          <span className={`text-[9px] leading-none ${active === 'home' ? 'font-bold' : 'font-medium'}`}>Home</span>
        </button>

        <button type="button" className={itemClass('categories')} onClick={() => go('categories', onCategories)} aria-current={active === 'categories' ? 'page' : undefined}>
          <LayoutGrid size={22} strokeWidth={active === 'categories' ? 2.5 : 1.75} />
          <span className={`text-[9px] leading-none ${active === 'categories' ? 'font-bold' : 'font-medium'}`}>Categories</span>
        </button>

        <button
          type="button"
          className={itemClass('cart')}
          onClick={() => go('cart', onCart)}
          aria-current={active === 'cart' ? 'page' : undefined}
          data-cart-target="mobile"
          aria-label="Shopping cart"
        >
          <span className="relative inline-flex">
            <ShoppingBag size={22} strokeWidth={active === 'cart' ? 2.5 : 1.75} />
            {cartCount > 0 && (
              <span
                data-cart-count
                className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#E30613] text-white text-[8px] font-black flex items-center justify-center"
              >
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </span>
          <span className={`text-[9px] leading-none ${active === 'cart' ? 'font-bold' : 'font-medium'}`}>Cart</span>
        </button>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-w-0 transition-colors cursor-pointer ${WHATSAPP_GREEN}`}
          onClick={() => setForcedTab('whatsapp')}
          aria-label="Chat on WhatsApp"
        >
          <WhatsAppIcon className={`w-[22px] h-[22px] ${WHATSAPP_GREEN}`} />
          <span className={`text-[9px] leading-none ${WHATSAPP_GREEN} ${active === 'whatsapp' ? 'font-bold' : 'font-medium'}`}>
            WhatsApp
          </span>
        </a>

        <button type="button" className={itemClass('search')} onClick={() => go('search', onSearch)}>
          <Search size={22} strokeWidth={active === 'search' ? 2.5 : 1.75} />
          <span className={`text-[9px] leading-none ${active === 'search' ? 'font-bold' : 'font-medium'}`}>Search</span>
        </button>
      </div>
    </nav>
  );
};
