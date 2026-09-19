"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PRODUCTS, CUSTOMER_REVIEWS, SELLER_REQUESTS } from './data/storeData';
import { DEFAULT_LEAGUES } from './data/leaguesData';
import { DEFAULT_CLUBS, normalizeClubShowcase } from './data/clubsData';
import { DEFAULT_COMMUNITY_GALLERY, normalizeCommunityGallery } from './lib/communityGallery';
import { Product, CartItem, SellerRequest, Order, CarouselSlide, User, AppConfig } from './types';
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  isApiEnabled,
  isUnauthorizedError,
  setStoredUser,
  setToken,
} from './lib/apiClient';
import { canUseAdminPanel, isStaffRole } from './lib/roles';
import { cartBadgesMatch } from './lib/productAddons';
import { clearStoredOrders, loadStoredOrders, persistOrders } from './lib/orderStorage';
import {
  ensureHomepageRowsForCategories,
  normalizeHomepageSections,
} from './lib/homepageSections';
import { normalizeProductPricing } from './lib/productPricing';
import { clearNavState, loadNavState, saveNavState } from './lib/navPersistence';
import {
  ensureSpaHistoryBoot,
  navigateSpa,
  onSpaPopState,
  parseLocation,
  type SpaRoute,
} from './lib/spaRouter';
import {
  cartToSyncPayload,
  clearLocalCart,
  clearLocalWishlist,
  isProductWishlisted,
  loadLocalCart,
  loadLocalWishlist,
  mapApiCartToItems,
  mergeWishlistWithCatalog,
  pruneCartToCatalog,
  pruneWishlistToCatalog,
  saveLocalCart,
  saveLocalWishlist,
} from './lib/cartWishlistStorage';
import {
  getPrimaryOutlet,
  getShopBrandName,
  normalizeOutlets,
  outletContactLines,
} from './lib/outletInfo';
import { getProductCategories } from './lib/sizeCharts';
import {
  homepageRowCategoryCandidates,
  canonicalTargetPageName,
  productMatchesListingCategory,
  productMatchesBrand,
  productMatchesCondition,
  resolveStorefrontPage,
} from './lib/storefrontPages';
import { productMatchesSearchQuery, scoreProductForSearch } from './lib/catalogSearch';
import { isRenderableImageSrc } from './lib/productImage';
import { ListingFiltersBar } from './components/ListingFiltersBar';
import { Header } from './components/Header';
import { BrandMark } from './components/BrandMark';
import { BrandWordmark } from './components/BrandWordmark';
import { Hero } from './components/Hero';
import { ProductCard } from './components/ProductCard';
import { ProductDetails } from './components/ProductDetails';
import { Cart } from './components/Cart';
import { Checkout } from './components/Checkout';
import { AdminPanel } from './components/AdminPanel';
import { CustomerDashboard } from './components/CustomerDashboard';
import { SellerModule } from './components/SellerModule';
import { InfoPages } from './components/InfoPages';
import { Footer } from './components/Footer';
import { AuthScreen } from './components/AuthScreen';
import { CustomerAuth } from './components/CustomerAuth';
import { DynamicPageRenderer } from './components/DynamicPageRenderer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { UiFeedbackHost, toast } from './components/UiFeedback';
import { ArrowRight, CheckCircle, ShieldCheck, Heart, Sparkles, MessageSquare, BookOpen, Star, Printer, Receipt, ShoppingBag, Download } from 'lucide-react';

const INITIAL_SLIDES: CarouselSlide[] = [
  {
    id: 'slide-1',
    title: 'WORLD CUP 2026 EDITION',
    subtitle: 'The Grandest Stage of Football',
    description: 'Explore the official jerseys, limited-edition jerseys, and exclusive fan collections for the upcoming FIFA World Cup 2026. Support your nation in style!',
    badge: 'WORLD CUP 2026 EXCLUSIVE',
    primaryColor: 'from-[#0b3c5d] to-[#041c2c]',
    productId: 'shirt-1',
    customImage: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1600'
  },
  {
    id: 'slide-2',
    title: 'BECKHAM EURO 2004',
    subtitle: 'England Timeless Home Classics',
    description: 'The iconic Umbro shoulder stripe returns. Mint condition deadstock with original certificate of vintage authentication.',
    badge: 'GOLDEN GENERATION',
    primaryColor: 'from-[#1e3a8a] to-[#0f172a]',
    productId: 'shirt-2',
  },
  {
    id: 'slide-3',
    title: 'SPAIN 2026 HOME',
    subtitle: 'La Roja World Cup Collection',
    description: 'Official Spain World Cup 2026 home kit with gold trim accents. Mint deadstock with verified authentication certificates.',
    badge: 'FLASH BEST SELLER',
    primaryColor: 'from-[#7f1d1d] to-[#450a0a]',
    productId: 'shirt-1',
  }
];

const INITIAL_USERS: User[] = [
  {
    id: 'usr-super-admin',
    email: 'superadmin@epicvanskap.com',
    fullName: 'Kazi Yasin Ahmed (Super Admin Root)',
    role: 'Super Admin',
        simulatedIp: '103.230.104.5',
    location: 'Dhaka HQ, Bangladesh',
    department: 'Executive Governance',
    status: 'Active',
    permissions: ['all_access', 'manage_users', 'manage_roles', 'manage_products', 'manage_orders', 'manage_inventory', 'manage_customers', 'manage_content', 'system_settings'],
    assignedBy: 'System Root',
    createdAt: '2026-01-01',
    lastLogin: '2026-07-24 09:15 AM',
    phone: '+880 1840-990700',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'usr-admin-dhaka',
    email: 'admin@epicvanskap.com',
    fullName: 'Rashedul Bari (General Store Manager)',
    role: 'Admin',
        simulatedIp: '103.230.104.12',
    location: 'Dhaka, Bangladesh',
    department: 'Operations',
    status: 'Active',
    permissions: ['manage_products', 'manage_orders', 'manage_inventory', 'manage_customers', 'manage_content'],
    assignedBy: 'Kazi Yasin Ahmed',
    createdAt: '2026-02-10',
    lastLogin: '2026-07-23 04:30 PM',
    phone: '+880 1711-223344',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'usr-inv-mgr',
    email: 'inventory@epicvanskap.com',
    fullName: 'Tanvir Hossain (Inventory Captain)',
    role: 'Inventory Manager',
        simulatedIp: '103.230.104.22',
    location: 'Dhaka Central Warehouse',
    department: 'Warehouse & Logistics',
    status: 'Active',
    permissions: ['manage_products', 'manage_inventory', 'stock_adjustment', 'restock_logs'],
    assignedBy: 'Kazi Yasin Ahmed',
    createdAt: '2026-03-01',
    lastLogin: '2026-07-24 08:00 AM',
    phone: '+880 1819-334455',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'usr-order-mgr',
    email: 'orders@epicvanskap.com',
    fullName: 'Farzana Chowdhury (Dispatch & Courier Lead)',
    role: 'Order Manager',
        simulatedIp: '103.230.104.33',
    location: 'Bailey Road Dispatch Desk',
    department: 'Fulfillment & Express Shipping',
    status: 'Active',
    permissions: ['manage_orders', 'update_courier', 'process_refunds', 'print_invoices'],
    assignedBy: 'Kazi Yasin Ahmed',
    createdAt: '2026-03-15',
    lastLogin: '2026-07-24 09:05 AM',
    phone: '+880 1912-445566',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'usr-support',
    email: 'support@epicvanskap.com',
    fullName: 'Sultana Parveen (VIP Customer Care)',
    role: 'Customer Support',
        simulatedIp: '103.230.104.44',
    location: 'Dhaka HQ Desk',
    department: 'Customer Relations',
    status: 'Active',
    permissions: ['view_customers', 'manage_reviews', 'view_orders', 'customer_notes'],
    assignedBy: 'Rashedul Bari',
    createdAt: '2026-04-01',
    lastLogin: '2026-07-23 06:12 PM',
    phone: '+880 1515-556677',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'usr-content-mgr',
    email: 'content@epicvanskap.com',
    fullName: 'Fahim Shahriar (Creative & Media Lead)',
    role: 'Content Manager',
        simulatedIp: '103.230.104.55',
    location: 'Dhaka Studio',
    department: 'Digital Marketing',
    status: 'Active',
    permissions: ['manage_banners', 'manage_blogs', 'manage_pages', 'manage_gallery'],
    assignedBy: 'Kazi Yasin Ahmed',
    createdAt: '2026-04-10',
    lastLogin: '2026-07-22 11:30 AM',
    phone: '+880 1611-778899',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'usr-seller-partner',
    email: 'seller.partner@vault.bd',
    fullName: 'Anik Rahman (Verified Vintage Collector Partner)',
    role: 'Seller',
        simulatedIp: '103.230.104.66',
    location: 'Chittagong, Bangladesh',
    department: 'Seller Portal',
    status: 'Active',
    permissions: ['seller_portal', 'submit_kits', 'view_own_sales'],
    assignedBy: 'Rashedul Bari',
    createdAt: '2026-05-01',
    lastLogin: '2026-07-21 02:20 PM',
    phone: '+880 1818-990011',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=200'
  },
  {
    id: 'customer-marcus',
    email: 'customer@vault.com',
    fullName: 'Marcus Rashford',
    role: 'Customer',
        simulatedIp: '82.165.122.9',
    location: 'Manchester, UK',
    department: 'Buyer',
    status: 'Active',
    permissions: [],
    phone: '+44 7700 900077',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200'
  }
];

const DEFAULT_APP_CONFIG: AppConfig = {
  logoText: 'Epic Vanskap',
  logoSubtext: '',
  theme: 'bengal',
  footerAbout: "The world's premium destination for verified original vintage football jerseys. Founded by obsessive collectors, for obsessive collectors. Every kit undergoes a rigorous 12-point authentication process in our physical workshop in Feni, Bangladesh.",
  footerLocations: [
    {
      city: 'Feni',
      address: 'Shop no: B: 67-68, 1st Floor, Feni Garden City Market, Feni, 3900',
      phone: '+880 1840-990700',
      email: 'support@epicvanskap.com',
    },
  ],
  footerCopyright: '© 2026 Epic Vanskap. All rights reserved.',
  socialLinks: {
    facebook: 'https://www.facebook.com/share/19N5mZgVt4/?mibextid=wwXIfr',
    instagram: 'https://www.instagram.com/retro._.walaa?stkn=ZXQwYzl1anF5eGR6',
    tiktok: 'https://www.tiktok.com/@epic_vanskap?_r=1&_t=ZS-99rOqRbSjx7',
  },
  currencySymbol: '৳',
  currencyCode: 'BDT',
  exchangeRate: 115,
  timerTeam1: 'ESP',
  timerTeam1Emoji: '🇪🇸',
  timerTeam2: 'BEL',
  timerTeam2Emoji: '🇧🇪',
  timerLabel: 'QUARTER-FINAL',
  timerTargetHours: 20,
  timerEnabled: true,
  dailyDealProductId: undefined,
  dailyDealEnabled: false,
  dailyDealItems: [],
  dailyDealEndsAt: null,
  bkashPersonalNumber: '01865962232',
  bkashEnabled: true,
  bkashPaymentMode: 'both',
  bkashPartialAmountBdt: 300,
  leagues: DEFAULT_LEAGUES,
  clubs: DEFAULT_CLUBS.map((c) => ({ ...c })),
  communityGallery: {
    ...DEFAULT_COMMUNITY_GALLERY,
    images: DEFAULT_COMMUNITY_GALLERY.images.map((img) => ({ ...img })),
  },
  tournamentPatches: [
    { id: 'patch-wc26', label: 'WC 26', priceBdt: 100 },
    { id: 'patch-ucl', label: 'UCL', priceBdt: 100 },
    { id: 'patch-pl', label: 'Premier League', priceBdt: 100 },
    { id: 'patch-laliga', label: 'La Liga', priceBdt: 100 },
  ],
  customSizeCharts: [],
  pages: [
    { id: 'Premier League', name: 'Premier League', slug: 'premier-league', isCustom: false, visible: true, sections: [] },
    { id: 'La Liga', name: 'LALIGA', slug: 'laliga', isCustom: false, visible: true, sections: [] },
    { id: 'Ligue 1', name: 'Ligue 1', slug: 'ligue-1', isCustom: false, visible: true, sections: [] },
    { id: 'Serie A', name: 'Serie A', slug: 'serie-a', isCustom: false, visible: true, sections: [] },
    { id: 'Bundesliga', name: 'Bundesliga', slug: 'bundesliga', isCustom: false, visible: true, sections: [] },
    { id: 'MLS', name: 'MLS', slug: 'mls', isCustom: false, visible: true, sections: [] },
    { id: 'Other Leagues', name: 'Other Leagues', slug: 'other-leagues', isCustom: false, visible: true, sections: [] },
    { id: 'International Teams', name: 'International Teams', slug: 'international-teams', isCustom: false, visible: true, sections: [] },
    { id: 'Clearance', name: 'Catalog', slug: 'catalog', isCustom: false, visible: true, sections: [] },
  ],
  homepageSections: [
    { id: 'hero-slider', name: 'Hero Banner Slider', visible: true, bgColor: 'bg-transparent', padding: 'py-0', margin: 'my-0', title: 'WORLD CUP 2026 EDITION', subtitle: 'The Grandest Stage of Football', status: 'active' },
    { id: 'trending-searches', name: 'Trending Searches bar', visible: true, bgColor: 'bg-transparent', padding: 'py-3.5', margin: 'my-2', status: 'active' },
    { id: 'live-auction', name: 'Bidding & Live Auctions', visible: false, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', status: 'inactive' },
    { id: 'daily-deals', name: 'Daily Deals Countdown', visible: false, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-4', title: 'LIMITED DAILY DEAL DECK', subtitle: '24-hour flash sale on ultra rare collectibles', status: 'inactive' },
    { id: 'featured-collection', name: 'Featured Collection Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'VERIFIED FEATURED CLASSICS', subtitle: 'Curated 1-of-1 historic collectibles', status: 'active', sectionType: 'product-row', productCategory: 'Featured', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'retro-collection', name: 'Retro Collection Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'RETRO', subtitle: 'Rare 80s, 90s & 2000s vintage reissues', status: 'active', sectionType: 'product-row', productCategory: 'Retro', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'product-row-la-liga', name: 'La Liga Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'LA LIGA', subtitle: 'Shop La Liga — curated picks for collectors', status: 'active', sectionType: 'product-row', productCategory: 'La Liga', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'product-row-world-cup', name: 'World Cup Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'WORLD CUP', subtitle: 'National team World Cup kits & vault classics', status: 'active', sectionType: 'product-row', productCategory: 'World Cup', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'player-edition', name: 'Player Edition Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'PLAYER EDITION', subtitle: 'Slim-fit match issue quality kits', status: 'active', sectionType: 'product-row', productCategory: 'Player Edition', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'product-row-premier-league', name: 'Premier League Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'PREMIER LEAGUE', subtitle: 'Shop Premier League — curated picks for collectors', status: 'active', sectionType: 'product-row', productCategory: 'Premier League', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'community-gallery', name: 'Community Gallery', visible: true, bgColor: 'bg-white', padding: 'py-14', margin: 'my-0', title: 'JOIN THE VANSKAP COMMUNITY', subtitle: '+6,783 Members Since 2024.', status: 'active' },
    { id: 'customised-kit', name: 'Customised Kit Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'CUSTOMISED KIT', subtitle: 'Custom printed kits with full size guide', status: 'active', sectionType: 'product-row', productCategory: 'Customised Kit', buttonText: 'VIEW ALL', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'clearance', name: 'Catalog Row', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'CATALOG', subtitle: 'Browse the full Catalog collection', status: 'active', sectionType: 'product-row', productCategory: 'Clearance', buttonText: 'VIEW CATALOG', buttonUrl: 'listing', maxProducts: 4 },
    { id: 'store-locations', name: 'Physical Store Maps', visible: true, bgColor: 'bg-transparent', padding: 'py-12', margin: 'my-0', title: 'PHYSICAL OUTLET POINTS', subtitle: 'Visit us for physical sizing and authentications', status: 'active' }
  ],
  banners: [
    {
      id: 'banner-hero-1',
      name: 'Hero Banner Slider',
      type: 'Hero Slider',
      desktopImage: '/hero-cover.svg',
      tabletImage: '/hero-cover.svg',
      mobileImage: '/hero-cover.svg',
      title: 'WORLD CUP 2026 EDITION',
      subtitle: 'The Grandest Stage of Football',
      description: 'Support your nation with authentic retro & current match kits.',
      cta: 'SHOP NOW',
      ctaText: 'SHOP NOW',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-08-31',
      status: 'Active'
    },
    {
      id: 'banner-hero-2',
      name: 'Spain 2026 Hero',
      type: 'Hero Slider',
      desktopImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=640',
      title: '2026 SPAIN WORLD CUP HOME',
      subtitle: 'NEW IN',
      description: 'La Roja official home kit for FIFA World Cup 2026. Gold trim, verified mint stock.',
      cta: 'SHOP NOW',
      ctaText: 'SHOP NOW',
      buttonUrl: 'product:shirt-1',
      productId: 'shirt-1',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-hero-3',
      name: 'Best Sellers Hero',
      type: 'Hero Slider',
      desktopImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=640',
      title: 'BEST SELLERS VAULT',
      subtitle: 'TOP DEMAND CLASSICS',
      description: 'England 2004, Brazil 2002, Spain 2026, and Arsenal Highbury — shop the most requested kits.',
      cta: 'SHOP BEST SELLERS',
      ctaText: 'SHOP BEST SELLERS',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-hero-4',
      name: 'Bangladesh Classics Hero',
      type: 'Hero Slider',
      desktopImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=640',
      title: 'ENGLAND CLASSIC HOME',
      subtitle: 'GOLDEN GENERATION',
      description: 'Beckham Euro 2004 Umbro home — mint deadstock with original authentication.',
      cta: 'SHOP ENGLAND',
      ctaText: 'SHOP ENGLAND',
      buttonUrl: 'product:shirt-2',
      productId: 'shirt-2',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-hero-5',
      name: 'Arsenal Highbury Hero',
      type: 'Hero Slider',
      desktopImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=640',
      title: 'ARSENAL HIGHBURY 2005',
      subtitle: 'REDCURRANT LEGEND',
      description: 'Henry #14 final season at Highbury. Gold embroidery, verified Bailey Road stock.',
      cta: 'SHOP NOW',
      ctaText: 'SHOP NOW',
      buttonUrl: 'product:shirt-8',
      productId: 'shirt-8',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-category-1',
      name: 'Category Banner',
      type: 'Category Banner',
      desktopImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=640',
      title: 'VINTAGE CLUB CLASSICS',
      subtitle: 'Sourced Direct from European Vaults',
      description: 'Rare 90s Manchester United, Real Madrid, AC Milan, and Barcelona kits.',
      cta: 'EXPLORE CLUBS',
      ctaText: 'EXPLORE CLUBS',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-collection-1',
      name: 'Collection Banner',
      type: 'Collection Banner',
      desktopImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=640',
      title: 'QATAR 2022 CHAMPIONS',
      subtitle: 'Argentina Three Stars',
      description: 'Exclusive re-issue of Messi No.10 authentic match jerseys.',
      cta: 'CLAIM KIT',
      ctaText: 'CLAIM KIT',
      buttonUrl: 'listing',
      openNewTab: true,
      scheduleStart: '2026-07-10',
      scheduleEnd: '2026-08-10',
      status: 'Active'
    },
    {
      id: 'banner-league-1',
      name: 'League Banner',
      type: 'League Banner',
      desktopImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=640',
      title: 'PREMIER LEAGUE ANTHOLOGY',
      subtitle: 'English Heritage Collections',
      description: 'Unrivaled collections of English soccer legacy.',
      cta: 'EXPLORE LEAGUE',
      ctaText: 'EXPLORE LEAGUE',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-09-30',
      status: 'Active'
    },
    {
      id: 'banner-popup-1',
      name: 'Popup Banner',
      type: 'Popup Banner',
      desktopImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=1200',
      tabletImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=800',
      mobileImage: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=640',
      title: 'WELCOME TO DHAKA VAULT',
      subtitle: 'Shop verified original football jerseys',
      description: 'Verified physical stock on Bailey Road. Full catalog available online.',
      cta: 'SHOP ALL JERSEYS',
      ctaText: 'SHOP ALL JERSEYS',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-15',
      scheduleEnd: '2026-08-31',
      status: 'Inactive'
    },
    {
      id: 'banner-offer-1',
      name: 'Offer Banner',
      type: 'Offer Banner',
      desktopImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=640',
      title: 'MONSOON CLEARANCE SURGE',
      subtitle: 'Up to 45% Off Selected Deadstock Kits',
      description: 'No replicas. Pure original vintage jerseys. While physical stocks last.',
      cta: 'SHOP CLEARANCE',
      ctaText: 'SHOP CLEARANCE',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-18',
      scheduleEnd: '2026-08-15',
      status: 'Active'
    },
    {
      id: 'banner-newsletter-1',
      name: 'Newsletter Banner',
      type: 'Newsletter Banner',
      desktopImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=640',
      title: 'JOIN THE COLLECTORS CIRCLE',
      subtitle: 'Get Notified of Dhaka Restocks First',
      description: 'No spam. Just ultra-rare physical kit drops sent straight to your inbox.',
      cta: 'SUBSCRIBE NOW',
      ctaText: 'SUBSCRIBE NOW',
      buttonUrl: 'newsletter',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-footer-1',
      name: 'Footer Banner',
      type: 'Footer Banner',
      desktopImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=640',
      title: 'DHAKA AUTHENTICATION LAB',
      subtitle: '100% Genuine Physical Guarantee',
      description: 'Every jersey inspected under 12-point micro-stitching and holographic tag protocols.',
      cta: 'READ PROMISE',
      ctaText: 'READ PROMISE',
      buttonUrl: 'about',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-blog-1',
      name: 'Blog Banner',
      type: 'Blog Banner',
      desktopImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=640',
      title: 'RETRO KIT JOURNAL',
      subtitle: 'Stories Behind Iconic World Cup Apparel',
      description: 'Explore historical deep dives on legendary jersey designs and match-worn artifacts.',
      cta: 'READ JOURNAL',
      ctaText: 'READ JOURNAL',
      buttonUrl: 'blogs',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    },
    {
      id: 'banner-mobile-1',
      name: 'Mobile Banner',
      type: 'Mobile Banner',
      desktopImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1600',
      tabletImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1024',
      mobileImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=640',
      title: 'DHAKA EXPRESS DELIVERY',
      subtitle: 'Same-Day Shipping Across Dhaka',
      description: 'Order authentic kits before 3 PM for instant physical delivery to your doorstep.',
      cta: 'EXPRESS ORDER',
      ctaText: 'EXPRESS ORDER',
      buttonUrl: 'listing',
      openNewTab: false,
      scheduleStart: '2026-07-01',
      scheduleEnd: '2026-12-31',
      status: 'Active'
    }
  ],
  menuItems: [
    // Main Menu — all stock + league storefront pages
    { id: 'nav-main-0', name: 'All Jerseys', placement: 'Main Menu', parentId: null, icon: 'Layers', order: 0, url: 'All', status: 'Active' },
    { id: 'nav-main-1', name: 'Premier League', placement: 'Main Menu', parentId: null, icon: 'Trophy', order: 1, url: 'Premier League', status: 'Active' },
    { id: 'nav-main-2', name: 'LALIGA', placement: 'Main Menu', parentId: null, icon: 'Award', order: 2, url: 'La Liga', status: 'Active' },
    { id: 'nav-main-3', name: 'Ligue 1', placement: 'Main Menu', parentId: null, icon: 'Shirt', order: 3, url: 'Ligue 1', status: 'Active' },
    { id: 'nav-main-4', name: 'Serie A', placement: 'Main Menu', parentId: null, icon: 'ShieldCheck', order: 4, url: 'Serie A', status: 'Active' },
    { id: 'nav-main-5', name: 'Bundesliga', placement: 'Main Menu', parentId: null, icon: 'Flame', order: 5, url: 'Bundesliga', status: 'Active' },
    { id: 'nav-main-6', name: 'MLS', placement: 'Main Menu', parentId: null, icon: 'Star', order: 6, url: 'MLS', status: 'Active' },
    { id: 'nav-main-7', name: 'Other Leagues', placement: 'Main Menu', parentId: null, icon: 'Globe', order: 7, url: 'Other Leagues', status: 'Active' },
    { id: 'nav-main-8', name: 'International Teams', placement: 'Main Menu', parentId: null, icon: 'Globe', order: 8, url: 'International Teams', status: 'Active' },
    { id: 'nav-main-9', name: 'Catalog', placement: 'Main Menu', parentId: null, icon: 'Tag', order: 9, url: 'Clearance', status: 'Active' },

    // Mega Menu (opened via MORE)
    { id: 'nav-mega-cat-1', name: 'Top Clubs', placement: 'Mega Menu', parentId: null, icon: 'Trophy', order: 1, url: '#listing', status: 'Active' },
    { id: 'nav-mega-item-1', name: 'Real Madrid', placement: 'Mega Menu', parentId: 'nav-mega-cat-1', icon: 'Shirt', order: 1, url: 'Real Madrid', status: 'Active' },
    { id: 'nav-mega-item-2', name: 'FC Barcelona', placement: 'Mega Menu', parentId: 'nav-mega-cat-1', icon: 'Award', order: 2, url: 'Barcelona', status: 'Active' },
    { id: 'nav-mega-item-3', name: 'Manchester United', placement: 'Mega Menu', parentId: 'nav-mega-cat-1', icon: 'ShieldCheck', order: 3, url: 'Manchester United', status: 'Active' },

    { id: 'nav-mega-cat-2', name: 'Player Editions', placement: 'Mega Menu', parentId: null, icon: 'Star', order: 2, url: '#listing', status: 'Active' },
    { id: 'nav-mega-item-4', name: 'Messi', placement: 'Mega Menu', parentId: 'nav-mega-cat-2', icon: 'Sparkles', order: 1, url: 'Messi', status: 'Active' },
    { id: 'nav-mega-item-5', name: 'Ronaldo', placement: 'Mega Menu', parentId: 'nav-mega-cat-2', icon: 'Flame', order: 2, url: 'Ronaldo', status: 'Active' },
    { id: 'nav-mega-item-6', name: 'Retro Classics', placement: 'Mega Menu', parentId: 'nav-mega-cat-2', icon: 'Trophy', order: 3, url: 'Retro', status: 'Active' },

    { id: 'nav-mega-cat-3', name: 'National Teams', placement: 'Mega Menu', parentId: null, icon: 'Globe', order: 3, url: 'International Teams', status: 'Active' },
    { id: 'nav-mega-item-7', name: 'Argentina', placement: 'Mega Menu', parentId: 'nav-mega-cat-3', icon: 'Globe', order: 1, url: 'Argentina', status: 'Active' },
    { id: 'nav-mega-item-8', name: 'Brazil', placement: 'Mega Menu', parentId: 'nav-mega-cat-3', icon: 'Globe', order: 2, url: 'Brazil', status: 'Active' },

    // Footer Menu Items
    { id: 'nav-footer-1', name: 'Sell Your Shirts', placement: 'Footer Menu', parentId: null, icon: 'ShieldCheck', order: 1, url: 'seller', status: 'Active' },
    { id: 'nav-footer-2', name: 'Frequently Asked Questions', placement: 'Footer Menu', parentId: null, icon: 'HelpCircle', order: 2, url: 'faq', status: 'Active' },
    { id: 'nav-footer-3', name: 'About Epic Vanskap', placement: 'Footer Menu', parentId: null, icon: 'Globe', order: 3, url: 'about', status: 'Active' },
    { id: 'nav-footer-4', name: 'Contact Store', placement: 'Footer Menu', parentId: null, icon: 'Phone', order: 4, url: 'contact', status: 'Active' },
    { id: 'nav-footer-5', name: 'Customer Authenticity Guarantee', placement: 'Footer Menu', parentId: null, icon: 'Award', order: 5, url: 'authenticity', status: 'Active' },
    { id: 'nav-footer-6', name: 'My Wishlist', placement: 'Footer Menu', parentId: null, icon: 'Heart', order: 6, url: 'dashboard', status: 'Active' },
  ]
};

export default function App() {
  // Boot from URL only. Bare `/` (Google, bookmarks, typed domain) ALWAYS opens Home —
  // never restore a previous listing from localStorage (that broke “open site → home”).
  const bootRoute = useMemo((): SpaRoute => {
    if (typeof window === 'undefined') return { page: 'home', category: 'All' };
    const fromUrl = parseLocation();
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path === '/' && fromUrl.page === 'home') {
      try {
        saveNavState({ page: 'home', category: 'All', search: '', productId: null });
      } catch {
        /* ignore */
      }
      return { page: 'home', category: 'All', search: '', productId: null };
    }
    return fromUrl;
  }, []);

  // Navigation State — URL-driven so browser Back/Forward works
  const [currentPage, setCurrentPage] = useState<string>(() => bootRoute.page || 'home');
  const [checkoutLoginRequired, setCheckoutLoginRequired] = useState(false);
  const [staffLoginRequired, setStaffLoginRequired] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(
    () => bootRoute.productId || null,
  );
  const [adminTab, setAdminTab] = useState<string>(() => bootRoute.adminTab || 'dashboard');
  const skipNextUrlPush = useRef(false);
  const cartSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Catalog: when API is on, NEVER seed from localStorage — wait for Neon hydrate
  const [products, setProducts] = useState<Product[]>(() => {
    if (isApiEnabled()) {
      try {
        localStorage.removeItem('vault_custom_products');
      } catch {
        /* ignore */
      }
      return [];
    }

    const migrateProducts = (list: Product[]): Product[] => {
      const spainSeed = PRODUCTS.find((p) => p.id === 'shirt-1')!;
      return list
        .filter((p) => p.category !== 'Mystery' && !/mystery/i.test(p.name) && p.id !== 'shirt-7' && p.id !== 'mystery-box-item')
        .map((p) => {
          if (
            p.id === 'shirt-1' ||
            /1998 france/i.test(p.name) ||
            p.slug === '1998-france-world-cup-home' ||
            p.image === 'france_home_1998'
          ) {
            return {
              ...spainSeed,
              uploadedImage: p.uploadedImage,
              stock: p.stock ?? spainSeed.stock,
            };
          }
          if (p.id === 'shirt-8' && !p.isBestSeller) {
            return { ...p, isBestSeller: true };
          }
          return p;
        });
    };

    const stored = localStorage.getItem('vault_custom_products');
    if (stored) {
      try {
        const migrated = migrateProducts(JSON.parse(stored));
        const ids = new Set(migrated.map((p) => p.id));
        return [...migrated, ...PRODUCTS.filter((p) => !ids.has(p.id) && p.category !== 'Mystery')];
      } catch {
        return PRODUCTS;
      }
    }
    return PRODUCTS;
  });

  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>(SELLER_REQUESTS);
  const [orders, setOrders] = useState<Order[]>(() => loadStoredOrders());
  const [cart, setCart] = useState<CartItem[]>(() => loadLocalCart());
  const [wishlist, setWishlist] = useState<Product[]>(() => {
    const storedUser = getStoredUser<{ id?: string }>();
    return loadLocalWishlist(storedUser?.id);
  });
  
  // Selected Detail product
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Last Order Confirmation Screen
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // App customization configuration state
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    // Live API: homepage rows & CMS come from Neon — not per-browser localStorage.
    // Seed last-known banners from cache so refresh doesn't flash a different hero image.
    if (isApiEnabled()) {
      let cachedBanners: AppConfig['banners'] | undefined;
      try {
        const raw = localStorage.getItem('vault_cms_banners_cache');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) cachedBanners = parsed;
        }
      } catch {
        /* ignore corrupt cache */
      }
      return {
        ...DEFAULT_APP_CONFIG,
        banners: cachedBanners
          ? cachedBanners
          : (DEFAULT_APP_CONFIG.banners || []).map((b) =>
              b.type === 'Hero Slider' ? { ...b, status: 'Inactive' as const } : b,
            ),
      };
    }
    const stored = localStorage.getItem('vault_app_config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (
          parsed.logoText === 'THE VAULT BD' ||
          parsed.logoText === 'Epic Vanskap BD' ||
          parsed.logoText === 'Epic Vanskap'
        ) {
          parsed.logoText = 'Epic Vanskap';
        }
        parsed.logoSubtext = '';
        // Keep admin-saved outlets; only fill default if missing/empty
        const savedOutlets = normalizeOutlets(parsed.footerLocations);
        parsed.footerLocations =
          savedOutlets.length > 0 ? savedOutlets : DEFAULT_APP_CONFIG.footerLocations;
        parsed.menuItems = DEFAULT_APP_CONFIG.menuItems;
        parsed.pages = DEFAULT_APP_CONFIG.pages;
        if (!parsed.banners || !Array.isArray(parsed.banners) || parsed.banners.length === 0) {
          parsed.banners = DEFAULT_APP_CONFIG.banners;
        } else {
          const heroDefaults = (DEFAULT_APP_CONFIG.banners || []).filter((b) => b.type === 'Hero Slider');
          const existingHeroIds = new Set(
            parsed.banners.filter((b: any) => b.type === 'Hero Slider' || b.id?.startsWith('banner-hero')).map((b: any) => b.id)
          );
          heroDefaults.forEach((hero) => {
            if (!existingHeroIds.has(hero.id)) {
              parsed.banners = [...parsed.banners, hero];
            }
          });
        }
        // Always use curated league list (Premier…MLS) with official logos
        if (parsed.leagues) {
          parsed.leagues = DEFAULT_LEAGUES;
        }
        if (Array.isArray(parsed.clubs)) {
          parsed.clubs = normalizeClubShowcase(parsed.clubs);
        } else {
          parsed.clubs = DEFAULT_CLUBS.map((c) => ({ ...c }));
        }
        if (parsed.dailyDealEnabled === undefined) {
          parsed.dailyDealEnabled = false;
        }
        if (!Array.isArray(parsed.dailyDealItems)) {
          parsed.dailyDealItems = [];
        }
        if (parsed.dailyDealEndsAt === undefined) {
          parsed.dailyDealEndsAt = null;
        }
        parsed.bkashPersonalNumber = '01865962232';
        if (parsed.bkashEnabled === undefined) {
          parsed.bkashEnabled = true;
        }
        if (!parsed.bkashPaymentMode || parsed.bkashPaymentMode === 'full') {
          parsed.bkashPaymentMode = 'both';
        }
        if (parsed.bkashPartialAmountBdt === undefined) {
          parsed.bkashPartialAmountBdt = 300;
        }
        if (parsed.banners && Array.isArray(parsed.banners)) {
          const heroById = new Map(
            (DEFAULT_APP_CONFIG.banners || [])
              .filter((b) => b.type === 'Hero Slider')
              .map((b) => [b.id, b])
          );
          const isOk = (src?: string) =>
            !!src &&
            (/^https?:\/\//i.test(src) ||
              src.startsWith('data:image/') ||
              (src.startsWith('/') && /\.[a-z0-9]+($|\?)/i.test(src)));
          parsed.banners = parsed.banners.map((b: any) => {
            const hero = heroById.get(b.id);
            const cleanedUrl = String(b.buttonUrl || '')
              .replace(/^#/, '')
              .replace(/^\//, '');
            const desktop =
              (isOk(b.desktopImage) && b.desktopImage) ||
              (isOk(b.image) && b.image) ||
              hero?.desktopImage ||
              'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1600';
            return {
              ...b,
              desktopImage: desktop,
              tabletImage: (isOk(b.tabletImage) && b.tabletImage) || hero?.tabletImage || desktop,
              mobileImage: (isOk(b.mobileImage) && b.mobileImage) || hero?.mobileImage || desktop,
              image: desktop,
              buttonUrl: hero?.buttonUrl || cleanedUrl || 'listing',
              productId: hero?.productId ?? b.productId,
            };
          });
        }
        if (parsed.homepageSections && Array.isArray(parsed.homepageSections)) {
          const hideIds = new Set([
            'mystery-box',
            'instagram-feed',
            'video-banner',
            'worldcup-collection',
            'live-auction',
            'shop-by-legends',
            'shop-by-league',
            'shop-by-club',
            'shop-by-international-team',
            'latest-products',
            'best-sellers',
            'current-season',
            'kids-collection',
            'fan-edition',
            'preorder-jacket',
            'preorder-track-suit',
            'preorder-badminton',
            'all-jerseys',
          ]);
          parsed.homepageSections = parsed.homepageSections.map((s: any) => {
            if (hideIds.has(s.id)) return { ...s, visible: false, status: 'inactive' };
            if (s.id === 'featured-collection') return { ...s, sectionType: 'product-row', productCategory: s.productCategory || 'Featured', buttonText: s.buttonText ?? 'VIEW ALL', buttonUrl: s.buttonUrl || 'listing', maxProducts: s.maxProducts ?? 4 };
            if (s.id === 'player-edition') return { ...s, visible: true, status: 'active', sectionType: 'product-row', productCategory: s.productCategory || 'Player Edition', buttonText: s.buttonText ?? 'VIEW ALL', buttonUrl: s.buttonUrl || 'listing', maxProducts: s.maxProducts ?? 4 };
            if (s.id === 'retro-collection') return { ...s, visible: true, status: 'active', sectionType: 'product-row', productCategory: s.productCategory || 'Retro', buttonText: s.buttonText ?? 'VIEW ALL', buttonUrl: s.buttonUrl || 'listing', maxProducts: s.maxProducts ?? 4 };
            if (s.id === 'customised-kit') return { ...s, visible: true, status: 'active', sectionType: 'product-row', productCategory: s.productCategory || 'Customised Kit', buttonText: s.buttonText ?? 'VIEW ALL', buttonUrl: s.buttonUrl || 'listing', maxProducts: s.maxProducts ?? 4 };
            if (s.id === 'clearance') return { ...s, sectionType: 'product-row', productCategory: s.productCategory || 'Clearance', title: s.title?.includes('OUTLET') ? 'CATALOG' : (s.title || 'CATALOG'), buttonText: /outlet/i.test(s.buttonText || '') ? 'VIEW CATALOG' : (s.buttonText ?? 'VIEW CATALOG'), buttonUrl: s.buttonUrl || 'listing', maxProducts: s.maxProducts ?? 4 };
            if (s.id === 'hero-slider') return { ...s, visible: true, status: 'active', bgColor: 'bg-transparent', padding: 'py-0', margin: 'my-0' };
            return s;
          });
          parsed.homepageSections = normalizeHomepageSections(parsed.homepageSections);
          const rowDefaults = (DEFAULT_APP_CONFIG.homepageSections || []).filter((s) =>
            ['player-edition', 'retro-collection', 'customised-kit'].includes(s.id),
          );
          const existingIds = new Set(parsed.homepageSections.map((s: any) => s.id));
          const missingRows = rowDefaults.filter((s) => !existingIds.has(s.id));
          if (missingRows.length) {
            const featuredIdx = parsed.homepageSections.findIndex((s: any) => s.id === 'featured-collection');
            const insertAt = featuredIdx >= 0 ? featuredIdx + 1 : parsed.homepageSections.length;
            parsed.homepageSections = normalizeHomepageSections([
              ...parsed.homepageSections.slice(0, insertAt),
              ...missingRows,
              ...parsed.homepageSections.slice(insertAt),
            ]);
          }
        }
        if (parsed.menuItems && Array.isArray(parsed.menuItems)) {
          parsed.menuItems = parsed.menuItems.filter(
            (m: any) => !/mystery/i.test(m.name || '') && m.url !== 'Mystery'
          );
        }
        if (parsed.pages && Array.isArray(parsed.pages)) {
          parsed.pages = parsed.pages.filter((p: any) => p.id !== 'Mystery' && !/mystery/i.test(p.name || ''));
        }
        return parsed;
      } catch (e) {
        return DEFAULT_APP_CONFIG;
      }
    }
    return DEFAULT_APP_CONFIG;
  });

  const cmsSettingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCmsSettingsRef = useRef<AppConfig | null>(null);

  const handleUpdateConfig = (newConfig: AppConfig | ((prev: AppConfig) => AppConfig)) => {
    setAppConfig((prev) => {
      const resolved = typeof newConfig === 'function' ? newConfig(prev) : newConfig;
      if (!isApiEnabled()) {
        try {
          localStorage.setItem('vault_app_config', JSON.stringify(resolved));
        } catch {
          /* ignore */
        }
      }
      if (isApiEnabled() && getToken()) {
        // Debounce settings writes — typing logo/timer fields was flooding Neon with PUTs
        pendingCmsSettingsRef.current = resolved;
        if (cmsSettingsSaveTimer.current) clearTimeout(cmsSettingsSaveTimer.current);
        cmsSettingsSaveTimer.current = setTimeout(() => {
          const cfg = pendingCmsSettingsRef.current;
          if (!cfg || !getToken()) return;
          void api
            .updateCmsSettings({
              logoText: cfg.logoText,
              logoSubtext: cfg.logoSubtext,
              theme: cfg.theme,
              footerAbout: cfg.footerAbout,
              footerCopyright: cfg.footerCopyright,
              socialLinks: cfg.socialLinks || {},
              currencySymbol: cfg.currencySymbol,
              currencyCode: cfg.currencyCode,
              exchangeRate: cfg.exchangeRate,
              timerTeam1: cfg.timerTeam1,
              timerTeam1Emoji: cfg.timerTeam1Emoji,
              timerTeam2: cfg.timerTeam2,
              timerTeam2Emoji: cfg.timerTeam2Emoji,
              timerLabel: cfg.timerLabel,
              timerTargetHours: cfg.timerTargetHours,
              timerEnabled: cfg.timerEnabled,
              dailyDealProductId: cfg.dailyDealProductId,
              dailyDealEnabled: cfg.dailyDealEnabled,
              dailyDealItems: cfg.dailyDealItems || [],
              dailyDealEndsAt: cfg.dailyDealEndsAt || null,
              bkashPersonalNumber: cfg.bkashPersonalNumber,
              bkashEnabled: cfg.bkashEnabled,
              bkashPaymentMode: cfg.bkashPaymentMode,
              bkashPartialAmountBdt: cfg.bkashPartialAmountBdt,
              menuItems: cfg.menuItems,
              footerLocations: cfg.footerLocations,
              categoryItems: cfg.categoryItems,
              tournamentPatches: cfg.tournamentPatches || [],
              clubShowcase: normalizeClubShowcase(cfg.clubs),
              communityGallery: normalizeCommunityGallery(cfg.communityGallery),
              customSizeCharts: cfg.customSizeCharts || [],
            })
            .catch((err) => {
              console.error('Failed to persist CMS settings', err);
            });
        }, 800);

        if (resolved.pages && resolved.pages !== prev.pages) {
          const prevIds = new Set((prev.pages || []).map((p) => p.id));
          const nextIds = new Set(resolved.pages.map((p) => p.id));
          for (const page of resolved.pages) {
            const existed = prevIds.has(page.id);
            void (existed ? api.updatePage(page.id, page) : api.createPage(page)).catch((err) =>
              console.error('Failed to persist page', err),
            );
          }
          for (const id of prevIds) {
            if (!nextIds.has(id)) {
              void api.deletePage(id).catch((err) => console.error('Failed to delete page', err));
            }
          }
        }
      }
      return resolved;
    });
  };

  // Carousel Slides state
  const [slides, setSlides] = useState<CarouselSlide[]>(() => {
    // API mode: slides come from ACTIVE hero banners only — don't seed demo carousel
    if (isApiEnabled()) return [];
    const stored = localStorage.getItem('vault_carousel_slides');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return parsed.map((s: CarouselSlide) => {
          if (s.id === 'slide-1') return INITIAL_SLIDES[0];
          if (s.id === 'slide-3' || s.productId === 'shirt-7' || /mystery/i.test(s.title || '')) {
            return INITIAL_SLIDES[2];
          }
          return s;
        });
      } catch (e) {}
    }
    return INITIAL_SLIDES;
  });

  // Auth & Session state
  const [usersList, setUsersList] = useState<User[]>(() => {
    const stored = localStorage.getItem('vault_users_list');
    if (stored) {
      try {
        const parsed: User[] = JSON.parse(stored);
        return parsed.map((u) => {
          const match = INITIAL_USERS.find((du) => du.id === u.id || du.email.toLowerCase() === u.email.toLowerCase());
          if (match) {
            const { password: _removed, ...safe } = u as User & { password?: string };
            return { ...safe, role: match.role };
          }
          const { password: _removed, ...safe } = u as User & { password?: string };
          return safe;
        });
      } catch (e) {
        return INITIAL_USERS;
      }
    }
    return INITIAL_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    // Never show a cached profile without a live session token (stops auto-login)
    if (!getToken()) {
      setStoredUser(null);
      return null;
    }
    return getStoredUser<User>();
  });

  const [apiConnected, setApiConnected] = useState(false);
  const [catalogHydrated, setCatalogHydrated] = useState(() => !isApiEnabled());
  const catalogFetchGen = useRef(0);

  /** Replace storefront catalog with the server snapshot (never keep deleted/local orphans). */
  const replaceCatalog = (incoming: Product[]) => {
    const list = Array.isArray(incoming) ? incoming.map((p) => normalizeProductPricing(p)) : [];
    setProducts(list);
  };

  /** Merge helper for rare offline/local edits — API mode always replaces. */
  const mergeCatalog = (incoming: Product[]) => {
    if (isApiEnabled()) {
      replaceCatalog(incoming);
      return;
    }
    setProducts((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      for (const item of incoming) {
        byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
      }
      const serverIds = new Set(incoming.map((p) => p.id));
      const ordered = incoming.map((p) => byId.get(p.id)!);
      for (const p of prev) {
        if (!serverIds.has(p.id)) ordered.push(p);
      }
      return ordered;
    });
  };

  // API mode: orders live in Neon — purge any stale localStorage cache (prevents QuotaExceededError)
  useEffect(() => {
    if (isApiEnabled()) clearStoredOrders();
  }, []);

  // Restore JWT session independently of catalog (so refresh never looks logged-out)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isApiEnabled()) return;
      if (!getToken()) {
        if (!cancelled) {
          setCurrentUser(null);
          setStoredUser(null);
        }
        return;
      }
      try {
        // Parallel profile + wishlist — never block homepage on slow /api/orders
        const [me, wishResult] = await Promise.all([
          api.me(),
          api.getWishlist().catch(() => null),
        ]);
        if (cancelled || !me) return;
        // After Neon re-seed, /me may rematch by email and return a fresh JWT
        if (me.token) setToken(me.token);
        const user: User = {
          id: me.id,
          email: me.email,
          fullName: me.fullName,
          role: me.role,
          phone: me.phone,
          permissions: me.permissions,
          accessFlags: me.accessFlags,
        };
        setCurrentUser(user);
        setStoredUser(user);
        setUsersList([]);
        if (!cancelled && Array.isArray(wishResult?.items)) {
          if (wishResult.items.length > 0) {
            const list = mergeWishlistWithCatalog(wishResult.items as Product[], products);
            setWishlist(list);
            saveLocalWishlist(list, user.id);
          } else {
            const cached = loadLocalWishlist(user.id);
            if (cached.length) setWishlist(cached);
          }
        } else if (!cancelled) {
          const cached = loadLocalWishlist(user.id);
          if (cached.length) setWishlist(cached);
        }
      } catch (err) {
        // Only force logout when the token is rejected — keep session on network blips
        if (isUnauthorizedError(err)) {
          clearSession();
          if (!cancelled) setCurrentUser(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate catalog + CMS ASAP (no health gate — that added a full Neon round-trip)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isApiEnabled()) return;
      setApiConnected(true);
      try {
        const hydrateCms = async () => {
          try {
            const cms = await api.homepageCms();
            if (cancelled || !cms) return;
            setAppConfig((prev) => {
              const next = { ...prev };
              const settings = cms.settings;
              if (settings) {
                const rawLogo = settings.logoText || prev.logoText;
                next.logoText =
                  rawLogo === 'THE VAULT BD' || rawLogo === 'Epic Vanskap BD'
                    ? 'Epic Vanskap'
                    : getShopBrandName(rawLogo);
                next.logoSubtext = settings.logoSubtext || prev.logoSubtext;
                next.theme = (settings.theme as AppConfig['theme']) || prev.theme;
                next.footerAbout = settings.footerAbout || prev.footerAbout;
                next.footerCopyright = settings.footerCopyright || prev.footerCopyright;
                if (settings.socialLinks && typeof settings.socialLinks === 'object') {
                  next.socialLinks = {
                    facebook: String((settings.socialLinks as { facebook?: string }).facebook || ''),
                    instagram: String((settings.socialLinks as { instagram?: string }).instagram || ''),
                    tiktok: String((settings.socialLinks as { tiktok?: string }).tiktok || ''),
                  };
                }
                next.bkashPersonalNumber = '01865962232';
                next.bkashEnabled = settings.bkashEnabled ?? prev.bkashEnabled;
                next.bkashPaymentMode =
                  settings.bkashPaymentMode === 'partial'
                    ? 'partial'
                    : settings.bkashPaymentMode === 'both'
                      ? 'both'
                      : 'both';
                next.bkashPartialAmountBdt = settings.bkashPartialAmountBdt ?? prev.bkashPartialAmountBdt ?? 300;
                next.exchangeRate = Number(settings.exchangeRate) || prev.exchangeRate;
                next.currencySymbol = settings.currencySymbol || prev.currencySymbol;
                next.currencyCode = settings.currencyCode || prev.currencyCode;
                next.timerTeam1 = settings.timerTeam1 || prev.timerTeam1;
                next.timerTeam1Emoji = settings.timerTeam1Emoji || prev.timerTeam1Emoji;
                next.timerTeam2 = settings.timerTeam2 || prev.timerTeam2;
                next.timerTeam2Emoji = settings.timerTeam2Emoji || prev.timerTeam2Emoji;
                next.timerLabel = settings.timerLabel || prev.timerLabel;
                next.timerTargetHours = settings.timerTargetHours ?? prev.timerTargetHours;
                next.timerEnabled = settings.timerEnabled ?? prev.timerEnabled;
                next.dailyDealProductId = settings.dailyDealProductId ?? prev.dailyDealProductId;
                next.dailyDealEnabled = settings.dailyDealEnabled ?? false;
                next.dailyDealItems = Array.isArray(settings.dailyDealItems)
                  ? settings.dailyDealItems
                  : prev.dailyDealItems || [];
                next.dailyDealEndsAt = settings.dailyDealEndsAt
                  ? String(settings.dailyDealEndsAt)
                  : null;
                if (Array.isArray(settings.categoryItems) && settings.categoryItems.length) {
                  const extras = [
                    { id: 'cat-kids', name: 'Kids', slug: 'kids', pageNumber: 2, rowOrder: 6, description: 'Kids & junior football kits (ages 1–14)', icon: 'Shirt', status: 'Active' },
                    { id: 'cat-customised-kit', name: 'Customised Kit', slug: 'customised-kit', pageNumber: 2, rowOrder: 7, description: 'Custom printed / customised kit jerseys', icon: 'Sparkles', status: 'Active' },
                  ];
                  const existing = settings.categoryItems as Array<{ name?: string; id?: string }>;
                  const names = new Set(existing.map((c) => String(c.name || '').toLowerCase()));
                  next.categoryItems = [
                    ...existing,
                    ...extras.filter((e) => !names.has(e.name.toLowerCase())),
                  ] as typeof next.categoryItems;
                }
                if (Array.isArray((settings as { tournamentPatches?: unknown }).tournamentPatches)) {
                  const raw = (settings as { tournamentPatches: unknown[] }).tournamentPatches;
                  next.tournamentPatches = raw
                    .map((entry, index) => {
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
                    })
                    .filter(Boolean) as AppConfig['tournamentPatches'];
                }
                if (Array.isArray((settings as { clubShowcase?: unknown }).clubShowcase)) {
                  next.clubs = normalizeClubShowcase(
                    (settings as { clubShowcase: Parameters<typeof normalizeClubShowcase>[0] })
                      .clubShowcase,
                  );
                } else if (!next.clubs?.length) {
                  next.clubs = DEFAULT_CLUBS.map((c) => ({ ...c }));
                }
                if (
                  settings &&
                  (settings as { communityGallery?: unknown }).communityGallery &&
                  typeof (settings as { communityGallery?: unknown }).communityGallery === 'object'
                ) {
                  next.communityGallery = normalizeCommunityGallery(
                    (settings as { communityGallery: unknown }).communityGallery,
                  );
                } else if (!next.communityGallery?.images?.length) {
                  next.communityGallery = normalizeCommunityGallery(null);
                }
                if (Array.isArray((settings as { customSizeCharts?: unknown }).customSizeCharts)) {
                  next.customSizeCharts = (settings as { customSizeCharts: AppConfig['customSizeCharts'] })
                    .customSizeCharts;
                }
                if (Array.isArray((settings as any).menuItems) && (settings as any).menuItems.length) {
                  next.menuItems = (settings as any).menuItems;
                }
                // Always use league page nav names on the storefront
                next.menuItems = DEFAULT_APP_CONFIG.menuItems;
                next.pages = DEFAULT_APP_CONFIG.pages;
                if (Array.isArray((settings as any).footerLocations) && (settings as any).footerLocations.length) {
                  next.footerLocations = normalizeOutlets((settings as any).footerLocations);
                }
              }
              // Prefer admin StoreSettings outlets; fall back to StoreLocation rows only if settings empty
              if (
                (!Array.isArray(next.footerLocations) || next.footerLocations.length < 1) &&
                Array.isArray(cms.locations) &&
                cms.locations.length
              ) {
                next.footerLocations = normalizeOutlets(
                  cms.locations.map((loc: any) => ({
                    city: loc.city,
                    address: loc.address,
                    phone: loc.phone,
                    email: loc.email,
                    hours: loc.hours,
                  })),
                );
              }
              if (Array.isArray(cms.banners) && cms.banners.length) {
                const defaultsById = new Map(
                  (DEFAULT_APP_CONFIG.banners || []).map((b) => [b.id, b]),
                );
                const isOk = (src?: string) => {
                  if (!src || typeof src !== 'string') return false;
                  const s = src.trim();
                  if (!s) return false;
                  if (s.startsWith('data:') || s.startsWith('blob:')) return false;
                  if (s.startsWith('/')) return true;
                  return /^https?:\/\//i.test(s);
                };
                const DEFAULT_COVER = '/hero-cover.svg';
                next.banners = cms.banners.map((b: any) => {
                  const fallback = defaultsById.get(b.id);
                  const desktop =
                    (isOk(b.desktopImage) && b.desktopImage) ||
                    (isOk(b.image) && b.image) ||
                    fallback?.desktopImage ||
                    DEFAULT_COVER;
                  return {
                    ...b,
                    // Preserve CMS status exactly — never inherit Active from demo defaults
                    status: b.status || 'Inactive',
                    desktopImage: desktop,
                    tabletImage:
                      (isOk(b.tabletImage) && b.tabletImage) || fallback?.tabletImage || desktop,
                    mobileImage:
                      (isOk(b.mobileImage) && b.mobileImage) || fallback?.mobileImage || desktop,
                    image: desktop,
                  };
                });
                // Persist so next refresh shows the same hero immediately (no swap flash)
                try {
                  localStorage.setItem('vault_cms_banners_cache', JSON.stringify(next.banners));
                } catch {
                  /* quota / private mode */
                }
                // API mode: never reinject Active demo heroes. Empty hero list = hidden carousel.
              }
              if (Array.isArray(cms.pages) && cms.pages.length) {
                next.pages = cms.pages;
              }
              if (Array.isArray(cms.homepageSections) && cms.homepageSections.length > 0) {
                let sections = normalizeHomepageSections(cms.homepageSections).map((s) => {
                  if (
                    s.id === 'shop-by-club' ||
                    s.id === 'shop-by-league' ||
                    s.id === 'shop-by-international-team'
                  ) {
                    return { ...s, visible: false, status: 'inactive' as const };
                  }
                  return s;
                });
                next.leagues = DEFAULT_LEAGUES;
                if (next.dailyDealEnabled === true || next.dailyDealEnabled === false) {
                  sections = sections.map((s) =>
                    s.id === 'daily-deals'
                      ? {
                          ...s,
                          visible: next.dailyDealEnabled === true,
                          status: next.dailyDealEnabled ? 'active' : 'inactive',
                        }
                      : s,
                  );
                }
                const rowDefaults = (DEFAULT_APP_CONFIG.homepageSections || []).filter((s) =>
                  ['player-edition', 'retro-collection', 'customised-kit'].includes(s.id),
                );
                const existingIds = new Set(sections.map((s) => s.id));
                const missingRows = rowDefaults.filter((s) => !existingIds.has(s.id));
                if (missingRows.length) {
                  const featuredIdx = sections.findIndex((s) => s.id === 'featured-collection');
                  const insertAt = featuredIdx >= 0 ? featuredIdx + 1 : sections.length;
                  sections = normalizeHomepageSections([
                    ...sections.slice(0, insertAt),
                    ...missingRows,
                    ...sections.slice(insertAt),
                  ]);
                }
                // Defer category-row sync until catalog hydrates (products available)
                next.homepageSections = normalizeHomepageSections(sections);
              }
              if ((!Array.isArray(next.footerLocations) || next.footerLocations.length < 1) && DEFAULT_APP_CONFIG.footerLocations) {
                next.footerLocations = DEFAULT_APP_CONFIG.footerLocations;
              }
              return next;
            });
            // Only ACTIVE heroes come back as slides — empty means hide carousel admin cache too
            if (!cancelled) {
              setSlides(Array.isArray(cms.slides) ? cms.slides : []);
            }
          } catch {
            /* CMS optional */
          }
        };

        const hydrateCatalog = async (opts?: { all?: boolean }) => {
          try {
            const gen = ++catalogFetchGen.current;
            // Storefront: Active only. Full admin catalog loads when Admin Room opens.
            // Page through the API so catalogs over 100 products all appear.
            const { items } = await api.listAllProducts({
              ...(opts?.all ? { all: true } : {}),
            });
            if (cancelled || gen !== catalogFetchGen.current) return;
            const list = Array.isArray(items) ? (items as Product[]) : [];
            // Empty Neon catalog is valid (admin deleted everything) — never reinject demo PRODUCTS
            replaceCatalog(list);
            try {
              localStorage.removeItem('vault_custom_products');
            } catch {
              /* ignore */
            }
          } catch {
            // API/DB down — keep current catalog; do not seed demo kits over a cleared shop
          }
        };

        await Promise.all([hydrateCms(), hydrateCatalog()]);
      } catch {
        /* keep seed catalog fallback */
      } finally {
        if (!cancelled) setCatalogHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // After catalog loads: sync homepage rows — only categories with stock, drop blocked rows
  useEffect(() => {
    if (!catalogHydrated) return;
    const fromProducts = homepageRowCategoryCandidates(products);
    const names = [...new Set([...fromProducts])];
    setAppConfig((prev) => {
      const current = prev.homepageSections || [];
      const ensured = ensureHomepageRowsForCategories(current, names, products);
      const same =
        ensured.length === current.length &&
        ensured.every(
          (s, i) => s.id === current[i]?.id && (s.maxProducts ?? 4) === (current[i]?.maxProducts ?? 4),
        );
      if (same) return prev;
      const next = { ...prev, homepageSections: ensured };
      if (isApiEnabled() && getToken()) {
        void api
          .saveHomepageSections(ensured, next.categoryItems)
          .catch((err) => console.error('Failed to sync homepage category rows', err));
      } else if (!isApiEnabled()) {
        try {
          localStorage.setItem('vault_app_config', JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogHydrated, products.length]);

  // Staff need Draft/Archived in Product Manager — fetch full catalog only when opening admin
  useEffect(() => {
    if (!isApiEnabled() || currentPage !== 'admin') return;
    if (!canUseAdminPanel(currentUser?.role, !!getToken(), true)) return;
    let cancelled = false;
    (async () => {
      try {
        const gen = ++catalogFetchGen.current;
        const { items } = await api.listAllProducts({ all: true });
        if (cancelled || gen !== catalogFetchGen.current) return;
        mergeCatalog(Array.isArray(items) ? (items as Product[]) : []);
      } catch {
        /* keep current catalog */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPage, currentUser?.role]);

  const handleSetSlides = (newSlides: CarouselSlide[] | ((prev: CarouselSlide[]) => CarouselSlide[])) => {
    setSlides((prev) => {
      const next = typeof newSlides === 'function' ? newSlides(prev) : newSlides;
      if (!(isApiEnabled() && getToken())) {
        localStorage.setItem('vault_carousel_slides', JSON.stringify(next));
      } else {
        // Empty carousel = hide heroes (Inactive), do not delete banner rows
        void api.saveCarousel(next).catch((err) => {
          console.error('Failed to persist carousel', err);
        });
      }
      return next;
    });
  };

  // Offline/demo only — never cache catalog in localStorage when Neon API is enabled
  useEffect(() => {
    if (isApiEnabled() || apiConnected) {
      try {
        localStorage.removeItem('vault_custom_products');
      } catch {
        /* ignore */
      }
      return;
    }
    if (products && products.length > 0) {
      try {
        localStorage.setItem('vault_custom_products', JSON.stringify(products));
      } catch (err) {
        console.warn('Failed to cache products in localStorage', err);
      }
    }
  }, [products, apiConnected]);

  useEffect(() => {
    if (!appConfig) return;
    if (isApiEnabled() && apiConnected) {
      try {
        localStorage.removeItem('vault_app_config');
      } catch {
        /* live DB is source of truth */
      }
      return;
    }
    try {
      localStorage.setItem('vault_app_config', JSON.stringify(appConfig));
    } catch (err) {
      console.warn('Failed to cache app config in localStorage', err);
    }
  }, [appConfig, apiConnected]);

  useEffect(() => {
    // Offline/demo only — API mode keeps slides from Neon ACTIVE heroes
    if (isApiEnabled()) return;
    if (slides) {
      try {
        localStorage.setItem('vault_carousel_slides', JSON.stringify(slides));
      } catch (err) {
        console.warn('Failed to cache carousel slides in localStorage', err);
      }
    }
  }, [slides]);

  useEffect(() => {
    persistOrders(orders);
  }, [orders]);

  const hydrateOrdersFromApi = async () => {
    if (!(isApiEnabled() && getToken())) return;
    try {
      const { mapApiOrderToSpa } = await import('./lib/mapOrder');
      const { items: apiOrders } = await api.listOrders({ scope: 'mine' });
      setOrders((apiOrders || []).map((o: any) => mapApiOrderToSpa(o)));
      setApiConnected(true);
      clearStoredOrders();
    } catch {
      /* keep existing */
    }
  };

  // Customer dashboard needs orders — load lazily (not on every homepage visit)
  useEffect(() => {
    if (currentPage !== 'dashboard' && currentPage !== 'orders') return;
    if (!currentUser || !getToken()) return;
    void hydrateOrdersFromApi();
  }, [currentPage, currentUser?.id]);

  const handleRegisterUser = (newUser: User) => {
    setUsersList((prev) => {
      const next = [...prev, newUser];
      localStorage.setItem('vault_users_list', JSON.stringify(next));
      return next;
    });
  };

  const handleLoginSuccess = (user: User, _autoSave?: boolean) => {
    setCurrentUser(user);
    setStaffLoginRequired(false);
    // Lifetime session — always cache profile until explicit logout
    setStoredUser(user);

    // Merge guest cart → Neon cart for logged-in users
    if (isApiEnabled() && getToken()) {
      const local = cart.length > 0 ? cart : loadLocalCart();
      if (local.length > 0) {
        void api
          .syncCart(cartToSyncPayload(local))
          .then(() => {
            setCart(local);
            saveLocalCart(local);
          })
          .catch(() => undefined);
      }
      // Sync guest + account wishlist to Neon, then reload selected hearts
      const localWish =
        wishlist.length > 0 ? wishlist : loadLocalWishlist(user.id);
      void (async () => {
        try {
          if (localWish.length > 0) {
            await Promise.all(
              localWish.map((p) => api.addWishlist(String(p.id)).catch(() => undefined)),
            );
          }
          const remote = await api.getWishlist();
          const remoteList = (remote?.items || []) as Product[];
          const merged = mergeWishlistWithCatalog(
            remoteList.length ? remoteList : localWish,
            products,
          );
          setWishlist(merged);
          saveLocalWishlist(merged, user.id);
        } catch {
          if (localWish.length) {
            setWishlist(localWish);
            saveLocalWishlist(localWish, user.id);
          }
        }
      })();
    }

    // Redirect role-based — use history push so Back still works
    // Staff always enter admin after a successful AuthScreen login (token already set).
    if (isStaffRole(user.role) || canUseAdminPanel(user.role, !!getToken(), isApiEnabled())) {
      goToPage('admin', { adminTab: 'dashboard' });
    } else if (checkoutLoginRequired) {
      setCheckoutLoginRequired(false);
      goToPage('checkout');
    } else {
      goToPage('home');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    clearSession();
    clearNavState();
    setCart([]);
    clearLocalCart();
    // Keep account-scoped favorites for next login; clear only guest mirror
    setWishlist([]);
    clearLocalWishlist();
    setCheckoutLoginRequired(false);
    clearStoredOrders();
    goToPage('home', { replace: true });
  };

  const handleUpdateProductImage = (productId: string, imageSrc: string) => {
    const persistable = isRenderableImageSrc(imageSrc) ? imageSrc : null;
    setProducts((prev) => {
      const next = prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              ...(persistable
                ? { uploadedImage: persistable, image: persistable, images: [persistable] }
                : { uploadedImage: imageSrc }),
            }
          : p,
      );
      if (!isApiEnabled()) {
        try {
          localStorage.setItem('vault_custom_products', JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      // Persist only real HTTP/data URLs — never catalog keys like "shirt-custom"
      if (isApiEnabled() && getToken() && persistable && !persistable.startsWith('data:')) {
        void api
          .updateProduct(productId, { image: persistable, images: [persistable] })
          .catch((err) => console.error('Failed to persist product image', err));
      } else if (isApiEnabled() && getToken() && persistable?.startsWith('data:')) {
        // Convert data URL via Cloudinary upload endpoint before saving
        void api
          .uploadImage({ dataUrl: persistable, folder: 'products' })
          .then((uploaded) =>
            api.updateProduct(productId, { image: uploaded.url, images: [uploaded.url] }).then(() => {
              setProducts((cur) =>
                cur.map((p) =>
                  p.id === productId
                    ? { ...p, uploadedImage: uploaded.url, image: uploaded.url, images: [uploaded.url] }
                    : p,
                ),
              );
            }),
          )
          .catch((err) => console.error('Failed to upload/persist product image', err));
      }
      return next;
    });
  };

  // Search & Filters State
  const [searchQuery, setSearchQuery] = useState(() =>
    bootRoute.page === 'listing' || bootRoute.page === 'home'
      ? bootRoute.search || ''
      : '',
  );
  const [selectedBrand, setSelectedBrand] = useState<string>(() => bootRoute.brand || 'All');
  const [selectedCategory, setSelectedCategory] = useState<string>(() =>
    bootRoute.page === 'listing' ? bootRoute.category || 'All' : 'All',
  );
  const [selectedCondition, setSelectedCondition] = useState<string>(() => bootRoute.condition || 'All');
  const [selectedSeason, setSelectedSeason] = useState<string>('All');
  const [selectedClub, setSelectedClub] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>(() => bootRoute.sortBy || 'featured');

  const buildSpaRoute = (page: string, overrides: Partial<SpaRoute> = {}): SpaRoute => ({
    page,
    productId:
      overrides.productId !== undefined
        ? overrides.productId
        : page === 'details'
          ? selectedProduct?.id || pendingProductId
          : null,
    category: overrides.category !== undefined ? overrides.category : selectedCategory,
    search: overrides.search !== undefined ? overrides.search : searchQuery,
    brand: overrides.brand !== undefined ? overrides.brand : selectedBrand,
    condition: overrides.condition !== undefined ? overrides.condition : selectedCondition,
    sortBy: overrides.sortBy !== undefined ? overrides.sortBy : sortBy,
    adminTab: overrides.adminTab !== undefined ? overrides.adminTab : adminTab,
  });

  /** History-preserving navigation used everywhere (push by default). */
  const goToPage = (
    page: string,
    opts?: {
      replace?: boolean;
      productId?: string | null;
      category?: string;
      search?: string;
      adminTab?: string;
      product?: Product | null;
    },
  ) => {
    if (page === 'home') {
      setSelectedCategory('All');
      setSearchQuery('');
      setSelectedBrand('All');
      setSelectedCondition('All');
    } else if (opts?.category !== undefined) {
      setSelectedCategory(opts.category);
    }
    if (page !== 'home' && opts?.search !== undefined) setSearchQuery(opts.search);
    if (opts?.adminTab !== undefined) setAdminTab(opts.adminTab);
    if (opts?.product) {
      setSelectedProduct(opts.product);
      setPendingProductId(opts.product.id);
    } else if (opts?.productId !== undefined) {
      setPendingProductId(opts.productId);
      if (!opts.productId) setSelectedProduct(null);
    }
    if (page !== 'details' && !opts?.product && opts?.productId === undefined) {
      // leaving details — keep selectedProduct for back restore via URL product id
    }
    setCurrentPage(page);
    if (!skipNextUrlPush.current) {
      navigateSpa(
        buildSpaRoute(page, {
          productId: opts?.product?.id ?? opts?.productId,
          category: opts?.category,
          search: opts?.search,
          adminTab: opts?.adminTab,
        }),
        { replace: opts?.replace === true },
      );
    }
  };

  /** Drop-in for Header/Footer/children that only pass a page string. */
  const setCurrentPageNav = (page: string) => {
    if (page === 'wishlist') {
      goToPage('dashboard');
      return;
    }
    const reserved = new Set([
      'home', 'listing', 'details', 'cart', 'checkout', 'auth', 'login', 'signup', 'dashboard', 'admin',
      'order-success', 'seller', 'faq', 'about', 'authenticity', 'contact', 'privacy',
      'refund', 'terms', 'shipping',
    ]);
    if (!reserved.has(page) && !page.startsWith('page-')) {
      goToPage('listing', { category: page === 'All' ? 'All' : page });
      return;
    }
    if (page === 'listing') {
      goToPage('listing', { category: selectedCategory || 'All' });
      return;
    }
    goToPage(page);
  };

  const applySpaRoute = (route: SpaRoute) => {
    skipNextUrlPush.current = true;
    if (route.category) setSelectedCategory(route.category);
    if (route.search !== undefined) setSearchQuery(route.search || '');
    if (route.brand) setSelectedBrand(route.brand);
    if (route.condition) setSelectedCondition(route.condition);
    if (route.sortBy) setSortBy(route.sortBy);
    if (route.adminTab) setAdminTab(route.adminTab);
    if (route.page === 'details' && route.productId) {
      setPendingProductId(route.productId);
      const found = products.find((p) => p.id === route.productId);
      if (found) setSelectedProduct(found);
    }
    setCurrentPage(route.page);
    // allow next tick to clear skip flag if effect didn't
    requestAnimationFrame(() => {
      skipNextUrlPush.current = false;
    });
  };

  // Boot: align URL with restored route + listen for Back/Forward
  useEffect(() => {
    ensureSpaHistoryBoot(buildSpaRoute(currentPage));
    return onSpaPopState((route) => {
      applySpaRoute(route);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep localStorage mirror for refresh fallback
  useEffect(() => {
    saveNavState({
      page: currentPage,
      productId: selectedProduct?.id || pendingProductId,
      category: selectedCategory,
      search: searchQuery,
    });
  }, [currentPage, selectedProduct?.id, pendingProductId, selectedCategory, searchQuery]);

  // Google Analytics — SPA page views on in-app navigation
  useEffect(() => {
    void import('./components/GoogleAnalytics')
      .then(({ trackSpaPageView }) => trackSpaPageView(currentPage))
      .catch(() => undefined);
  }, [currentPage, selectedProduct?.id, selectedCategory, searchQuery]);

  // Listing filters → replaceState (no duplicate history entries)
  useEffect(() => {
    if (currentPage !== 'listing') return;
    if (skipNextUrlPush.current) return;
    navigateSpa(buildSpaRoute('listing'), { replace: true, preserveScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, selectedCondition, sortBy, searchQuery, selectedCategory, selectedSeason, selectedClub]);

  // After catalog loads/changes: drop bag + wishlist lines for deleted products
  const catalogIdKey = useMemo(
    () => (Array.isArray(products) ? products.map((p) => p.id).join('|') : ''),
    [products],
  );
  useEffect(() => {
    if (!catalogHydrated) return;
    const catalog = Array.isArray(products) ? products : [];
    setCart((prev) => {
      const next = pruneCartToCatalog(prev, catalog);
      if (next.length === prev.length) return prev;
      saveLocalCart(next);
      return next;
    });
    setWishlist((prev) => {
      const next = pruneWishlistToCatalog(prev, catalog);
      if (next.length === prev.length) return prev;
      saveLocalWishlist(next, currentUser?.id);
      return next;
    });
  }, [catalogHydrated, catalogIdKey, currentUser?.id, products]);

  // Persist cart locally always; debounce sync to API when logged in
  useEffect(() => {
    saveLocalCart(cart);
    if (!isApiEnabled() || !getToken()) return;
    if (cartSyncTimer.current) clearTimeout(cartSyncTimer.current);
    cartSyncTimer.current = setTimeout(() => {
      // Only sync lines that still exist in catalog (never re-push deleted kits)
      const live = pruneCartToCatalog(cart, products);
      void api.syncCart(cartToSyncPayload(live)).catch(() => undefined);
    }, 500);
    return () => {
      if (cartSyncTimer.current) clearTimeout(cartSyncTimer.current);
    };
  }, [cart, products, catalogHydrated]);

  // Persist wishlist locally (guest + account cache)
  useEffect(() => {
    saveLocalWishlist(wishlist, currentUser?.id);
  }, [wishlist, currentUser?.id]);

  // Hydrate cart/wishlist from API after catalog is ready
  useEffect(() => {
    if (!isApiEnabled() || !getToken() || !catalogHydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const remoteCart = await api.getCart();
        const items = mapApiCartToItems(remoteCart?.items || [], products);
        if (cancelled) return;
        const localLive = pruneCartToCatalog(cart, products);
        if (items.length > 0) {
          setCart(items);
          saveLocalCart(items);
        } else if (localLive.length > 0) {
          // Push only live catalog items — never resurrect deleted products
          await api.syncCart(cartToSyncPayload(localLive));
          setCart(localLive);
          saveLocalCart(localLive);
        } else {
          setCart([]);
          clearLocalCart();
          try {
            await api.syncCart([]);
          } catch {
            /* ignore */
          }
        }
      } catch {
        // API cart failed — still strip deleted products from local bag
        if (!cancelled) {
          setCart((prev) => {
            const next = pruneCartToCatalog(prev, products);
            saveLocalCart(next);
            return next;
          });
        }
      }
      try {
        const remoteWish = await api.getWishlist();
        const list = mergeWishlistWithCatalog(
          (remoteWish?.items || []) as Product[],
          products,
        );
        if (cancelled) return;
        if (list.length > 0) {
          setWishlist(list);
          saveLocalWishlist(list, currentUser?.id);
        } else {
          const cached = loadLocalWishlist(currentUser?.id);
          if (cached.length) {
            const mergedCache = mergeWishlistWithCatalog(cached, products);
            setWishlist(mergedCache);
            // Re-push cached hearts if server was empty (e.g. first login after favorites)
            void Promise.all(
              mergedCache.map((p) => api.addWishlist(String(p.id)).catch(() => undefined)),
            );
          }
        }
      } catch {
        /* keep local wishlist */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogHydrated, currentUser?.id]);

  // Restore product details page after catalog hydrates
  useEffect(() => {
    if (currentPage !== 'details') return;
    if (selectedProduct) return;
    const id = pendingProductId || parseLocation().productId || loadNavState()?.productId;
    if (!id) {
      goToPage('listing', { replace: true });
      return;
    }
    if (!catalogHydrated || products.length === 0) {
      if (catalogHydrated && products.length === 0) {
        goToPage('listing', { replace: true });
        setPendingProductId(null);
      }
      return;
    }
    const found = products.find((p) => p.id === id);
    if (found) {
      setSelectedProduct(found);
      setPendingProductId(null);
    } else {
      goToPage('listing', { replace: true });
      setPendingProductId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, selectedProduct, pendingProductId, products, catalogHydrated]);

  // Secret admin portal: unauthenticated /admin → /admin/account (no storefront)
  useEffect(() => {
    if (currentPage === 'admin') {
      if (canUseAdminPanel(currentUser?.role, !!getToken(), isApiEnabled())) return;
      if (getToken() && !currentUser) return;
      setStaffLoginRequired(true);
      goToPage('auth', { replace: true });
      return;
    }
    if (currentPage === 'auth') {
      setStaffLoginRequired(true);
      // Already logged-in staff landing on login URL → enter panel
      if (canUseAdminPanel(currentUser?.role, !!getToken(), isApiEnabled())) {
        goToPage('admin', { adminTab: 'dashboard', replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, currentUser]);

  const goToCheckout = () => {
    setCheckoutLoginRequired(false);
    goToPage('checkout');
  };

  // Add to Cart
  const handleAddToCart = (item: CartItem) => {
    setCart((prev) => {
      // Check if item with same configuration (id + size + print name + print number) already exists
      const existingIdx = prev.findIndex((i) => {
        const matchProd = i.product.id === item.product.id;
        const matchSize = i.selectedSize === item.selectedSize;
        const matchPrint = JSON.stringify(i.customPrint) === JSON.stringify(item.customPrint);
        const matchBadge = cartBadgesMatch(i.selectedBadges, item.selectedBadges);
        return matchProd && matchSize && matchPrint && matchBadge;
      });

      if (existingIdx > -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += item.quantity;
        return copy;
      }
      return [...prev, item];
    });
  };

  // Quick Add helper (adds standard first size with no custom nameset)
  const handleQuickAdd = (product: Product, size?: string, qty?: number) => {
    // Fly animation is triggered by ProductCard / ProductDetails; deal tiles call fly themselves
    const standardSize = size || product.sizes[0] || 'M';
    const item: CartItem = {
      product,
      selectedSize: standardSize,
      quantity: qty || 1,
    };
    handleAddToCart(item);
    toast(
      product.isPreOrder
        ? `Pre-ordered ${product.name} (Size ${standardSize}) — in your cart`
        : `Added ${product.name} (Size ${standardSize}) to your cart`,
      'success',
    );
  };

  // Direct checkout routing (catalog cards — basic item)
  const handleCheckoutDirectly = (product: Product, size: string, qty: number) => {
    const standardSize = size || product.sizes[0] || 'M';
    const item: CartItem = {
      product,
      selectedSize: standardSize,
      quantity: qty || 1,
    };
    handleOrderNow(item);
  };

  // Product details — full customization (nameset, badges, computed price)
  const handleOrderNow = (item: CartItem) => {
    handleAddToCart(item);
    goToCheckout();
  };

  // Wishlist heart toggler — optimistic UI; persists to Neon when logged in
  const handleToggleWishlist = (product: Product) => {
    const productId = String(product.id);
    const isFav = isProductWishlisted(wishlist, productId);
    const nextProduct = { ...product, id: productId };

    // Optimistic selected state so heart fills immediately
    setWishlist((prev) =>
      isFav
        ? prev.filter((p) => String(p.id) !== productId)
        : isProductWishlisted(prev, productId)
          ? prev
          : [...prev, nextProduct],
    );

    if (isApiEnabled() && getToken()) {
      void (async () => {
        try {
          if (isFav) await api.removeWishlist(productId);
          else await api.addWishlist(productId);
        } catch (err) {
          console.error(err);
          toast(err instanceof Error ? err.message : 'Wishlist update failed', 'error');
          // Revert on failure
          setWishlist((prev) =>
            isFav
              ? isProductWishlisted(prev, productId)
                ? prev
                : [...prev, nextProduct]
              : prev.filter((p) => String(p.id) !== productId),
          );
        }
      })();
    }
  };

  const handleRemoveWishlist = (product: Product) => {
    const productId = String(product.id);
    if (isApiEnabled() && getToken()) {
      void api.removeWishlist(productId).catch(() => undefined);
    }
    setWishlist((prev) => prev.filter((p) => String(p.id) !== productId));
  };

  // Add seller request from user form
  const handleAddSellerRequest = (req: SellerRequest) => {
    setSellerRequests((prev) => [req, ...prev]);
  };

  // Successful Order submission
  const handleOrderSuccess = (order: Order) => {
    setOrders((prev) => [order, ...prev]);
    setLastPlacedOrder(order);
    setCart([]);
    clearLocalCart();
    goToPage('order-success');
  };

  // Helper to convert OKLCH to RGB color space for html2canvas compatibility
  const oklchToRgb = (L: number, C: number, H: number): [number, number, number] => {
    const a = C * Math.cos((H * Math.PI) / 180);
    const b = C * Math.sin((H * Math.PI) / 180);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    const f = (c: number) => {
      return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    };

    const r = Math.max(0, Math.min(255, Math.round(f(rLin) * 255)));
    const g = Math.max(0, Math.min(255, Math.round(f(gLin) * 255)));
    const bVal = Math.max(0, Math.min(255, Math.round(f(bLin) * 255)));

    return [r, g, bVal];
  };

  // Parses any CSS text and replaces oklch(...) expressions with standard rgb/rgba fallbacks
  const parseAndReplaceOklch = (cssText: string): string => {
    // Match oklch(...) functions. Matches up to the closing parenthesis.
    const oklchRegex = /oklch\([^\)]+\)/g;
    return cssText.replace(oklchRegex, (match) => {
      try {
        const inner = match.substring(6, match.length - 1).trim();
        // Split by whitespace, commas, or forward slashes
        const parts = inner.split(/[\s,\/]+/).filter(Boolean);
        if (parts.length >= 3) {
          let lStr = parts[0];
          let cStr = parts[1];
          let hStr = parts[2];
          let aStr = parts[3];

          let L = parseFloat(lStr);
          if (lStr.includes('%')) {
            L = L / 100;
          }
          const C = parseFloat(cStr);
          const H = parseFloat(hStr);

          let A = 1;
          if (aStr) {
            A = parseFloat(aStr);
            if (aStr.includes('%')) {
              A = A / 100;
            }
          }

          if (!isNaN(L) && !isNaN(C) && !isNaN(H)) {
            const [r, g, b] = oklchToRgb(L, C, H);
            if (aStr !== undefined && !isNaN(A)) {
              return `rgba(${r}, ${g}, ${b}, ${A})`;
            } else {
              return `rgb(${r}, ${g}, ${b})`;
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse oklch color:', match, e);
      }
      
      // If parsing fails or is a complex CSS variable (like oklch(var(--foo))), 
      // replace with safe neutral color to prevent html2canvas crash.
      return 'rgb(120, 120, 120)';
    });
  };

  // Download PDF invoice/receipt using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    const invoiceElement = document.getElementById('printable-invoice');
    if (!invoiceElement) return;

    setIsGeneratingPDF(true);

    // Keep references to restore original browser functions afterward
    const originalGetComputedStyle = window.getComputedStyle;
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;

    try {
      // 1. Temporarily patch prototype getPropertyValue to clean oklch colors on any CSSStyleDeclaration query
      CSSStyleDeclaration.prototype.getPropertyValue = function (propertyName: string) {
        const value = originalGetPropertyValue.call(this, propertyName);
        if (typeof value === 'string' && value.includes('oklch')) {
          return parseAndReplaceOklch(value);
        }
        return value;
      };

      // 2. Helper to intercept any computed style queries and translate oklch to standard RGB
      const patchWindow = (win: Window) => {
        const orig = win.getComputedStyle;
        win.getComputedStyle = function (elt, pseudoElt) {
          const style = orig.call(win, elt, pseudoElt);
          return new Proxy(style, {
            get(target, prop, receiver) {
              if (prop === 'getPropertyValue') {
                return function (propertyName: string) {
                  const value = target.getPropertyValue(propertyName);
                  if (typeof value === 'string' && value.includes('oklch')) {
                    return parseAndReplaceOklch(value);
                  }
                  return value;
                };
              }
              
              let value;
              try {
                // Read from native target to preserve proper native "this" context (avoids Illegal Invocation error)
                value = target[prop as any];
              } catch (e) {
                value = Reflect.get(target, prop, receiver);
              }

              if (typeof value === 'string' && value.includes('oklch')) {
                return parseAndReplaceOklch(value);
              }
              if (typeof value === 'function') {
                return value.bind(target);
              }
              return value;
            }
          }) as CSSStyleDeclaration;
        };
      };

      // Patch the main window
      patchWindow(window);

      // Convert all oklch colors in the active document stylesheets to rgb/rgba BEFORE running html2canvas
      try {
        const processRules = (rules: any) => {
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            try {
              if (rule.style && rule.style.cssText && rule.style.cssText.includes('oklch')) {
                rule.style.cssText = parseAndReplaceOklch(rule.style.cssText);
              }
              if (rule.cssRules) {
                processRules(rule.cssRules);
              }
            } catch (e) {
              // Ignore rule-level access errors or issues
            }
          }
        };

        for (const sheet of Array.from(document.styleSheets)) {
          try {
            const rules = sheet.cssRules || sheet.rules;
            if (rules) {
              processRules(rules);
            }
          } catch (e) {
            // Ignore cross-origin stylesheet errors
          }
        }
      } catch (err) {
        console.error('Failed to pre-convert document stylesheets:', err);
      }

      // Capture invoice with 2x scale for crisp text rendering
      const canvas = await html2canvas(invoiceElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Patch the cloned iframe defaultView as well
          if (clonedDoc.defaultView) {
            patchWindow(clonedDoc.defaultView);
          }

          // Translate oklch colors inside all stylesheets in the clone to standard rgb/rgba
          clonedDoc.querySelectorAll('style').forEach(styleEl => {
            try {
              styleEl.innerHTML = parseAndReplaceOklch(styleEl.innerHTML);
            } catch (e) {
              console.warn('Failed to parse oklch in <style> element', e);
            }
          });

          // Translate oklch colors inside inline style attributes in the clone
          clonedDoc.querySelectorAll('[style]').forEach(el => {
            try {
              const styleAttr = el.getAttribute('style');
              if (styleAttr) {
                el.setAttribute('style', parseAndReplaceOklch(styleAttr));
              }
            } catch (e) {
              console.warn('Failed to parse oklch in inline style attribute', e);
            }
          });

          const el = clonedDoc.getElementById('printable-invoice');
          if (el) {
            el.style.boxShadow = 'none';
            el.style.border = '2px solid #a1a1aa'; // keep zinc border clean
            el.style.borderRadius = '0'; // remove rounding for standard document print
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      // Calculate proportions
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      
      // Keep a consistent 12mm page margin
      const margin = 12;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = contentWidth / ratio;

      // Add image to A4 PDF page
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);

      // Download PDF named after the order ID
      const orderRef = lastPlacedOrder ? lastPlacedOrder.id : 'INVOICE';
      pdf.save(`Jersey_Addicts_Invoice_${orderRef}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Fallback: trigger system print window if something breaks
      window.print();
    } finally {
      // Restore original native functions
      window.getComputedStyle = originalGetComputedStyle;
      CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      setIsGeneratingPDF(false);
    }
  };

  // Compute filtered/sorted product catalog array
  const filteredProducts = useMemo(() => {
    let result = products.filter(
      (p) =>
        p.category !== 'Mystery' &&
        !/mystery/i.test(p.name) &&
        p.id !== 'shirt-7' &&
        (!p.status || p.status === 'Active' || p.status === 'Draft') &&
        !p.isTrashed &&
        !p.isArchived
    );

    if (searchQuery.trim()) {
      result = result.filter((p) => productMatchesSearchQuery(p, searchQuery));
    }

    if (selectedBrand !== 'All') {
      result = result.filter((p) => productMatchesBrand(p, selectedBrand));
    }

    if (selectedCategory && selectedCategory !== 'All') {
      result = result.filter((p) => productMatchesListingCategory(p, selectedCategory));
    }

    if (selectedCondition !== 'All') {
      result = result.filter((p) => productMatchesCondition(p, selectedCondition));
    }

    if (selectedSeason !== 'All') {
      const want = selectedSeason.toLowerCase().trim();
      result = result.filter((p) => {
        const season = String(p.season || '').toLowerCase().trim();
        if (!season) return false;
        return season === want || season.includes(want) || want.includes(season);
      });
    }

    if (selectedClub !== 'All') {
      const want = selectedClub.toLowerCase().trim();
      result = result.filter((p) => {
        const fields = [
          p.club,
          p.nationalTeam,
          p.country,
          p.name,
          ...(Array.isArray(p.tags) ? p.tags : []),
        ]
          .map((v) => String(v || '').toLowerCase().trim())
          .filter(Boolean);
        return fields.some((f) => f === want || f.includes(want) || want.includes(f));
      });
    }

    if (sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'year-new') {
      result.sort((a, b) => b.year - a.year);
    } else if (sortBy === 'year-old') {
      result.sort((a, b) => a.year - b.year);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (searchQuery.trim()) {
      // Tag hits rank above loose name/brand matches while searching
      result.sort(
        (a, b) =>
          scoreProductForSearch(b, searchQuery) - scoreProductForSearch(a, searchQuery),
      );
    }

    return result;
  }, [
    products,
    searchQuery,
    selectedBrand,
    selectedCategory,
    selectedCondition,
    selectedSeason,
    selectedClub,
    sortBy,
  ]);

  const listingFilterOptions = useMemo(() => {
    const brands = new Set<string>();
    const categories = new Set<string>();
    const conditions = new Set<string>();
    const seasons = new Set<string>();
    const clubs = new Set<string>();
    for (const p of products) {
      if (p.isTrashed || p.isArchived) continue;
      if (p.status && p.status !== 'Active') continue;
      const b = String(p.brand || '').trim();
      const cond = String(p.condition || '').trim();
      const season = String(p.season || '').trim();
      const club = String(p.club || p.nationalTeam || '').trim();
      if (b) brands.add(b);
      for (const c of getProductCategories(p)) {
        if (c && !/mystery/i.test(c)) categories.add(c);
      }
      if (cond) conditions.add(cond);
      if (season) seasons.add(season);
      if (club && !/mystery/i.test(club)) clubs.add(club);
    }
    for (const club of normalizeClubShowcase(appConfig.clubs?.length ? appConfig.clubs : undefined)) {
      if (club.name) clubs.add(club.name);
    }
    const sortAlpha = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const sortSeason = (a: string, b: string) => b.localeCompare(a, undefined, { numeric: true });
    return {
      brands: ['All', ...[...brands].sort(sortAlpha)],
      categories: ['All', ...[...categories].sort(sortAlpha)],
      conditions: ['All', ...[...conditions].sort(sortAlpha)],
      seasons: ['All', ...[...seasons].sort(sortSeason)],
      clubs: ['All', ...[...clubs].sort(sortAlpha)],
    };
  }, [products, appConfig.clubs]);

  // Compute related items for Details screen
  const relatedJerseys = useMemo(() => {
    if (!selectedProduct) return [];
    return products.filter(
      (p) =>
        p.id !== selectedProduct.id &&
        (p.brand === selectedProduct.brand || p.category === selectedProduct.category)
    );
  }, [products, selectedProduct]);

  // Reset all catalog filters
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedBrand('All');
    setSelectedCategory('All');
    setSelectedCondition('All');
    setSelectedSeason('All');
    setSelectedClub('All');
    setSortBy('featured');
  };

  const showAllJerseys = () => {
    resetFilters();
    goToPage('listing', { search: '', category: 'All' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getThemeBgClass = () => {
    return 'bg-[#F8F8F7]';
  };

  const formatPrice = (amount: number): string => {
    // Catalog/order amounts are already in store currency (BDT). No ৳ symbol.
    const value = Math.round(Number(amount) || 0);
    return value.toLocaleString();
  };

  const isAdminShell = currentPage === 'admin' || currentPage === 'auth';

  return (
    <div className={`min-h-screen w-full min-w-0 overflow-x-hidden bg-transparent text-[#0A0A0A] selection:bg-[#E30613] selection:text-white storefront-shell flex flex-col justify-between`}>
      <UiFeedbackHost />

      {/* Storefront chrome — hidden on secret admin portal */}
      {!isAdminShell && (
        <Header
          currentPage={currentPage}
          setCurrentPage={setCurrentPageNav}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          cart={cart}
          setCart={setCart}
          wishlist={wishlist}
          onSelectProduct={(p) => {
            goToPage('details', { product: p });
          }}
          onSearch={(query) => {
            setSearchQuery(query);
            goToPage('listing', { search: query, category: selectedCategory });
          }}
          searchQuery={searchQuery}
          currentUser={currentUser}
          onLogout={handleLogout}
          appConfig={appConfig}
          formatPrice={formatPrice}
          products={products}
        />
      )}

      <div className="flex w-full min-w-0 flex-1">
        <div className="flex-1 min-w-0 flex flex-col w-full">
      {/* MAIN BODY DISPLAY — pb for fixed mobile bottom nav (storefront only) */}
      <main className={`flex-grow w-full min-w-0 overflow-x-hidden ${isAdminShell ? '' : 'pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}>
        
        {/* Secret admin portal — login or panel only (no storefront UI) */}
        {isAdminShell && (
          <div className="admin-shell min-h-screen bg-[#f5f5f5] flex flex-col text-zinc-950">
            {currentPage === 'auth' && (
              <>
                <div className="px-4 py-4 border-b border-zinc-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2.5">
                    <BrandMark tone="red" imgClassName="w-7 h-7" />
                    <div>
                      <BrandWordmark text="Epic Vanskap" wordClassName="text-[13px]" />
                      <p className="text-[11px] text-zinc-500">Staff sign-in</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1">
                  <AuthScreen
                    onLoginSuccess={handleLoginSuccess}
                    usersList={usersList}
                    onRegisterUser={handleRegisterUser}
                    onCancel={() => {
                      /* Secret portal — stay here; no storefront navigation */
                    }}
                    isCheckoutRedirect={false}
                    isStaffLogin={true}
                  />
                </div>
              </>
            )}
            {currentPage === 'admin' &&
              (canUseAdminPanel(currentUser?.role, !!getToken(), isApiEnabled()) ? (
                <AdminPanel
                  products={products}
                  setProducts={setProducts}
                  sellerRequests={sellerRequests}
                  setSellerRequests={setSellerRequests}
                  orders={orders}
                  setOrders={setOrders}
                  onBackToCatalog={() => {
                    /* Admin stays in portal — no public site navigation */
                  }}
                  slides={slides}
                  setSlides={handleSetSlides}
                  appConfig={appConfig}
                  onUpdateConfig={handleUpdateConfig}
                  formatPrice={formatPrice}
                  initialAdminTab={adminTab}
                  onAdminTabChange={(tab) => {
                    setAdminTab(tab);
                    navigateSpa(buildSpaRoute('admin', { adminTab: tab }), { replace: false });
                  }}
                  onRequireStaffLogin={() => {
                    setStaffLoginRequired(true);
                    goToPage('auth', { replace: true });
                  }}
                  staffUser={
                    currentUser
                      ? {
                          fullName: currentUser.fullName,
                          email: currentUser.email,
                          role: currentUser.role,
                        }
                      : null
                  }
                  onSignOut={() => {
                    setCurrentUser(null);
                    clearSession();
                    clearNavState();
                    setStaffLoginRequired(true);
                    goToPage('auth', { replace: true });
                  }}
                />
              ) : null)}
          </div>
        )}

        {!isAdminShell && (currentPage === 'home' ||
          currentPage.startsWith('page-') ||
          (appConfig?.pages || []).some(
            (p) =>
              (p.id === currentPage ||
                p.name === currentPage ||
                p.slug === currentPage ||
                (p.name || '').toLowerCase() === currentPage.toLowerCase()) &&
              Array.isArray(p.sections) &&
              p.sections.length > 0,
          )) && (
          <DynamicPageRenderer
            currentPage={currentPage === 'home' ? 'home' : currentPage.replace(/^page-/, '')}
            products={products}
            appConfig={appConfig}
            formatPrice={formatPrice}
            onSelectProduct={(p) => {
              goToPage('details', { product: p });
            }}
            onAddToCart={handleAddToCart}
            onToggleWishlist={handleToggleWishlist}
            wishlist={wishlist}
            setCurrentPage={setCurrentPageNav}
            setSelectedCategory={setSelectedCategory}
            onSearch={(query) => {
              setSearchQuery(query);
              setSelectedCategory('All');
              goToPage('listing', { search: query, category: 'All' });
            }}
            handleQuickAdd={handleQuickAdd}
            handleUpdateProductImage={handleUpdateProductImage}
            handleCheckoutDirectly={handleCheckoutDirectly}
          />
        )}

        {/* ROUTE 2: CATALOG LISTING */}
        {currentPage === 'listing' && (
          <section className="max-w-7xl mx-auto px-4 md:px-12 py-6 sm:py-10 min-h-screen w-full min-w-0 overflow-x-hidden">
            
            {/* Catalog Banner */}
            <div className="border-b border-[#E5E5E5] pb-5 mb-5 sm:mb-6 space-y-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-[#0A0A0A] font-display break-words">
                  {selectedCategory && selectedCategory !== 'All'
                    ? resolveStorefrontPage(selectedCategory)
                      ? canonicalTargetPageName(selectedCategory)
                      : selectedCategory
                    : 'All Jerseys'}
                </h1>
                <p className="text-xs text-[#555555] font-mono mt-1">
                  Showing {filteredProducts.length} verified original jerseys
                  {(!selectedCategory || selectedCategory === 'All') &&
                  selectedBrand === 'All' &&
                  selectedCondition === 'All' &&
                  selectedSeason === 'All' &&
                  selectedClub === 'All' &&
                  !searchQuery
                    ? ' · full stock'
                    : ''}
                </p>
              </div>

              <ListingFiltersBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedBrand={selectedBrand}
                onBrandChange={setSelectedBrand}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedSeason={selectedSeason}
                onSeasonChange={setSelectedSeason}
                selectedClub={selectedClub}
                onClubChange={setSelectedClub}
                selectedCondition={selectedCondition}
                onConditionChange={setSelectedCondition}
                sortBy={sortBy}
                onSortChange={setSortBy}
                options={listingFilterOptions}
                onReset={resetFilters}
              />
            </div>

            <div className="w-full min-w-0">
              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center space-y-4">
                  <p className="text-[#555555] text-sm max-w-sm mx-auto">
                    No jerseys match these filters. Try clearing a filter or searching another club.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest px-6 py-2.5 rounded-full cursor-pointer transition-all"
                  >
                    Clear Active Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 lg:gap-6">
                  {filteredProducts.map((prod) => (
                    <ProductCard
                      key={prod.id}
                      product={prod}
                      onSelect={(p) => {
                        goToPage('details', { product: p });
                      }}
                      onToggleWishlist={handleToggleWishlist}
                      isWishlisted={isProductWishlisted(wishlist, prod.id)}
                      onQuickAdd={handleQuickAdd}
                      onUpdateImage={handleUpdateProductImage}
                      formatPrice={formatPrice}
                      onCheckout={handleCheckoutDirectly}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ROUTE 3: DETAILED VIEW */}
        {currentPage === 'details' && selectedProduct && (
          <ProductDetails
            key={selectedProduct.id}
            product={selectedProduct}
            onBackToCatalog={() => goToPage('listing')}
            onAddToCart={handleAddToCart}
            onOrderNow={handleOrderNow}
            onAddToWishlist={handleToggleWishlist}
            isWishlisted={isProductWishlisted(wishlist, selectedProduct.id)}
            relatedProducts={relatedJerseys}
            onSelectProduct={(p) => {
              goToPage('details', { product: p });
            }}
            formatPrice={formatPrice}
            tournamentPatches={appConfig.tournamentPatches}
          />
        )}

        {/* ROUTE 4: SHOPPING CART */}
        {currentPage === 'cart' && (
          <Cart
            cart={cart}
            setCart={setCart}
            onCheckout={() => goToCheckout()}
            onBackToCatalog={() => goToPage('listing')}
            formatPrice={formatPrice}
          />
        )}

        {/* ROUTE 5: CHECKOUT — guest or logged-in (auth never required) */}
        {currentPage === 'checkout' && (
          <Checkout
            cart={cart}
            setCart={setCart}
            onOrderSuccess={handleOrderSuccess}
            onBackToCart={() => goToPage('cart')}
            onBackToCatalog={() => goToPage('listing')}
            onSignIn={() => {
              setCheckoutLoginRequired(true);
              goToPage('login');
            }}
            formatPrice={formatPrice}
            appConfig={appConfig}
            currentUser={currentUser}
          />
        )}

        {(currentPage === 'login' || currentPage === 'signup') && (
          <CustomerAuth
            isCheckoutRedirect={checkoutLoginRequired}
            initialMode={currentPage === 'signup' ? 'signup' : 'login'}
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => goToPage(checkoutLoginRequired ? 'checkout' : 'home')}
          />
        )}

        {currentPage === 'order-success' && lastPlacedOrder && (
          <section className="max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-16 space-y-8 text-zinc-900 animate-fadeIn">
            {/* STAGE 1: SUCCESS CELEBRATION CARD */}
            <div className="bg-white border border-zinc-200 rounded-3xl p-6 md:p-8 text-center space-y-6 shadow-lg max-w-xl mx-auto">
              <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-zinc-950">Order Placed Successfully!</h1>
                <p className="text-sm text-zinc-950 font-mono font-black tracking-wide">
                  Order No: {lastPlacedOrder.orderNumber || lastPlacedOrder.id}
                </p>
                <p className="text-xs text-zinc-500 font-mono font-bold uppercase tracking-wider">
                  Status: {String(lastPlacedOrder.status || 'Confirmed').toUpperCase()}
                  {lastPlacedOrder.paymentStatus ? ` · Payment: ${lastPlacedOrder.paymentStatus}` : ''}
                </p>
              </div>

              <p className="text-zinc-600 text-xs md:text-sm font-medium leading-relaxed max-w-sm mx-auto">
                Thank you for your order! Save your order number for tracking and support.
                {!currentUser
                  ? ' You ordered as a guest — create an account anytime with the same email to see this order in Order History.'
                  : ' This order is saved to your account Order History.'}
              </p>

              {!currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutLoginRequired(false);
                    goToPage('signup');
                  }}
                  className="w-full sm:w-auto mx-auto bg-white hover:bg-zinc-50 text-zinc-900 border-2 border-zinc-300 font-extrabold text-xs uppercase tracking-widest px-6 py-3 rounded-xl cursor-pointer transition-all"
                >
                  Create Account (Optional)
                </button>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => {
                    const invoiceElement = document.getElementById('printable-invoice');
                    if (invoiceElement) {
                      invoiceElement.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-xs uppercase tracking-widest py-3 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Receipt size={14} /> View Invoice & Bill
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                  className={`flex-1 font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl cursor-pointer transition-all border-2 flex items-center justify-center gap-2 ${
                    isGeneratingPDF 
                      ? 'bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed' 
                      : 'bg-white hover:bg-zinc-50 text-zinc-900 border-zinc-300'
                  }`}
                >
                  <Download size={14} className={isGeneratingPDF ? 'animate-pulse' : ''} />
                  {isGeneratingPDF ? 'Downloading PDF...' : 'Download Invoice'}
                </button>
              </div>
            </div>

            {/* STAGE 2: THE PHYSICAL INVOICE & BILL RECEIPT — white paper, high contrast */}
            <div 
              id="printable-invoice" 
              className="bg-white border border-zinc-300 p-6 md:p-10 rounded-2xl shadow-xl space-y-8 relative overflow-hidden font-mono text-xs text-zinc-900 max-w-2xl mx-auto print:shadow-none print:border-zinc-400"
            >
              {/* Paper top rule */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E30613] via-zinc-200 to-zinc-300" />
              
              {/* Receipt Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-zinc-200 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <BrandMark tone="red" imgClassName="w-8 h-8" />
                    <BrandWordmark
                      text={getShopBrandName(appConfig.logoText)}
                      wordClassName="text-sm md:text-base"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-2.5 uppercase font-bold leading-relaxed whitespace-pre-line">
                    {`Premium Authenticated Football Kits\n${outletContactLines(
                      getPrimaryOutlet(appConfig.footerLocations),
                      { includeEmail: true, fallbackEmail: 'support@epicvanskap.com' },
                    ).join('\n')}`}
                  </p>
                </div>
                <div className="text-left md:text-right font-mono text-[11px] space-y-1 text-zinc-800">
                  <p><span className="font-bold text-zinc-950">INVOICE:</span> #{(lastPlacedOrder.orderNumber || lastPlacedOrder.id).slice(0, 24).toUpperCase()}</p>
                  <p><span className="font-bold text-zinc-950">DATE:</span> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  <p><span className="font-bold text-zinc-950">TRACKING:</span> {lastPlacedOrder.trackingNumber}</p>
                  <p><span className="font-bold text-zinc-950">METHOD:</span> {lastPlacedOrder.paymentMethod}</p>
                </div>
              </div>

              {/* Billed To Customer Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-50 border border-zinc-200 p-4 rounded-xl">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">CLIENT DETAILS:</span>
                  <p className="font-black text-sm text-zinc-950 uppercase">{lastPlacedOrder.shippingAddress.fullName}</p>
                  <p className="text-[11px] text-zinc-700 leading-normal font-bold">Phone: {lastPlacedOrder.shippingAddress.phone}</p>
                  {lastPlacedOrder.shippingAddress.email && (
                    <p className="text-[11px] text-zinc-500 truncate">Email: {lastPlacedOrder.shippingAddress.email}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">DELIVERY DESTINATION:</span>
                  <p className="font-medium text-zinc-700 leading-relaxed">
                    {lastPlacedOrder.shippingAddress.addressLine1}<br />
                    {lastPlacedOrder.shippingAddress.city} {lastPlacedOrder.shippingAddress.postalCode ? `- ${lastPlacedOrder.shippingAddress.postalCode}` : ''}
                  </p>
                  <span className="inline-block bg-zinc-950 text-white text-[9px] px-2 py-0.5 rounded font-black uppercase mt-1">
                    {lastPlacedOrder.deliveryRegion === 'inside' ? 'Inside Dhaka (Home Delivery)' : 'Outside Dhaka (Courier)'}
                  </span>
                </div>
              </div>

              {/* Invoice Itemized Table */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">ITEMIZED DESCRIPTION:</span>
                
                <div className="border-t border-b border-zinc-300 py-2">
                  <div className="grid grid-cols-12 gap-2 font-black text-zinc-950 pb-1.5 uppercase tracking-wider text-[10px]">
                    <div className="col-span-6">JERSEY NAME</div>
                    <div className="col-span-2 text-center">SIZE</div>
                    <div className="col-span-1 text-center">QTY</div>
                    <div className="col-span-3 text-right">PRICE</div>
                  </div>
                  
                  <div className="divide-y divide-dashed divide-zinc-200">
                    {lastPlacedOrder.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 py-2 items-center text-[11px] text-zinc-800 font-semibold">
                        <div className="col-span-6 truncate font-extrabold text-zinc-950" title={item.product.name}>
                          {item.product.name}
                        </div>
                        <div className="col-span-2 text-center font-mono font-black">{item.selectedSize}</div>
                        <div className="col-span-1 text-center font-mono">{item.quantity}</div>
                        <div className="col-span-3 text-right font-mono">{formatPrice(item.product.price * item.quantity)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Billing Breakdown Bill */}
              <div className="flex flex-col items-end pt-2">
                <div className="w-full md:w-80 space-y-2.5 font-mono text-zinc-800 text-xs">
                  <div className="flex justify-between border-b border-zinc-200 pb-2">
                    <span className="font-bold">Subtotal:</span>
                    <span className="font-black text-zinc-950">{formatPrice(lastPlacedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-200 pb-2">
                    <span className="font-bold">Delivery Charge:</span>
                    <span className="font-black text-zinc-950">{lastPlacedOrder.deliveryCharge || (lastPlacedOrder.deliveryRegion === 'inside' ? 70 : 130)}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-200 pb-2">
                    <span className="font-bold">Order Total:</span>
                    <span className="font-black text-zinc-950">{formatPrice(lastPlacedOrder.total)}</span>
                  </div>
                  {lastPlacedOrder.bkashPaymentType === 'partial' ? (
                    <>
                      <div className="flex justify-between border-b border-zinc-200 pb-2 text-[10px] text-zinc-500">
                        <span className="font-bold">Advance rate:</span>
                        <span className="font-mono font-black text-zinc-700">
                          {(appConfig.bkashPartialAmountBdt ?? 300).toLocaleString('en-BD')} ×{' '}
                          {lastPlacedOrder.items.reduce((s, i) => s + (i.quantity || 0), 0)}{' '}
                          jersey
                          {lastPlacedOrder.items.reduce((s, i) => s + (i.quantity || 0), 0) === 1
                            ? ''
                            : 's'}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-200 pb-2 text-[#C70A5A]">
                        <span className="font-bold">bKash advance paid now:</span>
                        <span className="font-black">
                          {formatPrice(lastPlacedOrder.bkashPaidAmount ?? 0)}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-200 pb-2">
                        <span className="font-bold">Due on delivery:</span>
                        <span className="font-black text-zinc-950">
                          {formatPrice(
                            Math.max(
                              0,
                              lastPlacedOrder.total - (lastPlacedOrder.bkashPaidAmount ?? 0),
                            ),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-1">
                        <span className="font-black text-[#C70A5A] uppercase tracking-wide">
                          Paid via bKash now:
                        </span>
                        <span className="font-black text-[#C70A5A] underline decoration-double decoration-2 underline-offset-4">
                          {formatPrice(lastPlacedOrder.bkashPaidAmount ?? 0)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm pt-1">
                      <span className="font-black text-zinc-950 uppercase tracking-wide">
                        Grand Total to Pay:
                      </span>
                      <span className="font-black text-zinc-950 underline decoration-double decoration-2 underline-offset-4">
                        {formatPrice(
                          lastPlacedOrder.bkashPaidAmount ?? lastPlacedOrder.total,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile wallet payment receipt details */}
              {(lastPlacedOrder.paymentMethod?.toLowerCase().includes('bkash') ||
                lastPlacedOrder.paymentMethod?.toLowerCase().includes('nagad')) && (
                <div className="border-2 border-[#E2136E]/40 bg-[#FFF0F6] rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#E2136E] text-white font-black text-[9px]">SM</span>
                    <span className="font-black text-xs uppercase tracking-wider text-zinc-950">
                      {lastPlacedOrder.paymentMethod?.toLowerCase().includes('nagad') ? 'Nagad' : 'bKash'} Send Money
                      {lastPlacedOrder.bkashPaymentType === 'partial'
                        ? ' · Partial Advance'
                        : ' · Full Pay'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-zinc-700">
                    Amount sent:{' '}
                    <span className="font-mono text-zinc-950">
                      {formatPrice(lastPlacedOrder.bkashPaidAmount ?? lastPlacedOrder.total)}
                    </span>
                    {lastPlacedOrder.bkashPaymentType === 'partial' && (
                      <span className="text-zinc-500 font-medium">
                        {' '}
                        (rest{' '}
                        {formatPrice(
                          Math.max(
                            0,
                            lastPlacedOrder.total - (lastPlacedOrder.bkashPaidAmount ?? 0),
                          ),
                        )}{' '}
                        on delivery)
                      </span>
                    )}
                  </p>
                  {lastPlacedOrder.bkashNumber && (
                    <p className="text-[11px] font-bold text-zinc-700">
                      From: <span className="font-mono text-zinc-950">{lastPlacedOrder.bkashNumber}</span>
                    </p>
                  )}
                  {lastPlacedOrder.bkashTransactionId && (
                    <p className="text-[11px] font-bold text-zinc-700">
                      TrxID: <span className="font-mono uppercase text-zinc-950">{lastPlacedOrder.bkashTransactionId}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Decorative Authentic Elements */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-6 border-t-2 border-zinc-200">
                {/* Simulated Barcode */}
                <div className="flex flex-col items-start gap-1">
                  <div className="h-10 w-44 flex gap-[2px] items-stretch opacity-90">
                    {[1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3].map((w, i) => (
                      <div 
                        key={i} 
                        className="bg-zinc-950" 
                        style={{ width: `${w}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono tracking-[4px] text-zinc-500 font-bold uppercase">
                    *{lastPlacedOrder.id.slice(0, 8).toUpperCase()}*
                  </span>
                </div>

                {/* Vault Stamp / Guarantee */}
                <div className="border-4 border-double border-zinc-400 rounded-full px-5 py-2 text-center text-zinc-500 select-none scale-90 rotate-[-2deg] bg-white">
                  <p className="text-[8px] font-black tracking-widest uppercase">OFFICIAL SEAL</p>
                  <p className="text-[11px] font-black tracking-tight text-zinc-800 uppercase">Epic Vanskap AUTHENTIC</p>
                  <p className="text-[8px] font-mono tracking-widest uppercase font-bold">100% DEADSTOCK CO.</p>
                </div>
              </div>

              {/* Print Footer Note */}
              <p className="text-center text-[9px] text-zinc-500 font-mono pt-4 leading-normal uppercase font-bold">
                Thank you for supporting historical football preservation.<br />
                This is a computer-generated invoice and serves as a valid Cash on Delivery receipt.
              </p>
            </div>

            {/* Action Buttons to Continue */}
            <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto pt-4">
              <button
                onClick={() => {
                  setLastPlacedOrder(null);
                  goToPage('listing');
                }}
                className="flex-1 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-sm uppercase tracking-wide py-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag size={14} /> Go to Home
              </button>
              <button
                onClick={() => {
                  setLastPlacedOrder(null);
                  goToPage('dashboard');
                }}
                className="flex-1 bg-white hover:bg-zinc-50 text-zinc-900 font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl cursor-pointer transition-all border-2 border-zinc-300 flex items-center justify-center gap-2"
              >
                View My Purchase History
              </button>
            </div>
          </section>
        )}

        {/* ROUTE 7–8: admin/auth live in secret portal shell above — not in storefront */}

        {/* ROUTE 8: WISHLIST / GUEST DASHBOARD — no customer login */}
        {!isAdminShell && currentPage === 'dashboard' && (
          <CustomerDashboard
            orders={[]}
            wishlist={wishlist}
            currentUserEmail={undefined}
            currentUserPhone={undefined}
            onRemoveWishlist={handleRemoveWishlist}
            onSelectProduct={(p) => {
              goToPage('details', { product: p });
            }}
            setCurrentPage={setCurrentPageNav}
            formatPrice={formatPrice}
          />
        )}

        {/* ROUTE 9: SELL SHIRT PORTAL */}
        {!isAdminShell && currentPage === 'seller' && (
          <SellerModule onAddRequest={handleAddSellerRequest} />
        )}

        {/* ROUTE 10+: INFORMATION COMPLIANCE PAGES */}
        {!isAdminShell &&
          (currentPage === 'faq' ||
            currentPage === 'about' ||
            currentPage === 'authenticity' ||
            currentPage === 'contact' ||
            currentPage === 'privacy' ||
            currentPage === 'refund' ||
            currentPage === 'terms' ||
            currentPage === 'shipping') && (
          <InfoPages
            pageType={currentPage}
            onBack={() => goToPage('listing')}
            brandName={getShopBrandName(appConfig.logoText)}
            outlets={appConfig.footerLocations}
          />
        )}

      </main>

      {!isAdminShell && (
        <>
          {/* Embedded Brand Footer — extra space above fixed mobile bottom nav */}
          <div className="pb-20 lg:pb-0">
            <Footer currentPage={currentPage} setCurrentPage={setCurrentPageNav} appConfig={appConfig} />
          </div>
        </>
      )}
        </div>
      </div>

      {!isAdminShell && (
        <>
          <MobileBottomNav
            currentPage={currentPage}
            searchQuery={searchQuery}
            cartCount={cart.reduce((n, i) => n + i.quantity, 0)}
            onHome={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              goToPage('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSearch={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              requestAnimationFrame(() => {
                const listingInput = document.getElementById(
                  'listing-search-input',
                ) as HTMLInputElement | null;
                const headerInput = document.getElementById(
                  'mobile-header-search',
                ) as HTMLInputElement | null;
                const input = listingInput || headerInput;
                input?.focus();
                input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });
            }}
            onCategories={() => {
              showAllJerseys();
            }}
            onCart={() => {
              goToPage('cart');
            }}
          />
        </>
      )}
    </div>
  );
}
