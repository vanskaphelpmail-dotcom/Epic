import React, { useState, useEffect, useMemo } from 'react';
import { Product, AppConfig, PageSection, CustomPage, CartItem } from '../types';
import { ProductCard } from './ProductCard';
import { JerseyRenderer } from './JerseyRenderer';
import { isProductWishlisted } from '../lib/cartWishlistStorage';
import { LeagueLogo } from './LeagueLogo';
import { ClubLogoShowcase } from './ClubLogoShowcase';
import { DEFAULT_LEAGUES } from '../data/leaguesData';
import { DEFAULT_CLUBS, normalizeClubShowcase } from '../data/clubsData';
import { DEFAULT_INTERNATIONAL_TEAMS } from '../data/internationalTeamsData';
import { navigateFromCmsUrl } from '../lib/navigateFromCmsUrl';
import { isBannerLive, isHeroBannerType } from '../lib/bannerVisibility';
import { flyProductToCart } from '../lib/flyToCart';
import { getProductsForHomepageSection, isCatalogAssignedProduct, isProductRowSection, isRemovedHomepageCategory, normalizeHomepageSections, resolveSectionCategory } from '../lib/homepageSections';
import { buildCatalogSearchKeywords, productMatchesSearchQuery, productMatchesNationalTeam } from '../lib/catalogSearch';
import { DEFAULT_FALLBACK_SIZES } from '../lib/productSizes';
import {
  dealCompareAtPrice,
  dealSavePercent,
  msUntilDealEnds,
  normalizeDailyDealItems,
  productWithDealPrice,
  suggestDealPrice,
  suggestCompareAtPrice,
  timePartsFromMs,
} from '../lib/dailyDeals';
import { 
  Star, ArrowRight, Sparkles, Flame, Percent, Trophy, RefreshCw, 
  Layers, Eye, ShieldCheck, Mail, MapPin, HelpCircle, 
  ChevronRight, ChevronLeft, Calendar, UserCheck, AlertCircle, ShoppingBag, BadgeCheck, X
} from 'lucide-react';
import type { BannerConfig } from '../types';

/** Always-available local cover (never depends on Unsplash / CDN / base64) */
const HERO_FALLBACK_COVER = '/hero-cover.svg';

function isUsableHeroImageSrc(src?: string | null): boolean {
  if (!src || typeof src !== 'string') return false;
  const s = src.trim();
  if (!s) return false;
  // Never use data:/blob: for hero — truncated uploads cause the broken-image icon
  if (s.startsWith('data:') || s.startsWith('blob:')) return false;
  if (s.startsWith('/')) return true;
  if (/^https?:\/\//i.test(s)) return true;
  return false;
}

function pickHeroSrc(...candidates: Array<string | null | undefined>): string {
  for (const src of candidates) {
    if (isUsableHeroImageSrc(src)) return String(src).trim();
  }
  return HERO_FALLBACK_COVER;
}

/**
 * Native <picture> picks mobile/tablet/desktop before paint.
 * Natural width/height so the full photo shows (no crop) inside the rounded frame.
 */
const HeroCoverImage: React.FC<{ banner: BannerConfig; slideKey: string }> = ({ banner, slideKey }) => {
  const desktop = pickHeroSrc(banner.desktopImage, banner.image, banner.tabletImage, banner.mobileImage);
  const tablet = pickHeroSrc(banner.tabletImage, banner.desktopImage, banner.mobileImage, banner.image);
  const mobile = pickHeroSrc(banner.mobileImage, banner.tabletImage, banner.desktopImage, banner.image);
  const [failed, setFailed] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailed(false);
    setFallbackSrc(null);
  }, [slideKey, desktop, tablet, mobile]);

  if (failed) return null;

  const imgSrc = fallbackSrc || desktop;

  return (
    <picture key={slideKey} className="relative z-0 block w-full">
      {!fallbackSrc && mobile !== desktop && (
        <source media="(max-width: 639px)" srcSet={mobile} />
      )}
      {!fallbackSrc && tablet !== desktop && (
        <source media="(min-width: 640px) and (max-width: 1023px)" srcSet={tablet} />
      )}
      <img
        src={imgSrc}
        alt=""
        aria-hidden="true"
        className="pointer-events-none m-0 block h-auto w-full max-w-none"
        loading="eager"
        decoding="async"
        fetchPriority="high"
        referrerPolicy="no-referrer"
        onError={() => {
          if (imgSrc !== HERO_FALLBACK_COVER) {
            setFallbackSrc(HERO_FALLBACK_COVER);
            return;
          }
          setFailed(true);
        }}
      />
    </picture>
  );
};

interface DynamicPageRendererProps {
  currentPage: string;
  products: Product[];
  appConfig: AppConfig;
  formatPrice: (amount: number) => string;
  onSelectProduct: (p: Product) => void;
  onAddToCart: (item: CartItem) => void;
  onToggleWishlist: (p: Product) => void;
  wishlist: Product[];
  setCurrentPage: (page: string) => void;
  setSelectedCategory: (cat: string) => void;
  onSearch?: (query: string) => void;
  handleQuickAdd: (p: Product, size?: string, quantity?: number) => void;
  handleUpdateProductImage: (id: string, base64: string) => void;
  handleCheckoutDirectly: (p: Product, size: string, quantity: number) => void;
}

export const DEFAULT_HOMEPAGE_SECTIONS: PageSection[] = [
  { id: 'hero-slider', name: 'Hero Banner Slider', visible: true, bgColor: 'bg-transparent', padding: 'py-0', margin: 'my-0', title: 'WORLD CUP 2026 EDITION', subtitle: 'The Grandest Stage of Football', status: 'active' },
  { id: 'trending-searches', name: 'Trending Searches bar', visible: true, bgColor: 'bg-transparent', padding: 'py-3.5', margin: 'my-2', status: 'active' },
  { id: 'live-auction', name: 'Bidding & Live Auctions', visible: false, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', status: 'inactive' },
  { id: 'daily-deals', name: 'Daily Deals Countdown', visible: false, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-4', title: 'LIMITED DAILY DEAL DECK', subtitle: '24-hour flash sale on ultra rare collectibles', status: 'inactive' },
  { id: 'featured-collection', name: 'Featured Collection Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'VERIFIED FEATURED CLASSICS', subtitle: 'Curated 1-of-1 historic collectibles', status: 'active', sectionType: 'product-row', productCategory: 'Featured', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'retro-collection', name: 'Retro Collection Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'RETRO', subtitle: 'Rare 80s, 90s & 2000s vintage reissues', status: 'active', sectionType: 'product-row', productCategory: 'Retro', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'product-row-la-liga', name: 'La Liga Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'LA LIGA', subtitle: 'Shop La Liga — curated picks for collectors', status: 'active', sectionType: 'product-row', productCategory: 'La Liga', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'product-row-world-cup', name: 'World Cup Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'WORLD CUP', subtitle: 'National team World Cup kits & vault classics', status: 'active', sectionType: 'product-row', productCategory: 'World Cup', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'player-edition', name: 'Player Edition Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'PLAYER EDITION', subtitle: 'Slim-fit match issue quality kits', status: 'active', sectionType: 'product-row', productCategory: 'Player Edition', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'customised-kit', name: 'Customised Kit Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'CUSTOMISED KIT', subtitle: 'Custom printed kits with full size guide', status: 'active', sectionType: 'product-row', productCategory: 'Customised Kit', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'clearance', name: 'Catalog Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'CATALOG', subtitle: 'Browse the full Catalog collection', status: 'active', sectionType: 'product-row', productCategory: 'Clearance', buttonText: 'VIEW CATALOG', buttonUrl: 'listing', maxProducts: 4 },
  { id: 'store-locations', name: 'Physical Store Maps', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'PHYSICAL OUTLET POINTS', subtitle: 'Visit us for physical sizing and authentications', status: 'active' },
];

export const DynamicPageRenderer: React.FC<DynamicPageRendererProps> = ({
  currentPage,
  products,
  appConfig,
  formatPrice,
  onSelectProduct,
  onAddToCart,
  onToggleWishlist,
  wishlist,
  setCurrentPage,
  setSelectedCategory,
  onSearch,
  handleQuickAdd,
  handleUpdateProductImage,
  handleCheckoutDirectly,
}) => {
  // Extract sections based on the active page
  const [sections, setSections] = useState<PageSection[]>([]);
  const [pageTitle, setPageTitle] = useState('');
  const [pageSubtitle, setPageSubtitle] = useState('');
  const [dealTimeLeft, setDealTimeLeft] = useState({ hrs: 14, mins: 42, secs: 19 });
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [showPopupBanner, setShowPopupBanner] = useState(false);
  const [dealSize, setDealSize] = useState('M');
  const [activeDealProductId, setActiveDealProductId] = useState<string | null>(null);

  const catalogProducts = products.filter(
    (p) => p.category !== 'Mystery' && !/mystery/i.test(p.name) && p.id !== 'shirt-7' && p.id !== 'mystery-box-item'
  );

  const trendingKeywords = useMemo(
    () =>
      buildCatalogSearchKeywords(
        catalogProducts.filter((p) => !isCatalogAssignedProduct(p)),
        5,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );

  // Curated storefront leagues (logos in /public/logos) — ignore stale CMS World Cup / BD entries
  const leagueItems = DEFAULT_LEAGUES.filter((l) => l.status === 'Active');
  const clubShowcaseItems = useMemo(
    () => normalizeClubShowcase(appConfig.clubs?.length ? appConfig.clubs : DEFAULT_CLUBS),
    [appConfig.clubs],
  );

  const dailyDealEnabled = appConfig.dailyDealEnabled === true;
  const flashDeals = useMemo(() => {
    let items = normalizeDailyDealItems(appConfig.dailyDealItems);
    if (items.length === 0 && appConfig.dailyDealProductId) {
      const legacy = catalogProducts.find((p) => p.id === appConfig.dailyDealProductId);
      if (legacy) {
        items = [
          {
            productId: legacy.id,
            dealPrice: suggestDealPrice(legacy),
            compareAtPrice: suggestCompareAtPrice(legacy),
            isHotDeal: true,
            stockLeft: Math.max(1, Number(legacy.stock) || 1),
            claimedPercent: 80,
            sortOrder: 0,
          },
        ];
      }
    }
    return items
      .map((deal) => {
        const product = catalogProducts.find((p) => p.id === deal.productId);
        return product ? { deal, product } : null;
      })
      .filter((row): row is { deal: (typeof items)[number]; product: Product } => row != null);
  }, [appConfig.dailyDealItems, appConfig.dailyDealProductId, catalogProducts]);

  useEffect(() => {
    if (flashDeals.length === 0) {
      setActiveDealProductId(null);
      return;
    }
    if (!activeDealProductId || !flashDeals.some((d) => d.product.id === activeDealProductId)) {
      setActiveDealProductId(flashDeals[0].product.id);
    }
  }, [flashDeals, activeDealProductId]);

  const activeFlashDeal =
    flashDeals.find((d) => d.product.id === activeDealProductId) || flashDeals[0] || null;

  useEffect(() => {
    if (activeFlashDeal?.product) {
      const sizes = activeFlashDeal.product.sizes?.length
        ? activeFlashDeal.product.sizes
        : [...DEFAULT_FALLBACK_SIZES];
      setDealSize(sizes.includes('M') ? 'M' : sizes[0]);
    }
  }, [activeFlashDeal?.product?.id]);

  // Countdown: admin endsAt when set, otherwise rolling timer
  useEffect(() => {
    const tick = () => {
      const remaining = msUntilDealEnds(appConfig.dailyDealEndsAt);
      if (remaining != null) {
        setDealTimeLeft(timePartsFromMs(remaining));
        return;
      }
      setDealTimeLeft((prev) => {
        if (prev.secs > 0) return { ...prev, secs: prev.secs - 1 };
        if (prev.mins > 0) return { hrs: prev.hrs, mins: prev.mins - 1, secs: 59 };
        if (prev.hrs > 0) return { hrs: prev.hrs - 1, mins: 59, secs: 59 };
        return { hrs: 23, mins: 59, secs: 59 };
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [appConfig.dailyDealEndsAt]);

  // Active Banners Selector Helpers — Inactive / Draft never render on storefront
  const activeHeroBanners = (appConfig.banners || [])
    .filter((b) => isHeroBannerType(b) && isBannerLive(b))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const activePopupBanner = (appConfig.banners || []).find(
    (b) => b.type === 'Popup Banner' && isBannerLive(b),
  );

  useEffect(() => {
    if (currentPage === 'home') {
      setSections(normalizeHomepageSections(appConfig.homepageSections || DEFAULT_HOMEPAGE_SECTIONS));
      setPageTitle('HOME');
    } else {
      // Check if this is a custom page ID or custom category page
      const matchedPage = appConfig.pages?.find(
        (p) => p.id === currentPage || `page-${p.id}` === currentPage || p.slug === currentPage || p.name === currentPage || p.name.toLowerCase() === currentPage.toLowerCase()
      );
      if (matchedPage) {
        setSections(matchedPage.sections || []);
        setPageTitle(matchedPage.name);
        setPageSubtitle(`Dynamic Page • Sourced and Managed via Command CMS`);
      } else {
        // Fallback or category filters
        setSections([]);
      }
    }
  }, [currentPage, appConfig]);

  if (sections.length === 0 && currentPage !== 'home') {
    // If it's a category page without custom layout sections, return null so App.tsx can render standard listing
    return null;
  }

  const getAnimationClass = (anim: string | undefined) => {
    if (!anim || anim === 'none') return '';
    if (anim === 'fadeIn') return 'animate-fadeIn';
    if (anim === 'slideUp') return 'animate-slideUp';
    if (anim === 'pulse') return 'animate-pulse';
    return '';
  };

  return (
    <div className="space-y-0 w-full">
      {sections.map((section, idx) => {
        if (
          !section.visible ||
          section.status === 'draft' ||
          section.status === 'inactive' ||
          section.id === 'mystery-box' ||
          section.id === 'instagram-feed' ||
          section.id === 'video-banner' ||
          section.id === 'worldcup-collection' ||
          section.id === 'popular-teams' ||
          section.id === 'shop-by-league' ||
          section.id === 'shop-by-club' ||
          section.id === 'shop-by-international-team' ||
          section.id === 'shop-by-legends' ||
          section.id === 'newsletter' ||
          section.id === 'live-auction' ||
          section.id === 'testimonials' ||
          section.id === 'community-gallery' ||
          section.id === 'latest-products' ||
          section.id === 'best-sellers' ||
          section.id === 'current-season' ||
          section.id === 'kids-collection' ||
          section.id === 'fan-edition' ||
          section.id === 'preorder-jacket' ||
          section.id === 'preorder-track-suit' ||
          section.id === 'preorder-badminton' ||
          section.id === 'all-jerseys' ||
          isRemovedHomepageCategory(section.productCategory) ||
          isRemovedHomepageCategory(section.title)
        ) {
          return null;
        }

        // Product rows with no matching products must not render — otherwise empty
        // padded shells (py-12 each) stack into large blank / colored gaps on the homepage.
        const productRowItems = isProductRowSection(section)
          ? getProductsForHomepageSection(section, catalogProducts)
          : null;
        if (productRowItems && productRowItems.length === 0) return null;

        // Same for non–product-row sections that would only show a padded empty shell
        // Hero may be empty; club logo showcase still renders under the banner slot.
        if (section.id === 'shop-by-league' && leagueItems.length === 0) return null;
        if (section.id === 'daily-deals' && (!dailyDealEnabled || flashDeals.length === 0)) return null;
        if (section.id === 'community-gallery') {
          const galleryItems = catalogProducts.filter((p) => p.isFeatured || p.isBestSeller).slice(0, 4);
          const fallback = galleryItems.length > 0 ? galleryItems : catalogProducts.slice(0, 4);
          if (fallback.length === 0) return null;
        }
        if (section.id === 'trending-searches' && trendingKeywords.length === 0) return null;

        // Known section renderers only — unknown / emptied CMS rows must not leave a colored bar
        const knownSectionIds = new Set([
          'hero-slider',
          'trending-searches',
          'daily-deals',
          'community-gallery',
          'testimonials',
          'store-locations',
        ]);
        const isKnown =
          knownSectionIds.has(section.id) || isProductRowSection(section);
        if (!isKnown) return null;

        const compactShopIds = new Set([
          'shop-by-league',
          'shop-by-club',
          'shop-by-international-team',
        ]);
        // Prefer light/transparent section shells on the premium light storefront
        const safeBg =
          !section.bgColor ||
          /emerald|amber|purple|indigo|gradient|bg-black|bg-zinc-9|bg-\[#121212\]|bg-\[#0a0a0a\]/i.test(section.bgColor)
            ? 'bg-transparent'
            : section.bgColor;
        const containerStyle =
          section.id === 'hero-slider'
            ? `bg-transparent pt-2 pb-0 sm:pt-3 sm:pb-0 lg:pt-4 lg:pb-0 my-0 ${getAnimationClass(section.animation)} transition-all duration-300 relative w-full`
            : section.id === 'trending-searches'
              ? `hidden lg:block ${safeBg} ${section.padding} ${section.margin} ${getAnimationClass(section.animation)} transition-all duration-300 relative`
              : compactShopIds.has(section.id)
                ? `bg-transparent pt-3 pb-5 sm:pt-8 sm:pb-10 lg:py-10 my-0 ${getAnimationClass(section.animation)} transition-all duration-300 relative`
                : `${safeBg} ${section.padding} ${section.margin} ${getAnimationClass(section.animation)} transition-all duration-300 relative`;
        const headingColor = 'text-[#0A0A0A]';
        const subColor = 'text-[#555555]';

        return (
          <div key={`${section.id}-${idx}`} className={containerStyle} id={`section-${section.id}`}>
            
            {/* SECTION RENDER DISTRIBUTOR */}

            {/* 1. HERO SLIDER DYNAMIC DISPLAY */}
            {section.id === 'hero-slider' && (
              <>
            {activeHeroBanners.length > 0 && (
              <div className="w-full max-w-[1440px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6">
                <div className="relative w-full overflow-hidden rounded-xl sm:rounded-2xl lg:rounded-3xl border border-[#E5E5E5] shadow-md sm:shadow-lg bg-zinc-900">
                {(() => {
                    const currentSlide = activeHeroBanners[heroSlideIndex % activeHeroBanners.length];
                    if (!currentSlide) return null;

                    const subtitleText = (currentSlide.subtitle || '').trim();
                    const titleText = (currentSlide.title || '').trim();
                    const descriptionText = (currentSlide.description || '').trim();
                    const ctaLabel = (currentSlide.cta || currentSlide.ctaText || '').trim();
                    const hasCta =
                      !!ctaLabel && !!(currentSlide.productId || (currentSlide.buttonUrl || '').trim());
                    const hasOverlay = !!(subtitleText || titleText || descriptionText || hasCta);

                    return (
                      <>
                        <HeroCoverImage banner={currentSlide} slideKey={currentSlide.id} />

                        {hasOverlay && (
                          <div className="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950/75 via-zinc-900/40 to-zinc-950/10 pointer-events-none" />
                        )}

                        {hasOverlay && (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-4 py-8 text-center text-white sm:px-8 sm:py-12 md:px-10">
                            <div className="flex max-w-4xl flex-col items-center justify-center space-y-3 sm:space-y-4 md:space-y-6">
                            {subtitleText && (
                              <span className="bg-zinc-950 text-white text-[9px] sm:text-[10px] font-mono tracking-widest px-3 py-1 sm:px-4 sm:py-1.5 rounded-full font-black uppercase">
                                {subtitleText}
                              </span>
                            )}
                            {titleText && (
                              <h1 className="text-xl sm:text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter leading-tight font-display drop-shadow-md">
                                {titleText}
                              </h1>
                            )}
                            {descriptionText && (
                              <p className="text-[11px] sm:text-xs md:text-base text-zinc-100 max-w-2xl leading-relaxed drop-shadow px-2">
                                {descriptionText}
                              </p>
                            )}
                            {hasCta && (
                              <div className="flex flex-wrap justify-center gap-3 pt-1 sm:pt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const target = currentSlide.productId
                                      ? `product:${currentSlide.productId}`
                                      : currentSlide.buttonUrl;
                                    navigateFromCmsUrl(target, {
                                      setCurrentPage,
                                      setSelectedCategory,
                                      products,
                                      onSelectProduct,
                                      openNewTab: currentSlide.openNewTab,
                                    });
                                  }}
                                  className="bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-[10px] sm:text-xs uppercase tracking-widest px-5 py-3 sm:px-8 sm:py-4 rounded-xl cursor-pointer transition-all hover:scale-105 shadow-lg shadow-black/20"
                                >
                                  {ctaLabel}
                                </button>
                              </div>
                            )}
                            </div>
                          </div>
                        )}

                        {/* Navigation Carousel Controls if multiple slides */}
                        {activeHeroBanners.length > 1 && (
                          <>
                            <button
                              onClick={() => setHeroSlideIndex((prev) => (prev === 0 ? activeHeroBanners.length - 1 : prev - 1))}
                              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white p-2 sm:p-3 rounded-full backdrop-blur-md transition-all cursor-pointer"
                              title="Previous Slide"
                            >
                              <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
                            </button>
                            <button
                              onClick={() => setHeroSlideIndex((prev) => (prev + 1) % activeHeroBanners.length)}
                              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 bg-black/40 hover:bg-black/70 text-white p-2 sm:p-3 rounded-full backdrop-blur-md transition-all cursor-pointer"
                              title="Next Slide"
                            >
                              <ChevronRight size={18} className="sm:w-5 sm:h-5" />
                            </button>

                            <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 sm:gap-2">
                              {activeHeroBanners.map((_, dotIdx) => (
                                <button
                                  key={dotIdx}
                                  onClick={() => setHeroSlideIndex(dotIdx)}
                                  className={`h-2 sm:h-2.5 rounded-full transition-all cursor-pointer ${
                                    heroSlideIndex % activeHeroBanners.length === dotIdx ? 'w-6 sm:w-8 bg-zinc-200' : 'w-2 sm:w-2.5 bg-[#121212]/50'
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
                <ClubLogoShowcase
                  clubs={clubShowcaseItems}
                  products={catalogProducts}
                  onSelectClub={(club) => {
                    setSelectedCategory('All');
                    if (onSearch) onSearch(club.searchQuery || club.name);
                    else setCurrentPage('listing');
                  }}
                />
              </>
            )}

            {/* 2. TRENDING SEARCHES BAR — desktop only (outer wrapper also hidden) */}
            {section.id === 'trending-searches' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-center gap-3 md:gap-4">
                <span className="text-[10px] font-mono font-black text-[#0A0A0A] flex items-center gap-1.5 uppercase">
                  <Flame size={12} className="text-[#E30613] animate-pulse" />
                  Trending searches BD:
                </span>
                {trendingKeywords.map((kw) => (
                  <button
                    key={kw}
                    onClick={() => {
                      setSelectedCategory('All');
                      if (onSearch) onSearch(kw);
                      setCurrentPage('listing');
                    }}
                    className="bg-white hover:bg-[#F8F8F7] text-[10.5px] font-sans font-bold border border-[#E5E5E5] text-[#0A0A0A] px-3.5 py-1.5 rounded-full cursor-pointer transition-all"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            )}

            {/* 3. SHOP BY LEAGUE — 3 cards / row on mobile */}
            {section.id === 'shop-by-league' && (
              <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-2 sm:space-y-6">
                <div className="text-center space-y-0.5 sm:space-y-2">
                  <h2 className={`text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>{section.title || 'SHOP BY FOOTBALL LEAGUE'}</h2>
                  <p className={`text-[9px] sm:text-xs font-mono ${subColor}`}>{section.subtitle || 'Sourced kits from leagues worldwide'}</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-4">
                  {leagueItems.map((league) => {
                    const liveCount = catalogProducts.filter((p) =>
                      productMatchesSearchQuery(p, league.searchQuery || league.name),
                    ).length;
                    const displayCount = liveCount > 0 ? liveCount : league.count;
                    return (
                    <button
                      key={league.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory('All');
                        if (onSearch) onSearch(league.searchQuery || league.name);
                        else setCurrentPage('listing');
                      }}
                      className="bg-white hover:bg-[#F8F8F7] border border-[#E5E5E5] rounded-lg sm:rounded-2xl p-1.5 sm:p-5 text-center cursor-pointer transition-all duration-300 group hover:scale-[1.02] flex flex-col items-center justify-between min-h-[78px] sm:min-h-[160px]"
                    >
                      <div className="h-8 w-8 sm:h-16 sm:w-16 mb-1 sm:mb-3 flex items-center justify-center overflow-hidden rounded-md bg-[#F8F8F7]">
                        <LeagueLogo league={league} className="h-8 w-8 sm:h-16 sm:w-16 group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <div className="min-w-0 w-full px-0.5">
                        <h4 className="text-[8px] sm:text-xs font-black text-[#0A0A0A] uppercase leading-tight line-clamp-2">{league.name}</h4>
                        <span className="text-[7px] sm:text-[10px] text-[#555555] font-mono font-bold mt-0.5 block">
                          <span className="sm:hidden">{displayCount}</span>
                          <span className="hidden sm:inline">{displayCount} verified jerseys</span>
                        </span>
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. LIVE AUCTIONS — hidden (demo 4-jersey block removed) */}
            {section.id === 'live-auction' && null}

            {/* 5. SHOP BY CLUB — 3 cards / row on mobile */}
            {section.id === 'shop-by-club' && (
              <div className="max-w-7xl mx-auto px-3 sm:px-6 space-y-2 sm:space-y-6">
                <div className="text-center space-y-0.5 sm:space-y-2">
                  <h2 className={`text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>{section.title || 'SHOP BY CLUB'}</h2>
                  <p className={`text-[9px] sm:text-xs font-mono ${subColor}`}>{section.subtitle || 'Authentic retro & modern club matchwear'}</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-4">
                  {DEFAULT_CLUBS.filter((c) => c.status === 'Active').map((club) => {
                    const count = catalogProducts.filter((p) =>
                      productMatchesSearchQuery(p, club.searchQuery || club.name),
                    ).length;
                    return (
                      <button
                        key={club.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory('All');
                          if (onSearch) onSearch(club.searchQuery || club.name);
                          else setCurrentPage('listing');
                        }}
                        className="bg-white hover:bg-[#F8F8F7] border border-[#E5E5E5] rounded-lg sm:rounded-2xl p-1.5 sm:p-5 text-center cursor-pointer transition-all duration-300 group hover:scale-[1.02] flex flex-col items-center justify-between min-h-[78px] sm:min-h-[160px]"
                      >
                        <div className="h-8 w-8 sm:h-16 sm:w-16 mb-1 sm:mb-3 flex items-center justify-center overflow-hidden rounded-md bg-[#F8F8F7]">
                          <img
                            src={club.logoUrl}
                            alt={`${club.name} logo`}
                            className="h-full w-full object-contain p-0.5 group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 w-full px-0.5">
                          <h4 className="text-[8px] sm:text-xs font-black text-[#0A0A0A] uppercase leading-tight line-clamp-2">
                            {club.name}
                          </h4>
                          <span className="text-[7px] sm:text-[10px] text-[#555555] font-mono font-bold mt-0.5 block">
                            <span className="sm:hidden">{count}</span>
                            <span className="hidden sm:inline">{count} verified jerseys</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. DAILY DEALS / HOT DEALS */}
            {section.id === 'daily-deals' && activeFlashDeal && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="bg-white border-2 border-[#E30613] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full min-w-0">
                  <div className="absolute top-0 right-0 bg-[#E30613] text-white font-mono text-[9px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-xl shadow-sm">
                    FLASH OFFER VAULT
                  </div>
                  
                  {/* Countdown Timer Visual */}
                  <div className="space-y-4 md:border-r border-[#E5E5E5] pr-0 md:pr-10 shrink-0">
                    <span className="bg-red-50 text-[#E30613] text-[10px] font-mono tracking-widest px-3 py-1 rounded-full font-extrabold uppercase">
                      {activeFlashDeal.deal.isHotDeal ? '🔥 HOT DEAL' : 'HURRY! LIMITED OFFER'}
                    </span>
                    <h3 className="text-2xl font-black text-[#0A0A0A] uppercase leading-tight font-display">
                      {section.title || 'HOT DEALS'}
                    </h3>
                    <p className="text-xs text-[#555555] leading-relaxed max-w-sm">
                      {flashDeals.length > 1
                        ? `Admin-picked hot deals — ${flashDeals.length} kits with fixed flash prices. Switch kits below to claim yours.`
                        : 'Admin-picked flash price on a coveted kit. Once the timer hits zero, this offer can change.'}
                    </p>
                    
                    <div className="flex gap-2 font-mono text-center">
                      <div className="bg-[#0A0A0A] text-white p-2.5 rounded-lg min-w-[50px]">
                        <span className="block font-black text-base">{String(dealTimeLeft.hrs).padStart(2, '0')}</span>
                        <span className="text-[8px] text-zinc-400">HRS</span>
                      </div>
                      <span className="text-[#0A0A0A] font-black self-center text-lg">:</span>
                      <div className="bg-[#0A0A0A] text-white p-2.5 rounded-lg min-w-[50px]">
                        <span className="block font-black text-base">{String(dealTimeLeft.mins).padStart(2, '0')}</span>
                        <span className="text-[8px] text-zinc-400">MINS</span>
                      </div>
                      <span className="text-[#0A0A0A] font-black self-center text-lg">:</span>
                      <div className="bg-[#0A0A0A] text-white p-2.5 rounded-lg min-w-[50px]">
                        <span className="block font-black text-base">{String(dealTimeLeft.secs).padStart(2, '0')}</span>
                        <span className="text-[8px] text-zinc-400">SECS</span>
                      </div>
                    </div>
                  </div>

                  {/* Highlight Deal Product card */}
                  <div className="flex-1 flex flex-col gap-4 min-w-0 w-full">
                    {flashDeals.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {flashDeals.map(({ deal, product }) => {
                          const selected = product.id === activeFlashDeal.product.id;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => setActiveDealProductId(product.id)}
                              className={`shrink-0 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 cursor-pointer transition-colors ${
                                selected
                                  ? 'border-[#E30613] bg-red-50'
                                  : 'border-[#E5E5E5] bg-white hover:bg-[#F8F8F7]'
                              }`}
                            >
                              <div className="h-10 w-8 rounded-md bg-[#F8F8F7] overflow-hidden flex items-center justify-center">
                                <JerseyRenderer
                                  productId={product.id}
                                  uploadedImage={product.uploadedImage}
                                  imageKey={product.image}
                                />
                              </div>
                              <div className="text-left max-w-[120px]">
                                <p className="text-[9px] font-black text-[#0A0A0A] uppercase truncate leading-tight">
                                  {deal.isHotDeal ? 'HOT · ' : ''}
                                  {product.name}
                                </p>
                                <p className="text-[10px] font-black text-[#E30613]">
                                  {formatPrice(deal.dealPrice)}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="h-44 w-36 rounded-xl bg-[#F8F8F7] p-2 border border-[#E5E5E5] flex items-center justify-center relative">
                        {activeFlashDeal.deal.isHotDeal && (
                          <span className="absolute -top-2 -left-2 z-10 bg-[#E30613] text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow">
                            <Flame size={10} /> Hot Deal
                          </span>
                        )}
                        <JerseyRenderer
                          productId={activeFlashDeal.product.id}
                          uploadedImage={activeFlashDeal.product.uploadedImage}
                          imageKey={activeFlashDeal.product.image}
                        />
                      </div>
                      <div className="space-y-3 flex-1 w-full">
                        <div className="flex gap-1 text-[#E30613]">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={11}
                              className={
                                i < Math.round(Number(activeFlashDeal.product.rating) || 5)
                                  ? 'fill-[#E30613]'
                                  : ''
                              }
                            />
                          ))}
                        </div>
                        <h4 className="text-base font-extrabold text-[#0A0A0A] uppercase leading-snug">
                          {activeFlashDeal.product.name}
                        </h4>
                        <p className="text-[10px] text-[#555555] font-mono">
                          Size Available:{' '}
                          {(activeFlashDeal.product.sizes || []).join(', ') || 'M, L'} •{' '}
                          {activeFlashDeal.product.condition} Condition
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {(activeFlashDeal.product.sizes || [...DEFAULT_FALLBACK_SIZES]).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setDealSize(sz)}
                              className={`h-8 w-8 rounded-lg text-[10px] font-black border cursor-pointer ${
                                dealSize === sz
                                  ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white'
                                  : 'bg-white border-[#E5E5E5] text-[#0A0A0A]'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const dealPrice = activeFlashDeal.deal.dealPrice;
                          const compareAt = dealCompareAtPrice(
                            activeFlashDeal.deal,
                            activeFlashDeal.product,
                          );
                          const savePct = dealSavePercent(
                            activeFlashDeal.deal,
                            activeFlashDeal.product,
                          );
                          const claimed =
                            activeFlashDeal.deal.claimedPercent != null
                              ? activeFlashDeal.deal.claimedPercent
                              : 80;
                          const stockLeft =
                            activeFlashDeal.deal.stockLeft != null
                              ? activeFlashDeal.deal.stockLeft
                              : Math.max(1, Number(activeFlashDeal.product.stock) || 1);
                          const pricedProduct = productWithDealPrice(
                            activeFlashDeal.product,
                            activeFlashDeal.deal,
                          );
                          return (
                            <>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-2xl font-black text-[#E30613]">
                                  {formatPrice(dealPrice)}
                                </span>
                                {compareAt > dealPrice && (
                                  <span className="text-xs text-[#555555] line-through font-bold">
                                    {formatPrice(compareAt)}
                                  </span>
                                )}
                                {savePct > 0 && (
                                  <span className="bg-rose-100 text-rose-800 text-[9px] font-mono font-black px-2 py-0.5 rounded">
                                    SAVE {savePct}%
                                  </span>
                                )}
                              </div>
                              <div className="w-full bg-[#E5E5E5] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-[#E30613] h-full transition-all"
                                  style={{ width: `${claimed}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] font-mono text-[#555555]">
                                <span>Limited stock — claim while available</span>
                                <span className="font-bold">{claimed}% Claimed</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  flyProductToCart(pricedProduct);
                                  handleQuickAdd?.(pricedProduct);
                                }}
                                className="bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest px-4 py-2.5 rounded-xl cursor-pointer w-full transition-all flex items-center justify-center gap-1.5"
                              >
                                Add to Cart
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCT ROW SECTIONS (category-driven) — empty rows skipped above */}
            {isProductRowSection(section) && productRowItems && productRowItems.length > 0 && (() => {
              const rowProducts = productRowItems;
              const category = resolveSectionCategory(section);
              const ctaLabel = section.buttonText || 'VIEW ALL';
              return (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                  <div className="flex justify-between items-end border-b border-[#E5E5E5] pb-3">
                    <div>
                      <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>
                        {section.title || section.name}
                        {section.id === 'all-jerseys' ? (
                          <span className="ml-2 text-sm md:text-base font-mono text-[#555555] normal-case tracking-normal">
                            ({catalogProducts.filter((p) => p.status !== 'Trashed' && p.status !== 'Archived' && !p.isTrashed && !p.isArchived).length})
                          </span>
                        ) : null}
                      </h2>
                      <p className={`text-xs font-mono ${subColor}`}>{section.subtitle || ''}</p>
                    </div>
                    {section.buttonText !== '' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (section.id === 'all-jerseys' || !category || /^all$/i.test(category)) {
                            setSelectedCategory?.('All');
                            setCurrentPage('listing');
                            return;
                          }
                          // Pass category as destination so history + filter apply in one step
                          setCurrentPage(category);
                        }}
                        className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg bg-white hover:bg-[#F8F8F7] text-[#0A0A0A] border border-[#0A0A0A] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {ctaLabel} <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-6">
                    {rowProducts.map((prod) => (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        onSelect={onSelectProduct}
                        onToggleWishlist={onToggleWishlist}
                        isWishlisted={isProductWishlisted(wishlist, prod.id)}
                        onQuickAdd={handleQuickAdd}
                        onUpdateImage={handleUpdateProductImage}
                        formatPrice={formatPrice}
                        onCheckout={handleCheckoutDirectly}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* 8. WORLD CUP COLLECTION — removed from storefront */}
            {section.id === 'worldcup-collection' && null}

            {/* 10. MYSTERY BOX CHALLENGE — permanently removed from storefront */}
            {section.id === 'mystery-box' && null}

            {/* 14. POPULAR TEAMS — permanently removed from storefront */}
            {section.id === 'popular-teams' && null}

            {/* 15. SHOP BY LEGENDS — removed */}
            {section.id === 'shop-by-legends' && null}

            {/* 16. COMMUNITY GALLERY — jersey showcase banners */}
            {section.id === 'community-gallery' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>{section.title || 'COLLECTORS IN DHAKA'}</h2>
                  <p className={`text-xs font-mono ${subColor}`}>{section.subtitle || 'Verified kits unboxed by Bailey Road collectors'}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(
                    (() => {
                      const featured = catalogProducts.filter((p) => p.isFeatured || p.isBestSeller).slice(0, 4);
                      return featured.length > 0 ? featured : catalogProducts.slice(0, 4);
                    })()
                  ).map((prod, idx) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => onSelectProduct(prod)}
                      className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden relative group shadow-sm text-left cursor-pointer hover:border-[#E30613] hover:-translate-y-1 transition-all"
                    >
                      <div className="h-48 w-full bg-gradient-to-b from-[#F8F8F7] to-white flex items-center justify-center p-4 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(227,6,19,0.15),transparent_55%)]" />
                        <div className="relative z-10 w-full max-w-[140px] transform group-hover:scale-105 transition-transform duration-300">
                          <JerseyRenderer productId={prod.id} uploadedImage={prod.uploadedImage} imageKey={prod.image} />
                        </div>
                      </div>
                      <div className="px-3 py-3 border-t border-[#E5E5E5] space-y-1">
                        <span className="text-[9px] font-mono font-black text-[#555555] uppercase tracking-wider">
                          {prod.brand} • Bailey Road #{idx + 1}
                        </span>
                        <h4 className="text-[11px] font-black text-[#0A0A0A] uppercase leading-snug line-clamp-2">
                          {prod.name}
                        </h4>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 17. TESTIMONIALS */}
            {section.id === 'testimonials' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>{section.title || 'VERIFIED COLLECTOR REVIEWS'}</h2>
                  <p className={`text-xs font-mono ${subColor}`}>{section.subtitle || 'Review logs verified by Bangladesh vintage authentication experts'}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 1, name: 'Siyam Rahman', quote: 'The AC Milan 1996 shirt has absolute perfect manufacturer stitching tags. Authentic holographic stamps included. Highly recommended for premium kit collectors in Dhaka.', rating: 5, date: '2026-07-12' },
                    { id: 2, name: 'Fahim Chowdhury', quote: 'Been looking for the Spain 2026 Yamal jersey for literal years. Finally secured it at Epic Vanskap with custom physics certificates. Unrivaled experience.', rating: 5, date: '2026-07-08' },
                    { id: 3, name: 'Anika Bushra', quote: 'Extremely fast delivery inside Dhaka (secured within 24 hours). The vacuum packaging smelled wonderful, complete with care instructions.', rating: 5, date: '2026-07-05' }
                  ].map((t) => (
                    <div key={t.id} className="bg-white border border-[#E5E5E5] p-5 rounded-2xl space-y-3 relative shadow-sm">
                      <div className="flex gap-1 text-[#E30613]">
                        {[...Array(t.rating)].map((_, i) => <Star key={i} size={11} className="fill-[#E30613] text-[#E30613]" />)}
                      </div>
                      <p className="text-[#555555] text-[11.5px] italic leading-relaxed">"{t.quote}"</p>
                      <div className="border-t border-[#E5E5E5] pt-2 flex justify-between items-center text-[10px] font-mono">
                        <span className="text-[#0A0A0A] font-bold">{t.name.toUpperCase()}</span>
                        <span className="text-[#555555] font-bold">✓ VERIFIED COLLECTOR</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 17b. SHOP BY INTERNATIONAL TEAM — 4 cards / row on mobile */}
            {section.id === 'shop-by-international-team' && (
              <div className="max-w-7xl mx-auto px-2.5 sm:px-6 space-y-2 sm:space-y-6">
                <div className="text-center space-y-0.5 sm:space-y-2">
                  <h2 className={`text-sm sm:text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>
                    {section.title || 'SHOP BY INTERNATIONAL TEAM'}
                  </h2>
                  <p className={`text-[9px] sm:text-xs font-mono ${subColor}`}>
                    {section.subtitle || 'National team kits from around the world'}
                  </p>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-6 gap-1 sm:gap-4">
                  {DEFAULT_INTERNATIONAL_TEAMS.filter((t) => t.status === 'Active').map((team) => {
                    const count = catalogProducts.filter((p) =>
                      productMatchesNationalTeam(p, team.searchQuery || team.name),
                    ).length;
                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory('All');
                          if (onSearch) onSearch(team.searchQuery || team.name);
                          else setCurrentPage('listing');
                        }}
                        className="bg-white hover:bg-[#F8F8F7] border border-[#E5E5E5] rounded-md sm:rounded-2xl p-1 sm:p-5 text-center cursor-pointer transition-all duration-300 group hover:scale-[1.02] flex flex-col items-center justify-between min-h-[68px] sm:min-h-[160px]"
                      >
                        <div className="h-6 w-9 sm:h-12 sm:w-[5rem] mb-0.5 sm:mb-3 flex items-center justify-center overflow-hidden rounded bg-[#F8F8F7] border border-[#E5E5E5] shrink-0">
                          <img
                            src={team.flagUrl}
                            alt={`${team.name} flag`}
                            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0 w-full px-0.5">
                          <h4 className="text-[7px] sm:text-xs font-black text-[#0A0A0A] uppercase leading-tight line-clamp-2">
                            {team.name}
                          </h4>
                          <span className="text-[6px] sm:text-[10px] text-[#555555] font-mono font-bold mt-0.5 block">
                            <span className="sm:hidden">{count}</span>
                            <span className="hidden sm:inline">{count} verified jerseys</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 18. VIDEO BANNER — removed from storefront */}
            {section.id === 'video-banner' && null}

            {/* 19. INSTAGRAM FEED — removed from storefront */}
            {section.id === 'instagram-feed' && null}

            {/* 20. NEWSLETTER — customer signup removed */}
            {section.id === 'newsletter' && null}

            {/* 21. STORE LOCATIONS */}
            {section.id === 'store-locations' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight ${headingColor}`}>{section.title || 'VISIT OUR OUTLET VAULTS'}</h2>
                  <p className={`text-xs font-mono ${subColor}`}>{section.subtitle || 'Stop by for sizing configurations and physically authenticated checks'}</p>
                </div>
                <div className={`grid grid-cols-1 ${(appConfig.footerLocations?.length || 0) > 1 ? 'md:grid-cols-2 max-w-4xl' : 'max-w-xl'} mx-auto gap-6`}>
                  {(appConfig.footerLocations?.length
                    ? appConfig.footerLocations
                    : []
                  ).map((loc) => (
                    <div key={`${loc.city}-${loc.address}`} className="bg-white border border-[#E5E5E5] p-6 rounded-2xl space-y-3 shadow-sm relative">
                      <span className="absolute top-4 right-4 text-[#555555]"><MapPin size={20} /></span>
                      <h4 className="text-xs font-black text-[#0A0A0A] uppercase">{loc.city || 'Outlet'}</h4>
                      <p className="text-[11px] text-[#555555] leading-relaxed font-sans">{loc.address}</p>
                      <div className="text-[9px] font-mono text-[#555555] space-y-1 pt-2 border-t border-[#E5E5E5]">
                        {loc.hours ? <span className="block">HOURS: {loc.hours}</span> : null}
                        {loc.phone ? <span className="block">TELEPHONE: {loc.phone}</span> : null}
                        {loc.email ? <span className="block">EMAIL: {loc.email}</span> : null}
                      </div>
                    </div>
                  ))}
                  {!appConfig.footerLocations?.length ? (
                    <p className="text-center text-xs text-[#555555] font-mono col-span-full">
                      Outlet details coming soon — check back shortly.
                    </p>
                  ) : null}
                </div>
              </div>
            )}

          </div>
        );
      })}

      {/* DYNAMIC POPUP BANNER MODAL OVERLAY */}
      {showPopupBanner && activePopupBanner && (
        <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-[#E5E5E5] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative my-auto">
            <button
              onClick={() => setShowPopupBanner(false)}
              className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-black text-white p-2 rounded-full backdrop-blur-md transition-all cursor-pointer"
              title="Close Popup"
            >
              <X size={16} />
            </button>

            <div className="relative h-56 bg-[#F8F8F7] overflow-hidden">
              <picture className="w-full h-full">
                {activePopupBanner.desktopImage && <source media="(min-width: 1024px)" srcSet={activePopupBanner.desktopImage} />}
                {activePopupBanner.tabletImage && <source media="(min-width: 640px)" srcSet={activePopupBanner.tabletImage} />}
                <img
                  src={
                    activePopupBanner.mobileImage ||
                    activePopupBanner.desktopImage ||
                    activePopupBanner.image ||
                    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800'
                  }
                  alt={activePopupBanner.title}
                  className="w-full h-full object-cover opacity-80"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-900/40 to-transparent p-6 flex flex-col justify-end">
                <span className="bg-zinc-950 text-white text-[9px] font-mono tracking-widest px-3 py-1 rounded-full font-black uppercase w-max mb-1">
                  {activePopupBanner.subtitle || 'LIMITED EDITION PROMO'}
                </span>
                <h3 className="text-2xl font-black text-white uppercase tracking-tight font-display">
                  {activePopupBanner.title}
                </h3>
              </div>
            </div>

            <div className="p-6 space-y-4 text-center">
              <p className="text-xs text-[#555555] leading-relaxed font-sans">
                {activePopupBanner.description || 'Exclusive deal offer available now for vault members.'}
              </p>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPopupBanner(false);
                    const target =
                      activePopupBanner.productId
                        ? `product:${activePopupBanner.productId}`
                        : activePopupBanner.buttonUrl;
                    navigateFromCmsUrl(target, {
                      setCurrentPage,
                      setSelectedCategory,
                      products,
                      onSelectProduct,
                      openNewTab: activePopupBanner.openNewTab,
                    });
                  }}
                  className="bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl transition-all cursor-pointer shadow-md hover:scale-[1.02]"
                >
                  {activePopupBanner.cta || activePopupBanner.ctaText || 'CLAIM EXCLUSIVE ACCESS'}
                </button>
                <button
                  onClick={() => setShowPopupBanner(false)}
                  className="text-[10px] font-mono text-[#555555] hover:underline uppercase py-1"
                >
                  No thanks, continue browsing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
