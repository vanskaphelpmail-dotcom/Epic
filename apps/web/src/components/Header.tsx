import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Search, Heart, ShoppingBag, Menu, X, ShieldCheck, HelpCircle, Phone, 
  ArrowRight, Award, Trash2, Shirt, Trophy, Star, Flame, Sparkles, Tag, 
  Box, Globe, Compass, ChevronDown, Layers, Grid, User as UserIcon, ClipboardList,
  LogIn, UserPlus, MapPin, Info, FileText, Package
} from 'lucide-react';
import { Product, CartItem, User, AppConfig, MenuItem } from '../types';
import { canUseAdminPanel } from '../lib/roles';
import { getToken, isApiEnabled } from '../lib/apiClient';
import { POPULAR_SEARCHES } from '../data/storeData';
import {
  buildCatalogSearchKeywords,
  suggestProductsForQuery,
} from '../lib/catalogSearch';
import { isStorefrontNavActive } from '../lib/storefrontPages';
import { BrandMark } from './BrandMark';

interface HeaderProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  wishlist: Product[];
  onSelectProduct: (product: Product) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  onLogout?: () => void;
  currentUser?: User | null;
  appConfig: AppConfig;
  formatPrice: (amount: number) => string;
  /** Live catalog for real-time keyword / name suggestions */
  products?: Product[];
  /** When true, desktop league strip is hidden (moved to left sidebar). */
  hideDesktopMainNav?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  setCurrentPage,
  selectedCategory,
  setSelectedCategory,
  cart,
  setCart,
  wishlist,
  onSelectProduct,
  searchQuery,
  onSearch,
  onLogout,
  currentUser,
  appConfig,
  formatPrice,
  products = [],
  hideDesktopMainNav = false,
}) => {
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showMobileSearchDropdown, setShowMobileSearchDropdown] = useState(false);
  const [headerHiddenMobile, setHeaderHiddenMobile] = useState(false);
  const lastScrollYRef = useRef(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCartDropdown, setShowCartDropdown] = useState(false);
  const [showMegaMenuDropdown, setShowMegaMenuDropdown] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const mobileSearchPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const syncOffset = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--jab-mobile-header-h', `${h}px`);
      document.documentElement.style.setProperty('--jab-header-h', `${h}px`);
    };
    syncOffset();
    const ro = new ResizeObserver(syncOffset);
    ro.observe(el);
    window.addEventListener('resize', syncOffset);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncOffset);
    };
  }, []);

  // Mobile/tablet: auto-hide top bar on scroll down, show on scroll up
  useEffect(() => {
    const onScroll = () => {
      if (typeof window === 'undefined') return;
      if (window.matchMedia('(min-width: 1024px)').matches) {
        setHeaderHiddenMobile(false);
        return;
      }
      const y = window.scrollY || 0;
      const prev = lastScrollYRef.current;
      if (y > prev + 6 && y > 64) {
        setHeaderHiddenMobile(true);
        setShowMobileSearchDropdown(false);
      } else if (y < prev - 4) {
        setHeaderHiddenMobile(false);
      }
      if (y <= 8) setHeaderHiddenMobile(false);
      lastScrollYRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile search suggestions when tapping outside
  useEffect(() => {
    if (!showMobileSearchDropdown) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (mobileSearchPanelRef.current?.contains(target)) return;
      setShowMobileSearchDropdown(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [showMobileSearchDropdown]);

  // Lock page scroll while full-screen menu is open
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  const catalogKeywords = useMemo(
    () => buildCatalogSearchKeywords(products, 5),
    [products],
  );
  const popularSearchTerms = (catalogKeywords.length ? catalogKeywords : POPULAR_SEARCHES).slice(0, 5);
  const liveSuggestions = useMemo(
    () => suggestProductsForQuery(products, searchQuery, 5),
    [products, searchQuery],
  );

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSearchInput = (value: string) => {
    onSearch(value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      onSearch(q);
      setSelectedCategory('All');
      setCurrentPage('listing');
      setShowSearchDropdown(false);
      setShowMobileSearchDropdown(false);
      setIsMobileMenuOpen(false);
    }
  };

  const handlePopularSearchClick = (term: string) => {
    onSearch(term);
    setSelectedCategory('All');
    setCurrentPage('listing');
    setShowSearchDropdown(false);
    setShowMobileSearchDropdown(false);
    setIsMobileMenuOpen(false);
  };

  const renderNavIcon = (iconName?: string, size = 14) => {
    switch (iconName) {
      case 'Shirt': return <Shirt size={size} />;
      case 'Trophy': return <Trophy size={size} />;
      case 'Star': return <Star size={size} />;
      case 'Flame': return <Flame size={size} />;
      case 'Sparkles': return <Sparkles size={size} />;
      case 'Tag': return <Tag size={size} />;
      case 'Box': return <Box size={size} />;
      case 'Globe': return <Globe size={size} />;
      case 'ShieldCheck': return <ShieldCheck size={size} />;
      case 'Award': return <Award size={size} />;
      case 'ShoppingBag': return <ShoppingBag size={size} />;
      case 'HelpCircle': return <HelpCircle size={size} />;
      case 'Phone': return <Phone size={size} />;
      case 'Compass': return <Compass size={size} />;
      case 'Heart': return <Heart size={size} />;
      case 'Layers': return <Layers size={size} />;
      case 'Grid': return <Grid size={size} />;
      default: return null;
    }
  };

  const handleMenuClick = (url: string) => {
    setIsMobileMenuOpen(false);
    setShowMegaMenuDropdown(false);
    if (!url) return;
    const normalized = url.replace(/^#/, '').toLowerCase().trim();
    // Secret admin portal â€” never navigate from public menus
    if (
      normalized === 'admin' ||
      normalized === 'auth' ||
      normalized.startsWith('admin/') ||
      normalized.includes('admin/account')
    ) {
      return;
    }
    // Category pages should not keep a leftover search that mixes results
    onSearch('');
    if (url.startsWith('#')) {
      const anchor = url.replace('#', '');
      if (['seller', 'faq', 'about', 'contact', 'dashboard', 'authenticity', 'cart', 'checkout'].includes(anchor)) {
        setCurrentPage(anchor);
      } else if (anchor === 'listing' || anchor === 'shop' || !anchor) {
        setSelectedCategory('All');
        setCurrentPage('All');
      } else {
        setCurrentPage(anchor);
      }
    } else if (['seller', 'faq', 'about', 'contact', 'dashboard', 'authenticity', 'home', 'listing', 'cart', 'checkout'].includes(url.toLowerCase())) {
      if (url.toLowerCase() === 'listing') {
        setSelectedCategory('All');
        setCurrentPage('All');
      } else {
        setCurrentPage(url.toLowerCase());
      }
    } else {
      setCurrentPage(url);
    }
  };

  // Main & Mega Menu Data from Config with Fallbacks
  const activeMenuItems = (appConfig?.menuItems || []).filter(
    m => (m.status === 'Active' || m.status === 'active')
  );

  const rawMainNavItems = activeMenuItems
    .filter(m => m.placement === 'Main Menu')
    .sort((a, b) => a.order - b.order);

  const DEFAULT_MAIN_MENU: MenuItem[] = [
    { id: 'nav-main-0', name: 'All Jerseys', placement: 'Main Menu', order: 0, url: 'All', status: 'Active', icon: 'Layers' },
    { id: 'nav-main-1', name: 'Premier League', placement: 'Main Menu', order: 1, url: 'Premier League', status: 'Active', icon: 'Trophy' },
    { id: 'nav-main-2', name: 'LALIGA', placement: 'Main Menu', order: 2, url: 'La Liga', status: 'Active', icon: 'Award' },
    { id: 'nav-main-3', name: 'Ligue 1', placement: 'Main Menu', order: 3, url: 'Ligue 1', status: 'Active', icon: 'Shirt' },
    { id: 'nav-main-4', name: 'Serie A', placement: 'Main Menu', order: 4, url: 'Serie A', status: 'Active', icon: 'ShieldCheck' },
    { id: 'nav-main-5', name: 'Bundesliga', placement: 'Main Menu', order: 5, url: 'Bundesliga', status: 'Active', icon: 'Flame' },
    { id: 'nav-main-6', name: 'MLS', placement: 'Main Menu', order: 6, url: 'MLS', status: 'Active', icon: 'Star' },
    { id: 'nav-main-7', name: 'Other Leagues', placement: 'Main Menu', order: 7, url: 'Other Leagues', status: 'Active', icon: 'Globe' },
    { id: 'nav-main-8', name: 'International Teams', placement: 'Main Menu', order: 8, url: 'International Teams', status: 'Active', icon: 'Globe' },
    { id: 'nav-main-9', name: 'Outlet', placement: 'Main Menu', order: 9, url: 'Clearance', status: 'Active', icon: 'Tag' },
  ];

  const mainNavItems = (() => {
    const base = (rawMainNavItems.length > 0 ? rawMainNavItems : DEFAULT_MAIN_MENU).filter(
      (m) => !/mystery/i.test(m.name) && m.url !== 'Mystery',
    );
    const hasAll = base.some(
      (m) =>
        m.url === 'All' ||
        m.url === 'listing' ||
        m.url === '#listing' ||
        /all\s*jerseys/i.test(m.name),
    );
    if (hasAll) return base;
    return [
      {
        id: 'nav-all-jerseys',
        name: 'All Jerseys',
        placement: 'Main Menu' as const,
        order: 0,
        url: 'All',
        status: 'Active' as const,
        icon: 'Layers',
      },
      ...base,
    ];
  })();

  const rawMegaNavItems = activeMenuItems
    .filter(m => m.placement === 'Mega Menu')
    .sort((a, b) => a.order - b.order);

  const DEFAULT_MEGA_MENU: MenuItem[] = [
    { id: 'nav-mega-cat-1', name: 'Top Clubs', placement: 'Mega Menu', parentId: null, icon: 'Trophy', order: 1, url: '#listing', status: 'Active' },
    { id: 'nav-mega-item-1', name: 'Real Madrid', placement: 'Mega Menu', parentId: 'nav-mega-cat-1', icon: 'Shirt', order: 1, url: 'Real Madrid', status: 'Active' },
    { id: 'nav-mega-item-2', name: 'FC Barcelona', placement: 'Mega Menu', parentId: 'nav-mega-cat-1', icon: 'Tag', order: 2, url: 'Barcelona', status: 'Active' },
    { id: 'nav-mega-item-3', name: 'Manchester United', placement: 'Mega Menu', parentId: 'nav-mega-cat-1', icon: 'ShieldCheck', order: 3, url: 'Manchester United', status: 'Active' },
    { id: 'nav-mega-cat-2', name: 'Player Editions', placement: 'Mega Menu', parentId: null, icon: 'Star', order: 2, url: '#listing', status: 'Active' },
    { id: 'nav-mega-item-4', name: 'Messi', placement: 'Mega Menu', parentId: 'nav-mega-cat-2', icon: 'Sparkles', order: 1, url: 'Messi', status: 'Active' },
    { id: 'nav-mega-item-5', name: 'Ronaldo', placement: 'Mega Menu', parentId: 'nav-mega-cat-2', icon: 'Flame', order: 2, url: 'Ronaldo', status: 'Active' },
    { id: 'nav-mega-item-6', name: 'Retro Classics', placement: 'Mega Menu', parentId: 'nav-mega-cat-2', icon: 'Trophy', order: 3, url: 'Retro', status: 'Active' },
    { id: 'nav-mega-cat-3', name: 'National Teams', placement: 'Mega Menu', parentId: null, icon: 'Globe', order: 3, url: 'International Teams', status: 'Active' },
    { id: 'nav-mega-item-7', name: 'Argentina', placement: 'Mega Menu', parentId: 'nav-mega-cat-3', icon: 'Globe', order: 1, url: 'Argentina', status: 'Active' },
    { id: 'nav-mega-item-8', name: 'Brazil', placement: 'Mega Menu', parentId: 'nav-mega-cat-3', icon: 'Globe', order: 2, url: 'Brazil', status: 'Active' },
  ];

  const megaNavItems = rawMegaNavItems.length > 0 ? rawMegaNavItems : DEFAULT_MEGA_MENU;
  const megaParents = megaNavItems.filter(m => !m.parentId);

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <>
    <header
      ref={headerRef}
      className={`max-lg:fixed max-lg:inset-x-0 max-lg:top-0 sticky top-0 z-50 w-full min-w-0 bg-black transition-transform duration-300 max-lg:shadow-md max-lg:shadow-black/40 ${
        headerHiddenMobile ? 'max-lg:-translate-y-full' : 'max-lg:translate-y-0'
      }`}
    >
      {/* Top Navigation Row */}
      <div className="bg-black border-b border-zinc-800 py-3 sm:py-4 px-2.5 sm:px-4 lg:px-12 flex justify-between items-center gap-1.5 sm:gap-2 min-w-0 overflow-visible transition-all duration-300">
        
        {/* Brand Logo */}
        <div
          onClick={() => {
            setCurrentPage('home');
            setSelectedCategory('All');
          }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 flex-1 overflow-visible py-0.5 pr-1 lg:max-w-none"
          id="brand-logo"
        >
          <BrandMark className="group-hover:border-red-600 transition-all" />
          
          <div className="flex flex-col min-w-0 overflow-visible">
            <div className="brand-logo-lockup flex items-center flex-nowrap gap-1.5 sm:gap-2 md:gap-2.5 min-w-0">
              {(() => {
                const brand = (appConfig.logoText || 'Epic Vanskap').trim();
                const parts = brand.split(/\s+/);
                const badge = parts.length > 1 && parts[parts.length - 1].length <= 3 ? parts[parts.length - 1] : null;
                const words = badge ? parts.slice(0, -1) : parts;
                return (
                  <>
                    {words.map((word, i) => (
                      <span
                        key={`${word}-${i}`}
                        className={`brand-word text-xs sm:text-sm md:text-lg shrink-0 ${i === 0 ? 'brand-word-jersey' : 'brand-word-addicts'}`}
                      >
                        {word}
                      </span>
                    ))}
                    {badge ? (
                      <span className="brand-badge-bd shrink-0" aria-label={badge}>
                        <span>{badge}</span>
                      </span>
                    ) : null}
                  </>
                );
              })()}
            </div>
            {appConfig.logoSubtext ? (
              <span className="hidden sm:block text-[9px] font-mono text-zinc-400/80 tracking-wider uppercase mt-0.5 truncate">{appConfig.logoSubtext}</span>
            ) : null}
          </div>
        </div>

        {/* Search Bar - Desktop */}
        <div className="relative hidden lg:block w-full max-w-lg mx-6">
          <form onSubmit={handleSearchSubmit}>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Club Jersey, International Jersey, League..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => setShowSearchDropdown(true)}
                className="w-full h-12 bg-zinc-900 text-white placeholder-zinc-500 text-sm pl-12 pr-28 rounded-full border-0 focus:bg-[#121212] focus:outline-none focus:ring-2 focus:ring-red-600/30 hover:bg-zinc-800/80 transition-all duration-300"
              />
              <Search className="absolute left-4 text-zinc-600 w-5 h-5 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 bottom-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-6 rounded-full transition-all duration-200 cursor-pointer shadow-sm hover:shadow hover:scale-[1.01] active:scale-95 uppercase tracking-wider flex items-center justify-center"
              >
                Search
              </button>
            </div>
          </form>

          {/* Autocomplete / Popular Searches Dropdown */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#121212] border border-zinc-800 rounded-2xl shadow-2xl p-5 z-50 text-white animate-fadeIn">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-zinc-300/80 tracking-wider uppercase">
                  {searchQuery.trim().length >= 2 ? 'Matching jerseys' : 'Popular Searches'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSearchDropdown(false)}
                  className="text-zinc-600 hover:text-white text-xs"
                >
                  Close
                </button>
              </div>
              {searchQuery.trim().length >= 2 && liveSuggestions.length > 0 && (
                <div className="space-y-1 mb-4 max-h-56 overflow-y-auto">
                  {liveSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectProduct(p);
                        setShowSearchDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-900 text-xs font-semibold text-white cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                        {p.brand}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {popularSearchTerms.slice(0, 5).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handlePopularSearchClick(term)}
                    className="bg-zinc-900 hover:bg-zinc-800 border-0 text-xs px-3.5 py-1.5 rounded-full text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
              <div className="border-t border-zinc-800 pt-3">
                <span className="text-[11px] text-zinc-600 font-mono flex items-center gap-1">
                  <ShieldCheck size={12} /> Search is secured & real-time
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Icons Right Side */}
        <div className="hidden lg:flex items-center gap-3 text-white">
          {/* Staff session */}
          {currentUser && canUseAdminPanel(currentUser.role, !!getToken(), isApiEnabled()) ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:flex flex-col text-right pr-2">
                <span className="text-[9px] text-zinc-600 font-mono font-bold uppercase tracking-wider">{currentUser.role}</span>
                <span className="text-xs text-white font-bold truncate max-w-[100px]">{currentUser.fullName}</span>
              </div>
              <button
                onClick={() => setCurrentPage('admin')}
                className="bg-zinc-900 border border-zinc-800 hover:border-red-600 text-zinc-300 text-[10px] uppercase font-mono tracking-widest px-3 py-1.5 rounded cursor-pointer transition-colors"
                id="admin-dashboard-shortcut"
              >
                Admin Room
              </button>
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                }}
                className="text-[10px] font-mono text-zinc-400 hover:text-red-600 uppercase tracking-wider px-2 py-1 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage('dashboard')}
                className="text-xs font-bold text-white truncate max-w-[120px] hover:text-red-500 cursor-pointer"
                title={currentUser.email}
              >
                {currentUser.fullName?.split(' ')[0] || 'Account'}
              </button>
              <button
                type="button"
                onClick={() => onLogout?.()}
                className="text-[10px] font-mono text-zinc-400 hover:text-red-600 uppercase tracking-wider px-2 py-1 cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage('login')}
                className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 hover:text-white px-3 py-1.5 cursor-pointer"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('signup')}
                className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Wishlist Link */}
          <button
            onClick={() => {
              setSelectedCategory('All');
              setCurrentPage('dashboard');
            }}
            className="relative p-2 hover:bg-zinc-900 rounded-full hover:text-zinc-400 transition-all cursor-pointer"
            id="wishlist-btn"
          >
            <Heart size={20} className={wishlist.length > 0 ? 'fill-red-500 text-red-500' : ''} />
            {wishlist.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-zinc-800 text-white font-black text-[10px] w-5 h-5 flex items-center justify-center rounded-full animate-pulse">
                {wishlist.length}
              </span>
            )}
          </button>

          {/* Cart Bag Icon with Preview Dropdown */}
          <div className="relative">
            <button
              onClick={() => setCurrentPage('cart')}
              onMouseEnter={() => setShowCartDropdown(true)}
              className="relative p-2.5 bg-zinc-900 border border-zinc-800 rounded-full hover:border-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
              id="shopping-bag-btn"
            >
              <ShoppingBag size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-zinc-800 text-white font-black text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Quick Bag Preview Dropdown */}
            {showCartDropdown && cart.length > 0 && (
              <div
                onMouseLeave={() => setShowCartDropdown(false)}
                className="absolute right-0 mt-2 w-80 bg-[#121212] border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 animate-fadeIn text-white"
              >
                <div className="flex justify-between items-center border-b border-zinc-800 pb-2 mb-3">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    My Jersey Bag ({cartCount})
                  </span>
                  <button
                    onClick={() => setCurrentPage('cart')}
                    className="text-zinc-600 hover:text-zinc-100 text-xs font-semibold"
                  >
                    View Bag
                  </button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {cart.map((item, index) => (
                    <div key={index} className="flex gap-3 text-white border-b border-zinc-800 pb-2">
                      <div className="w-12 h-12 bg-zinc-900 rounded p-1 flex items-center justify-center border border-zinc-800/30">
                        {/* Tiny Preview */}
                        <svg viewBox="0 0 200 240" className="w-full h-full">
                          <rect width="200" height="240" rx="10" fill="#f0fdf4" />
                          <circle cx="100" cy="120" r="60" fill="#0a0a0a" opacity="0.3" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate hover:text-zinc-400 cursor-pointer" onClick={() => { onSelectProduct(item.product); setCurrentPage('details'); }}>
                          {item.product.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          Size: {item.selectedSize} | Qty: {item.quantity}
                        </p>
                        <p className="text-xs font-black text-zinc-300 mt-0.5">
                          {formatPrice(item.product.price)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="text-zinc-600 hover:text-red-600 self-center"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-zinc-800 pt-3 mt-3">
                  <div className="flex justify-between items-center text-sm font-semibold mb-3">
                    <span className="text-zinc-400">Subtotal:</span>
                    <span className="text-zinc-100 font-black">{formatPrice(cartTotal)}</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowCartDropdown(false);
                      setCurrentPage('checkout');
                    }}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-2.5 rounded-full flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-md cursor-pointer"
                  >
                    Instant Checkout <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile: menu only â€” search lives in the bar below + bottom nav */}
        <div
          className="flex lg:hidden items-center gap-1.5 shrink-0 ml-auto"
          id="mobile-right-controls"
        >
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="relative z-[60] shrink-0 w-10 h-10 hover:bg-zinc-900 rounded-xl text-white border border-zinc-800 bg-[#121212] shadow-sm inline-flex items-center justify-center cursor-pointer transition-all duration-200"
            id="mobile-hamburger-btn"
            aria-label="Toggle Menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X size={20} className="text-zinc-300 shrink-0" strokeWidth={2.5} />
            ) : (
              <Menu size={20} className="text-zinc-300 shrink-0" strokeWidth={2.5} />
            )}
          </button>
        </div>

      </div>

      {/* Mobile search â€” always visible above banner / page content */}
      <div
        ref={mobileSearchPanelRef}
        className="lg:hidden px-3 sm:px-4 pt-2.5 pb-3 bg-[#121212] border-b border-zinc-800 relative"
        id="mobile-search-bar"
      >
        <form
          onSubmit={(e) => {
            handleSearchSubmit(e);
            setShowMobileSearchDropdown(false);
          }}
          className="relative"
        >
          <div className="relative flex items-center">
            <input
              id="mobile-header-search"
              type="search"
              enterKeyHint="search"
              placeholder="Club Jersey, International Jersey, League..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => setShowMobileSearchDropdown(true)}
              className="w-full h-11 sm:h-12 bg-zinc-900 text-white placeholder-zinc-500 text-sm pl-11 pr-[5.75rem] rounded-full border-0 focus:bg-[#121212] focus:outline-none focus:ring-2 focus:ring-red-600/30 transition-all duration-300"
            />
            <Search className="absolute left-3.5 text-zinc-600 w-5 h-5 pointer-events-none" />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 bottom-1.5 min-w-[4.5rem] bg-red-600 hover:bg-red-700 text-white text-[10px] sm:text-xs font-black px-4 sm:px-5 rounded-full transition-all cursor-pointer uppercase tracking-wider shadow-md shadow-red-600/30 hover:shadow active:scale-95 border-0"
            >
              Search
            </button>
          </div>
        </form>
        {showMobileSearchDropdown && (
          <div className="absolute top-full left-3 right-3 sm:left-4 sm:right-4 mt-2 bg-[#121212] border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 text-white animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-zinc-300/80 tracking-wider uppercase">
                {searchQuery.trim().length >= 2 ? 'Matching jerseys' : 'Popular Searches'}
              </span>
              <button
                type="button"
                onClick={() => setShowMobileSearchDropdown(false)}
                className="text-zinc-600 text-xs"
              >
                Close
              </button>
            </div>
            {searchQuery.trim().length >= 2 && liveSuggestions.length > 0 && (
              <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
                {liveSuggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProduct(p);
                      setShowMobileSearchDropdown(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-zinc-900 text-[11px] font-semibold text-white cursor-pointer truncate"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {popularSearchTerms.slice(0, 5).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handlePopularSearchClick(term)}
                  className="bg-zinc-900 hover:bg-zinc-800 border-0 text-[11px] px-3 py-1.5 rounded-full text-zinc-300 cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-zinc-600 font-mono flex items-center gap-1">
              <ShieldCheck size={11} /> Search is secured & real-time
            </p>
          </div>
        )}
      </div>

      {/* Dynamic Main & Mega Navigation Row â€” desktop strip optional (left sidebar preferred) */}
      {!hideDesktopMainNav && (
      <nav className="bg-black border-b border-zinc-800 py-2.5 px-4 lg:px-12 hidden lg:flex items-center justify-center gap-2 xl:gap-3 relative flex-wrap">
        {mainNavItems.map((item) => {
          const active = isStorefrontNavActive(item.url, selectedCategory, currentPage);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleMenuClick(item.url)}
              aria-current={active ? 'page' : undefined}
              className={`text-xs font-sans tracking-widest font-bold uppercase relative py-1.5 px-2.5 rounded-full transition-all cursor-pointer group flex items-center gap-1.5 ${
                active
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-white hover:text-zinc-400 hover:bg-zinc-800/70'
              }`}
            >
              <span>{item.name}</span>
              {item.badgeText && (
                <span
                  className={`font-mono text-[8px] font-black px-1.5 py-0.5 rounded tracking-normal ${
                    active ? 'bg-white/20 text-white' : 'bg-red-600 text-white'
                  }`}
                >
                  {item.badgeText}
                </span>
              )}
            </button>
          );
        })}

        {/* Mega Menu Dropdown Trigger */}
        {megaParents.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setShowMegaMenuDropdown(true)}
            onMouseLeave={() => setShowMegaMenuDropdown(false)}
          >
            <button
              type="button"
              className={`text-xs font-sans tracking-widest font-bold uppercase relative py-1.5 px-2.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                showMegaMenuDropdown
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-white hover:text-zinc-400 hover:bg-zinc-800/70'
              }`}
            >
              <span>More</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showMegaMenuDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Mega Menu Dropdown Board */}
            {showMegaMenuDropdown && (
              <div className="absolute top-full right-0 w-[680px] bg-[#121212] border border-zinc-800 rounded-2xl shadow-2xl p-6 z-50 animate-fadeIn grid grid-cols-3 gap-6 text-white">
                {megaParents.map((parent) => {
                  const children = megaNavItems.filter(c => c.parentId === parent.id);

                  return (
                    <div key={parent.id} className="space-y-3">
                      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
                        <div className="p-1 bg-zinc-900 text-zinc-300 rounded">
                          {renderNavIcon(parent.icon, 16)}
                        </div>
                        <h5 className="font-extrabold text-xs uppercase tracking-tight text-white font-display">
                          {parent.name}
                        </h5>
                      </div>
                      <div className="space-y-2">
                        {children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => handleMenuClick(child.url)}
                            className="w-full text-left p-2 rounded-xl hover:bg-zinc-900/90 transition-all cursor-pointer flex items-center justify-between group text-xs"
                          >
                            <div className="flex items-center gap-2 text-zinc-100 group-hover:text-zinc-400">
                              {renderNavIcon(child.icon, 14)}
                              <span className="font-semibold">{child.name}</span>
                            </div>
                            {child.badgeText && (
                              <span className="bg-amber-100 text-amber-900 font-mono text-[8px] font-black px-1.5 py-0.5 rounded">
                                {child.badgeText}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
      )}
    </header>

      {/* Mobile menu — full-screen (outside header transform) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[200] lg:hidden flex flex-col bg-[#0a0a0a] text-white"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div className="flex items-center justify-between shrink-0 px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-4 border-b border-zinc-800">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-white">Menu</p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                {currentUser ? currentUser.fullName : 'Guest'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2.5 rounded-full bg-zinc-900 text-zinc-200 hover:bg-zinc-800 cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
            {/* Quick actions — one compact strip */}
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  label: 'Cart',
                  meta: cartCount > 0 ? String(cartCount) : '0',
                  icon: ShoppingBag,
                  onClick: () => {
                    setCurrentPage('cart');
                    setIsMobileMenuOpen(false);
                  },
                },
                {
                  label: 'Wishlist',
                  meta: String(wishlist.length),
                  icon: Heart,
                  onClick: () => {
                    setCurrentPage(currentUser ? 'dashboard' : 'login');
                    setIsMobileMenuOpen(false);
                  },
                },
                {
                  label: 'Orders',
                  meta: currentUser ? 'View' : 'Login',
                  icon: ClipboardList,
                  onClick: () => {
                    setCurrentPage(currentUser ? 'dashboard' : 'login');
                    setIsMobileMenuOpen(false);
                  },
                },
              ].map(({ label, meta, icon: Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-zinc-900/80 py-3.5 px-2 cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  <Icon size={18} className="text-zinc-200" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-white">{label}</span>
                  <span className="text-[9px] font-mono text-zinc-500">{meta}</span>
                </button>
              ))}
            </div>

            {/* Account — single block */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-500">Account</p>
              {currentUser && canUseAdminPanel(currentUser.role, !!getToken(), isApiEnabled()) ? (
                <div className="rounded-2xl bg-zinc-900 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate">{currentUser.fullName}</p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">{currentUser.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onLogout?.();
                        setIsMobileMenuOpen(false);
                      }}
                      className="text-[10px] font-bold uppercase text-red-500 cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage('admin');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    Admin Room
                  </button>
                </div>
              ) : currentUser ? (
                <div className="rounded-2xl bg-zinc-900 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-sm font-black shrink-0">
                      {(currentUser.fullName || 'U')
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0]?.toUpperCase() || '')
                        .join('') || 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-white truncate">{currentUser.fullName}</p>
                      <p className="text-[10px] text-zinc-500 font-mono truncate">{currentUser.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage('dashboard');
                        setIsMobileMenuOpen(false);
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase cursor-pointer"
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onLogout?.();
                        setIsMobileMenuOpen(false);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-[10px] font-black uppercase cursor-pointer"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage('login');
                      setIsMobileMenuOpen(false);
                    }}
                    className="py-3 rounded-xl bg-zinc-900 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage('signup');
                      setIsMobileMenuOpen(false);
                    }}
                    className="py-3 rounded-xl bg-red-600 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>

            {/* Shop — clean list */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-500">Shop</p>
              <div className="rounded-2xl bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
                {mainNavItems.map((item) => {
                  const active = isStorefrontNavActive(item.url, selectedCategory, currentPage);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleMenuClick(item.url)}
                      aria-current={active ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer transition-colors ${
                        active ? 'bg-red-600 text-white' : 'text-white hover:bg-zinc-800'
                      }`}
                    >
                      <span className={`shrink-0 ${active ? 'text-white' : 'text-zinc-500'}`}>
                        {renderNavIcon(item.icon, 16)}
                      </span>
                      <span className="flex-1 text-sm font-semibold tracking-wide">{item.name}</span>
                      {item.badgeText ? (
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            active ? 'bg-white/20' : 'bg-red-600 text-white'
                          }`}
                        >
                          {item.badgeText}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collections — flat chips, not nested boxes */}
            {megaParents.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Collections
                </p>
                <div className="flex flex-wrap gap-2">
                  {megaNavItems
                    .filter((m) => m.parentId)
                    .map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => handleMenuClick(child.url)}
                        className="px-3.5 py-2 rounded-full bg-zinc-900 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white cursor-pointer transition-colors"
                      >
                        {child.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Help — simple text links */}
            <div className="space-y-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-zinc-500">Help</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  { page: 'about', label: 'About' },
                  { page: 'contact', label: 'Contact' },
                  { page: 'faq', label: 'FAQ' },
                  { page: 'shipping', label: 'Shipping' },
                  { page: 'authenticity', label: 'Authenticity' },
                  { page: 'refund', label: 'Refunds' },
                  { page: 'privacy', label: 'Privacy' },
                  { page: 'terms', label: 'Terms' },
                  { page: 'seller', label: 'Sell shirts' },
                ].map(({ page, label }) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => {
                      setCurrentPage(page);
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-left text-sm text-zinc-400 hover:text-white py-2 cursor-pointer transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    {/* Offset for max-lg:fixed header so page content isn't covered */}
    <div
      className="lg:hidden shrink-0 w-full"
      style={{ height: 'var(--jab-mobile-header-h, 11.75rem)' }}
      aria-hidden="true"
    />
    </>
  );
};
