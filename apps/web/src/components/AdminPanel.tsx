import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AreaChart, Users, Shirt, ShoppingBag, Check, X, ShieldAlert, BadgeCheck, FileText, Plus, Save, Sparkles, Download, Upload, AlertTriangle, Image, Trash2, Edit, Search, Smartphone, Monitor, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, SlidersHorizontal, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw, BarChart3, Clock, CheckCircle, AlertOctagon, HelpCircle, UserCheck, PlusCircle, Activity, Trophy, Star, Flame, Globe, Tag, Box, Compass, Heart, Phone, MapPin, Mail, Layers, Grid, ArrowUp, ArrowDown, ShieldCheck, Award, Printer, Truck, RotateCcw, DollarSign, CheckCircle2, PackageCheck, Send, Copy, ExternalLink, XCircle, Eye, Bell, CreditCard, LayoutGrid, type LucideIcon } from 'lucide-react';
import { Product, SellerRequest, Order, CarouselSlide, AppConfig, BannerConfig, BannerType, MenuItem, MenuPlacement, PageSection, DailyDealItem } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { InventoryEditor } from './InventoryEditor';
import { ProductManager } from './ProductManager';
import { TEAMS_LIST, RIVALRY_PRESETS, TeamItem } from '../data/teamsData';
import { DEFAULT_LEAGUES } from '../data/leaguesData';
import { LeagueLogo } from './LeagueLogo';
import { LeagueConfigItem } from '../types';
import { api, getToken, isApiEnabled } from '../lib/apiClient';
import { uploadStoreImage } from '../lib/cloudinaryUpload';
import { confirmAsync, toast } from './UiFeedback';
import { BrandMark } from './BrandMark';
import { isBannerLive } from '../lib/bannerVisibility';
import { persistOrders } from '../lib/orderStorage';
import { DEFAULT_HOMEPAGE_SECTIONS } from './DynamicPageRenderer';
import {
  countProductsInSection,
  ensureCategoryForSection,
  getInStockProducts,
  isProductRowSection,
  normalizeHomepageSections,
  resolveSectionCategory,
  toggleSectionProductId,
  usesManualProductSelection,
} from '../lib/homepageSections';
import {
  normalizeDailyDealItems,
  suggestCompareAtPrice,
  suggestDealPrice,
} from '../lib/dailyDeals';
import { calcDiscountPercent, roundMoney } from '../lib/productPricing';
import { formatBannerPx, getBannerPixelSpecs } from '../lib/bannerImageSpecs';
import { PosPanel } from './admin/PosPanel';
import { SalesPanel } from './admin/SalesPanel';
import { CustomersPanel } from './admin/CustomersPanel';
import { AccountsExpensesPanel } from './admin/AccountsExpensesPanel';
export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  location: string;
  notes?: string;
  ordersCount: number;
  totalSpent: number;
  joinedDate: string;
}

function parseOrderDate(order: Pick<Order, 'createdAt' | 'date'>): Date | null {
  const raw = String(order.createdAt || order.date || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Human wait / age since order was placed (e.g. "12m", "3h 20m", "2d 4h"). */
function formatOrderWait(order: Pick<Order, 'createdAt' | 'date'>, nowMs = Date.now()): string {
  const d = parseOrderDate(order);
  if (!d) return '—';
  const mins = Math.max(0, Math.floor((nowMs - d.getTime()) / 60_000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hours < 24) return remM ? `${hours}h ${remM}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH ? `${days}d ${remH}h` : `${days}d`;
}

function formatOrderClock(order: Pick<Order, 'createdAt' | 'date'>): string {
  const d = parseOrderDate(order);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

interface AdminPanelProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  sellerRequests: SellerRequest[];
  setSellerRequests: React.Dispatch<React.SetStateAction<SellerRequest[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  onBackToCatalog: () => void;
  slides: CarouselSlide[];
  setSlides: React.Dispatch<React.SetStateAction<CarouselSlide[]>>;
  appConfig: AppConfig;
  onUpdateConfig: (newConfig: AppConfig | ((prev: AppConfig) => AppConfig)) => void;
  formatPrice: (amount: number) => string;
  onRequireStaffLogin?: () => void;
  /** Signed-in staff for header identity strip */
  staffUser?: { fullName?: string; email?: string; role?: string } | null;
  onSignOut?: () => void;
  /** URL-synced admin module (browser Back support) */
  initialAdminTab?: string;
  onAdminTabChange?: (tab: string) => void;
}

const CAROUSEL_PRESETS = [
  { name: 'WC 2026 Arena', url: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Stadium Lamps', url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Match Battle', url: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Sunset Field', url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Fan Festival', url: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1600' },
  { name: 'Green Pitch', url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=1600' }
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  setProducts,
  sellerRequests,
  setSellerRequests,
  orders,
  setOrders,
  onBackToCatalog,
  slides,
  setSlides,
  appConfig,
  onUpdateConfig,
  formatPrice,
  onRequireStaffLogin,
  staffUser,
  onSignOut,
  initialAdminTab,
  onAdminTabChange,
}) => {
  // Tabs: 'dashboard' | 'inventory' | 'seller-requests' | 'homepage-builder' | 'coupons'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'seller-requests' | 'homepage-builder' | 'coupons'>(() => {
    const t = initialAdminTab || 'dashboard';
    if (['dashboard', 'inventory', 'seller-requests', 'homepage-builder', 'coupons', 'brand-customizer'].includes(t)) {
      return (t === 'brand-customizer' ? 'homepage-builder' : t) as 'dashboard' | 'inventory' | 'seller-requests' | 'homepage-builder' | 'coupons';
    }
    return 'dashboard';
  });
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>(() => initialAdminTab || 'dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync when browser Back/Forward changes admin tab in the URL
  useEffect(() => {
    if (!initialAdminTab) return;
    setActiveSidebarTab(initialAdminTab);
    if (['dashboard', 'inventory', 'seller-requests', 'homepage-builder', 'coupons', 'brand-customizer'].includes(initialAdminTab)) {
      setActiveTab(
        (initialAdminTab === 'brand-customizer' ? 'homepage-builder' : initialAdminTab) as typeof activeTab,
      );
    }
  }, [initialAdminTab]);

  const selectAdminModule = (itemId: string) => {
    setActiveSidebarTab(itemId);
    setSidebarOpen(false);
    if (['dashboard', 'inventory', 'seller-requests', 'homepage-builder', 'coupons', 'brand-customizer'].includes(itemId)) {
      setActiveTab(itemId === 'brand-customizer' ? 'homepage-builder' : (itemId as typeof activeTab));
    } else {
      setActiveTab('homepage-builder');
    }
    onAdminTabChange?.(itemId);
  };
  // Custom pages and custom sections local form state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionFormBg, setSectionFormBg] = useState('bg-white');
  const [sectionFormPadding, setSectionFormPadding] = useState('py-12');
  const [sectionFormMargin, setSectionFormMargin] = useState('my-0');
  const [sectionFormTitle, setSectionFormTitle] = useState('');
  const [sectionFormSubtitle, setSectionFormSubtitle] = useState('');
  const [sectionFormBtnText, setSectionFormBtnText] = useState('');
  const [sectionFormBtnUrl, setSectionFormBtnUrl] = useState('');
  const [sectionFormAnim, setSectionFormAnim] = useState<'none' | 'fadeIn' | 'slideUp'>('none');
  const [sectionFormStatus, setSectionFormStatus] = useState<'active' | 'draft'>('active');
  const [newProductRowTitle, setNewProductRowTitle] = useState('');
  const [newProductRowSubtitle, setNewProductRowSubtitle] = useState('');
  const [newProductRowCategory, setNewProductRowCategory] = useState('');
  const [expandedProductPickerSectionId, setExpandedProductPickerSectionId] = useState<string | null>(null);
  const [productPickerSearch, setProductPickerSearch] = useState('');
  const [flashOfferSearch, setFlashOfferSearch] = useState('');
  const flashDealsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New Custom Page Form State
  const [newPageName, setNewPageName] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');

  // Sourced entities list mock states
  const [clubsList, setClubsList] = useState([
    { id: 'c-1', name: 'Real Madrid', badge: '⚪', status: 'Active' },
    { id: 'c-2', name: 'FC Barcelona', badge: '🔵', status: 'Active' },
    { id: 'c-3', name: 'Manchester United', badge: '🔴', status: 'Active' },
    { id: 'c-4', name: 'Liverpool', badge: '🔴', status: 'Active' },
    { id: 'c-5', name: 'Arsenal', badge: '🔴', status: 'Active' },
    { id: 'c-6', name: 'Bayern Munich', badge: '🔴', status: 'Active' },
  ]);

  // Coupons disabled store-wide — no generator state

  React.useEffect(() => {
    if (!isApiEnabled() || !getToken()) return;

    void api
      .listUsers()
      .then((data) => {
        if (data?.customers) setCustomers(data.customers as CustomerProfile[]);
      })
      .catch(() => undefined);

    void api
      .listSellerRequests()
      .then(({ items }) => setSellerRequestsDb(items || []))
      .catch(() => undefined);

    void api
      .adminStats()
      .then((stats) => setAdminStats(stats))
      .catch(() => undefined);

    // Sync catalog from Neon — merge by id so in-flight saves aren't wiped
    void api
      .listAllProducts({ all: true })
      .then(({ items }) => {
        const incoming = Array.isArray(items) ? (items as Product[]) : [];
        setProducts((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          for (const item of incoming) {
            byId.set(item.id, { ...(byId.get(item.id) || {}), ...item });
          }
          return incoming.map((p) => byId.get(p.id)!);
        });
        try {
          localStorage.removeItem('vault_custom_products');
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);

    // Always replace local/demo ledger with Neon orders when staff is authenticated
    void import('../lib/mapOrder')
      .then(({ mapApiOrderToSpa }) =>
        api.listOrders({ limit: 50 }).then(({ items }) => {
          setOrders((items || []).map((o: any) => mapApiOrderToSpa(o)));
          try {
            localStorage.removeItem('vault_orders');
          } catch {
            /* ignore */
          }
        }),
      )
      .catch(() => undefined);
  }, []);

  // New-order notifications for staff (poll Neon every 15s)
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const [orderNotify, setOrderNotify] = useState<string | null>(null);
  useEffect(() => {
    if (!(isApiEnabled() && getToken())) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { mapApiOrderToSpa } = await import('../lib/mapOrder');
        const { items } = await api.listOrders({ limit: 30 });
        if (cancelled) return;
        const mapped = (items || []).map((o: any) => mapApiOrderToSpa(o));
        const ids = new Set(mapped.map((o) => o.id));
        if (knownOrderIdsRef.current.size === 0) {
          knownOrderIdsRef.current = ids;
        } else {
          const newcomers = mapped.filter((o) => !knownOrderIdsRef.current.has(o.id));
          if (newcomers.length) {
            const msg =
              newcomers.length === 1
                ? `New order ${newcomers[0].id} from ${newcomers[0].shippingAddress?.fullName || 'customer'}`
                : `${newcomers.length} new orders received`;
            setOrderNotify(msg);
            setOrderNotifications((prev) => [
              ...newcomers.map((o) => ({
                id: o.id,
                message: `Order ${o.id} — ${o.shippingAddress?.fullName || 'Customer'} · ${formatPrice(o.total)}`,
                at: new Date().toLocaleString(),
                read: false,
              })),
              ...prev,
            ].slice(0, 50));
            window.setTimeout(() => setOrderNotify(null), 8000);
            knownOrderIdsRef.current = new Set([...knownOrderIdsRef.current, ...ids]);
            setOrders((prev) => {
              const byId = new Map(prev.map((o) => [o.id, o]));
              for (const o of mapped) byId.set(o.id, o);
              return [...byId.values()].sort((a, b) =>
                String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
              );
            });
          }
        }
      } catch {
        /* ignore poll errors */
      }
    };
    void poll();
    const timer = window.setInterval(poll, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [setOrders, formatPrice]);

  // Restock helper — offline/demo only (inventory editor owns live stock)
  const handleRestockLowItems = () => {
    if (isApiEnabled() && getToken()) {
      alert('Bulk restock is disabled on the live database. Use Inventory Editor to adjust stock.');
      return;
    }
    setProducts((prev) => {
      const next = prev.map((p) => (p.stock <= 3 ? { ...p, stock: 12 } : p));
      if (!isApiEnabled()) {
        localStorage.setItem('vault_custom_products', JSON.stringify(next));
      }
      return next;
    });
    handleAddLog('[STOCK] Bulk restocked all low limit and out of stock jerseys (set to 12 qty)');
    alert('Successfully restocked all low-stock jerseys in Dhaka warehouse to 12 items!');
  };

  // Homepage customizer
  const [heroTitle, setHeroTitle] = useState('WORLD CUP 2026 EDITION');
  const [activePromoBanner, setActivePromoBanner] = useState(true);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [previewDeviceMode, setPreviewDeviceMode] = useState<'desktop' | 'mobile'>('desktop');

  // Countdown search states
  const [team1Search, setTeam1Search] = useState('');
  const [team2Search, setTeam2Search] = useState('');
  const [team1Category, setTeam1Category] = useState('All');
  const [team2Category, setTeam2Category] = useState('All');

  // Banner Management Deck State
  const [bannerCategoryFilter, setBannerCategoryFilter] = useState<string>('All');
  const [editingBanner, setEditingBanner] = useState<BannerConfig | null>(null);
  const [isAddingBanner, setIsAddingBanner] = useState(false);
  const [bannerImageTab, setBannerImageTab] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [bannerUploading, setBannerUploading] = useState(false);

  // Navigation Builder State
  const [menuPlacementFilter, setMenuPlacementFilter] = useState<string>('All');
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [isAddingMenuItem, setIsAddingMenuItem] = useState<boolean>(false);

  // Draft edits + explicit save UX
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [draftPages, setDraftPages] = useState(() => appConfig.pages || []);
  const [draftLogoText, setDraftLogoText] = useState(appConfig.logoText);
  const [draftExchangeRate, setDraftExchangeRate] = useState(appConfig.exchangeRate);
  const [draftFooterAbout, setDraftFooterAbout] = useState(appConfig.footerAbout);
  const [draftFooterCopyright, setDraftFooterCopyright] = useState(appConfig.footerCopyright);
  const [draftMenuItems, setDraftMenuItems] = useState<MenuItem[]>(() => appConfig.menuItems || []);

  const showSaveFeedback = (msg: string) => {
    setSaveFeedback(msg);
    window.setTimeout(() => setSaveFeedback(null), 2800);
  };

  React.useEffect(() => {
    setDraftPages(appConfig.pages || []);
    setDraftLogoText(appConfig.logoText);
    setDraftExchangeRate(appConfig.exchangeRate);
    setDraftFooterAbout(appConfig.footerAbout);
    setDraftFooterCopyright(appConfig.footerCopyright);
    setDraftMenuItems(appConfig.menuItems || []);
  }, [appConfig.pages, appConfig.logoText, appConfig.exchangeRate, appConfig.footerAbout, appConfig.footerCopyright, appConfig.menuItems]);

  // Order Management Operations Detailed State
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('All');
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [orderDownloadRange, setOrderDownloadRange] = useState<'all' | 'weekly' | 'monthly' | 'yearly' | 'date'>('all');
  const [orderDownloadDate, setOrderDownloadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orderNotifications, setOrderNotifications] = useState<Array<{ id: string; message: string; at: string; read: boolean }>>([]);
  const [showOrderNotifPanel, setShowOrderNotifPanel] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Editable fields for selected order modal
  const [editingInternalNotes, setEditingInternalNotes] = useState<string>('');
  const [editingCarrier, setEditingCarrier] = useState<string>('');
  const [editingTrackingNumber, setEditingTrackingNumber] = useState<string>('');
  const [editingTrackingUrl, setEditingTrackingUrl] = useState<string>('');
  const [editingShippedDate, setEditingShippedDate] = useState<string>('');
  const [editingEstDelivery, setEditingEstDelivery] = useState<string>('');

  // Helper icon renderer
  const renderNavIcon = (iconName?: string, size = 16) => {
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
      case 'Users': return <Users size={size} />;
      case 'MapPin': return <MapPin size={size} />;
      case 'Mail': return <Mail size={size} />;
      case 'Layers': return <Layers size={size} />;
      case 'Grid': return <Grid size={size} />;
      default: return <Shirt size={size} />;
    }
  };

  // Image uploader state for quick stock addition
  const [quickAddImage, setQuickAddImage] = useState<string>('');

  // Customer Profile State — loaded from Neon
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [sellerRequestsDb, setSellerRequestsDb] = useState<
    Array<{ id: string; shirtName: string; brand: string; season: string; condition: string; expectedPrice: number; status: string; adminNote?: string }>
  >([]);

  // Log activity list
  const [logs, setLogs] = useState<string[]>(() => {
    const stored = localStorage.getItem('vault_admin_logs');
    return stored ? JSON.parse(stored) : [];
  });

  const handleAddLog = (msg: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setLogs((prev) => {
      const updated = [`[${timestamp}] ${msg}`, ...prev].slice(0, 30);
      localStorage.setItem('vault_admin_logs', JSON.stringify(updated));
      return updated;
    });
  };

  const [adminStats, setAdminStats] = useState<{
    revenue: number;
    expense: number;
    profit: number;
    orderCount: number;
    productCount: number;
    customerCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    pendingOrdersCount: number;
    monthlyTrends: Array<{ month: string; sales: number; revenue: number }>;
  } | null>(null);
  const [chartMetric, setChartMetric] = useState<'sales' | 'revenue'>('revenue');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'repeated' | 'best'>('all');
  
  // Save Customer Form State
  const [custFormId, setCustFormId] = useState('');
  const [custFormName, setCustFormName] = useState('');
  const [custFormEmail, setCustFormEmail] = useState('');
  const [custFormPhone, setCustFormPhone] = useState('');
  const [custFormAddress, setCustFormAddress] = useState('');
  const [custFormCity, setCustFormCity] = useState('Dhaka');
  const [custFormNotes, setCustFormNotes] = useState('');
  const [custFormOrders, setCustFormOrders] = useState(1);
  const [custFormSpent, setCustFormSpent] = useState(150);

  // CSV progress bars simulation
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const analyticsSnapshot = useMemo(() => {
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    const revenueForYear = (year: number) =>
      activeOrders
        .filter((o) => {
          const d = new Date(o.createdAt || o.date || '');
          return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
        })
        .reduce((sum, o) => sum + o.total, 0);

    const curYearRev = revenueForYear(currentYear);
    const prevYearRev = revenueForYear(prevYear);
    const yoyGrowth =
      prevYearRev > 0
        ? Math.round(((curYearRev - prevYearRev) / prevYearRev) * 1000) / 10
        : curYearRev > 0
          ? 100
          : 0;

    const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;
    const fulfillmentRate =
      activeOrders.length > 0 ? Math.round((deliveredCount / activeOrders.length) * 1000) / 10 : 0;

    let dhakaBuyerCount = 0;
    let dhakaRepeatCount = 0;
    if (customers.length > 0) {
      const dhakaCustomers = customers.filter((c) =>
        (c.city || c.location || '').toLowerCase().includes('dhaka'),
      );
      dhakaBuyerCount = dhakaCustomers.length;
      dhakaRepeatCount = dhakaCustomers.filter((c) => c.ordersCount >= 2).length;
    } else {
      const dhakaOrderCustomers = new Map<string, number>();
      activeOrders.forEach((o) => {
        const city = (o.shippingAddress?.city || '').toLowerCase();
        if (!city.includes('dhaka')) return;
        const key =
          o.shippingAddress?.email ||
          o.shippingAddress?.phone ||
          o.shippingAddress?.fullName ||
          o.id;
        dhakaOrderCustomers.set(key, (dhakaOrderCustomers.get(key) || 0) + 1);
      });
      dhakaBuyerCount = dhakaOrderCustomers.size;
      dhakaRepeatCount = [...dhakaOrderCustomers.values()].filter((n) => n >= 2).length;
    }
    const dhakaRepeatRate =
      dhakaBuyerCount > 0 ? Math.round((dhakaRepeatCount / dhakaBuyerCount) * 1000) / 10 : 0;

    const monthlyMap = new Map<number, number>();
    activeOrders.forEach((o) => {
      const d = new Date(o.createdAt || o.date || '');
      if (Number.isNaN(d.getTime()) || d.getFullYear() !== currentYear) return;
      const m = d.getMonth();
      monthlyMap.set(m, (monthlyMap.get(m) || 0) + o.total);
    });

    if (monthlyMap.size === 0 && adminStats?.monthlyTrends?.length) {
      adminStats.monthlyTrends.forEach((t, idx) => {
        monthlyMap.set(idx % 12, t.revenue || 0);
      });
    }

    const monthlyRevenue = monthLabels.map((label, i) => ({
      month: label,
      revenue: monthlyMap.get(i) || 0,
    }));
    const maxMonthly = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);

    return {
      currentYear,
      prevYear,
      curYearRev,
      prevYearRev,
      yoyGrowth,
      fulfillmentRate,
      dhakaRepeatRate,
      dhakaBuyerCount,
      dhakaRepeatCount,
      monthlyRevenue,
      maxMonthly,
      hasOrderData: activeOrders.length > 0,
    };
  }, [orders, customers, adminStats]);

  const homepageSections = normalizeHomepageSections(appConfig.homepageSections || DEFAULT_HOMEPAGE_SECTIONS);
  const productRowSections = homepageSections.filter(isProductRowSection);
  const categoryNameOptions = useMemo(() => {
    const names = new Set<string>();
    (appConfig.categoryItems || []).forEach((c) => names.add(c.name));
    productRowSections.forEach((s) => {
      const cat = resolveSectionCategory(s);
      if (cat) names.add(cat);
    });
    ['Featured', 'Current Season', 'Clearance', 'Best Sellers', 'New In', 'World Cup'].forEach((n) => names.add(n));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [appConfig.categoryItems, productRowSections]);

  const homepageSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistHomepageSectionsToDb = (
    sections: PageSection[],
    categoryItems: AppConfig['categoryItems'],
    nextConfig: AppConfig,
  ) => {
    if (!isApiEnabled()) return;
    if (!getToken()) {
      if (onRequireStaffLogin) onRequireStaffLogin();
      return;
    }
    void api
      .saveHomepageSections(sections, categoryItems)
      .then((data) => {
        if (data?.homepageSections?.length) {
          onUpdateConfig({
            ...nextConfig,
            homepageSections: data.homepageSections,
            categoryItems,
          });
        }
        showSaveFeedback('Homepage product rows saved for all visitors');
      })
      .catch((err) => {
        toast(err instanceof Error ? err.message : 'Failed to save homepage rows to database', 'error');
      });
  };

  const patchHomepageSections = (
    sections: PageSection[],
    categoryToEnsure?: string,
    options?: { immediate?: boolean },
  ) => {
    const uniqueSections = normalizeHomepageSections(sections);
    const categoryItems = categoryToEnsure
      ? ensureCategoryForSection(appConfig.categoryItems, categoryToEnsure)
      : appConfig.categoryItems;
    const nextConfig = { ...appConfig, homepageSections: uniqueSections, categoryItems };
    onUpdateConfig(nextConfig);

    if (homepageSaveTimer.current) clearTimeout(homepageSaveTimer.current);
    if (options?.immediate) {
      persistHomepageSectionsToDb(uniqueSections, categoryItems, nextConfig);
      return;
    }
    homepageSaveTimer.current = setTimeout(() => {
      persistHomepageSectionsToDb(uniqueSections, categoryItems, nextConfig);
    }, 700);
  };

  const normalizeBannerPayload = (banner: BannerConfig): BannerConfig => ({
    ...banner,
    title: (banner.title || '').trim(),
    subtitle: (banner.subtitle || '').trim(),
    description: (banner.description || '').trim(),
    cta: (banner.cta || banner.ctaText || '').trim(),
    ctaText: (banner.cta || banner.ctaText || '').trim(),
    buttonUrl: (banner.buttonUrl || '').trim(),
    sortOrder: banner.sortOrder ?? 0,
  });

  const persistBannersToDb = async (banners: BannerConfig[]) => {
    if (!isApiEnabled()) return banners;
    if (!getToken()) {
      if (onRequireStaffLogin) onRequireStaffLogin();
      throw new Error('Staff sign-in required to save banners');
    }
    const existing = await api.listBanners().catch(() => ({ items: [] as BannerConfig[] }));
    const remoteIds = new Set((existing.items || []).map((b: BannerConfig) => b.id));
    const localIds = new Set(banners.map((b) => b.id));

    for (const banner of banners) {
      const payload = normalizeBannerPayload(banner);
      if (remoteIds.has(banner.id)) {
        await api.updateBanner(banner.id, payload);
      } else {
        // createBanner upserts by id on the server — safe under concurrent sync
        await api.createBanner(payload);
      }
    }
    for (const id of remoteIds) {
      if (!localIds.has(id)) {
        await api.deleteBanner(id).catch(() => undefined);
      }
    }
    await api.reorderBanners(
      [...banners]
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((b) => b.id),
    );
    const refreshed = await api.listBanners();
    return (refreshed.items || []) as BannerConfig[];
  };

  const bannersPersistGen = useRef(0);
  const updateBannersConfig = (banners: BannerConfig[], feedback?: string) => {
    const next = { ...appConfig, banners };
    onUpdateConfig(next);
    if (!isApiEnabled()) {
      if (feedback) showSaveFeedback(feedback);
      return;
    }
    const gen = ++bannersPersistGen.current;
    void persistBannersToDb(banners)
      .then((saved) => {
        if (gen !== bannersPersistGen.current) return; // newer save in flight
        onUpdateConfig({ ...next, banners: saved.length ? saved : banners });
        showSaveFeedback(feedback || 'Banners saved for all visitors');
      })
      .catch((err) => {
        if (gen !== bannersPersistGen.current) return;
        if (err instanceof Error && err.message.includes('Staff sign-in')) return;
        toast(err instanceof Error ? err.message : 'Failed to save banners to database', 'error');
      });
  };

  const updateHomepageSection = (id: string, patch: Partial<PageSection>, immediate = false) => {
    const sections = homepageSections.map((s) => (s.id === id ? { ...s, ...patch } : s));
    patchHomepageSections(sections, patch.productCategory, { immediate });
  };

  const dailyDealSection =
    homepageSections.find((s) => s.id === 'daily-deals') ||
    DEFAULT_HOMEPAGE_SECTIONS.find((s) => s.id === 'daily-deals');
  const dailyDealVisible = appConfig.dailyDealEnabled === true;
  const flashOfferProducts = products.filter(
    (p) =>
      p.category !== 'Mystery' &&
      !/mystery/i.test(p.name) &&
      p.status !== 'Trashed' &&
      p.status !== 'Archived' &&
      !p.isTrashed,
  );
  const flashDealItems = useMemo(() => {
    const items = normalizeDailyDealItems(appConfig.dailyDealItems);
    if (items.length > 0) return items;
    // Legacy single-product fallback so older configs still show in admin
    const legacyId = appConfig.dailyDealProductId;
    if (!legacyId) return [];
    const product = flashOfferProducts.find((p) => p.id === legacyId);
    if (!product) return [];
    return [
      {
        productId: legacyId,
        dealPrice: suggestDealPrice(product),
        compareAtPrice: suggestCompareAtPrice(product),
        isHotDeal: true,
        stockLeft: Math.max(1, Number(product.stock) || 1),
        claimedPercent: 80,
        sortOrder: 0,
      },
    ];
  }, [appConfig.dailyDealItems, appConfig.dailyDealProductId, flashOfferProducts]);

  const persistFlashDeals = (items: DailyDealItem[], endsAt?: string | null) => {
    const normalized = normalizeDailyDealItems(
      items.map((item, index) => ({ ...item, sortOrder: index })),
    );
    const nextEndsAt = endsAt === undefined ? appConfig.dailyDealEndsAt ?? null : endsAt;
    const nextConfig: AppConfig = {
      ...appConfig,
      dailyDealItems: normalized,
      dailyDealProductId: normalized[0]?.productId,
      dailyDealEndsAt: nextEndsAt,
    };
    onUpdateConfig(nextConfig);

    if (isApiEnabled() && getToken()) {
      if (flashDealsSaveTimer.current) clearTimeout(flashDealsSaveTimer.current);
      flashDealsSaveTimer.current = setTimeout(() => {
        void api
          .updateCmsSettings({
            dailyDealItems: normalized,
            dailyDealProductId: normalized[0]?.productId ?? null,
            dailyDealEndsAt: nextEndsAt || null,
          })
          .then(() => {
            showSaveFeedback(
              normalized.length
                ? `Hot deals saved (${normalized.length} product${normalized.length === 1 ? '' : 's'})`
                : 'Hot deals cleared',
            );
          })
          .catch((err) => {
            toast(err instanceof Error ? err.message : 'Failed to save hot deals', 'error');
          });
      }, 400);
    } else if (isApiEnabled()) {
      if (onRequireStaffLogin) onRequireStaffLogin();
    } else {
      showSaveFeedback('Hot deals updated (local)');
    }
  };

  const addFlashDealProduct = (productId: string) => {
    if (flashDealItems.some((d) => d.productId === productId)) return;
    const product = flashOfferProducts.find((p) => p.id === productId);
    if (!product) return;
    const next: DailyDealItem = {
      productId,
      dealPrice: suggestDealPrice(product),
      compareAtPrice: suggestCompareAtPrice(product),
      isHotDeal: true,
      stockLeft: Math.max(1, Number(product.stock) || 1),
      claimedPercent: 70,
      sortOrder: flashDealItems.length,
    };
    persistFlashDeals([...flashDealItems, next]);
  };

  const updateFlashDealItem = (productId: string, patch: Partial<DailyDealItem>) => {
    persistFlashDeals(
      flashDealItems.map((item) => (item.productId === productId ? { ...item, ...patch } : item)),
    );
  };

  const removeFlashDealProduct = (productId: string) => {
    persistFlashDeals(flashDealItems.filter((item) => item.productId !== productId));
  };

  const moveFlashDeal = (productId: string, direction: -1 | 1) => {
    const index = flashDealItems.findIndex((item) => item.productId === productId);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= flashDealItems.length) return;
    const next = [...flashDealItems];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    persistFlashDeals(next);
  };

  const toggleDailyDealVisibility = () => {
    const nextVisible = !dailyDealVisible;
    let sections = homepageSections;
    if (!sections.some((s) => s.id === 'daily-deals') && dailyDealSection) {
      const featuredIdx = sections.findIndex((s) => s.id === 'featured-collection');
      const insertAt = featuredIdx >= 0 ? featuredIdx + 1 : sections.length;
      sections = [...sections.slice(0, insertAt), dailyDealSection, ...sections.slice(insertAt)];
    }
    const updated = sections.map((s) =>
      s.id === 'daily-deals'
        ? { ...s, visible: nextVisible, status: nextVisible ? ('active' as const) : ('inactive' as const) }
        : s,
    );
    const uniqueSections = normalizeHomepageSections(updated);
    const nextConfig = {
      ...appConfig,
      dailyDealEnabled: nextVisible,
      homepageSections: uniqueSections,
    };
    onUpdateConfig(nextConfig);

    if (isApiEnabled() && getToken()) {
      void api
        .updateCmsSettings({ dailyDealEnabled: nextVisible })
        .catch((err) => {
          toast(err instanceof Error ? err.message : 'Failed to save flash offer setting', 'error');
        });
      persistHomepageSectionsToDb(uniqueSections, appConfig.categoryItems, nextConfig);
    } else if (isApiEnabled()) {
      if (onRequireStaffLogin) onRequireStaffLogin();
    }

    showSaveFeedback(
      nextVisible ? 'Flash offer is now visible for all visitors' : 'Flash offer hidden for all visitors',
    );
  };

  const handleAddProductRowSection = () => {
    if (!newProductRowTitle.trim() || !newProductRowCategory.trim()) return;
    const id = `product-row-${Date.now()}`;
    const newSection: PageSection = {
      id,
      name: newProductRowTitle.trim(),
      sectionType: 'product-row',
      productCategory: newProductRowCategory.trim(),
      title: newProductRowTitle.trim().toUpperCase(),
      subtitle: newProductRowSubtitle.trim(),
      visible: true,
      bgColor: 'bg-white',
      padding: 'py-12',
      margin: 'my-0',
      maxProducts: 4,
      buttonText: 'VIEW ALL',
      buttonUrl: 'listing',
      status: 'active',
    };
    patchHomepageSections([...homepageSections, newSection], newProductRowCategory.trim(), {
      immediate: true,
    });
    setNewProductRowTitle('');
    setNewProductRowSubtitle('');
    setNewProductRowCategory('');
    showSaveFeedback(`Added homepage section "${newSection.title}"`);
  };

  const handleDeleteHomepageSection = async (id: string) => {
    const section = homepageSections.find((s) => s.id === id);
    if (!section) return;
    const ok = await confirmAsync({
      title: 'Delete section',
      message: `Delete homepage section "${section.title || section.name}"?`,
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    patchHomepageSections(homepageSections.filter((s) => s.id !== id), undefined, {
      immediate: true,
    });
    if (expandedProductPickerSectionId === id) setExpandedProductPickerSectionId(null);
    showSaveFeedback(`Deleted section "${section.title || section.name}"`);
  };

  const toggleSectionProduct = (sectionId: string, productId: string) => {
    const section = homepageSections.find((s) => s.id === sectionId);
    if (!section) return;
    const updated = toggleSectionProductId(section, productId);
    updateHomepageSection(sectionId, {
      selectedProductIds: updated.selectedProductIds,
      productSelectionMode: updated.productSelectionMode,
    }, true);
  };

  const clearSectionManualProducts = (sectionId: string) => {
    updateHomepageSection(sectionId, {
      selectedProductIds: [],
      productSelectionMode: 'category',
    }, true);
  };

  const selectAllStockForSection = (sectionId: string, productIds: string[]) => {
    updateHomepageSection(sectionId, {
      selectedProductIds: productIds,
      productSelectionMode: 'manual',
    }, true);
  };

  const stockProducts = useMemo(() => getInStockProducts(products), [products]);

  const handleUpdateSlide = (updatedSlide: CarouselSlide) => {
    setSlides((prev) => prev.map((s) => (s.id === updatedSlide.id ? updatedSlide : s)));
  };

  const handleAddSlide = () => {
    if (slides.length >= 5) return; // limit to 5 slots
    const newSlide: CarouselSlide = {
      id: `slide-${Date.now()}`,
      title: 'WORLD CUP CLASSIC CLEARANCE',
      subtitle: 'Save Big on Nations Jerseys',
      description: 'Save big on unique Classic 1 of 1s from nations that competed at the 2026 World Cup.',
      badge: 'LIMITED TIME CLEARANCE',
      primaryColor: 'from-[#2a0505] to-[#1a0303]',
      productId: products[0]?.id || 'shirt-1',
    };
    setSlides((prev) => {
      const next = [...prev, newSlide];
      setSelectedSlideIdx(next.length - 1);
      return next;
    });
  };

  const handleDeleteSlide = (id: string) => {
    setSlides((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setSelectedSlideIdx((prevIdx) => Math.min(prevIdx, next.length - 1));
      return next;
    });
  };

  const moveSlide = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    const newSlides = [...slides];
    const temp = newSlides[index];
    newSlides[index] = newSlides[targetIdx];
    newSlides[targetIdx] = temp;
    setSlides(newSlides);
    setSelectedSlideIdx(targetIdx);
  };

  const bulkLoadWCPresets = () => {
    const wcSlides: CarouselSlide[] = [
      {
        id: 'slide-1',
        title: 'WORLD CUP 2026 EDITION',
        subtitle: 'The Grandest Stage of Football',
        description: 'Explore the official jerseys, limited-edition jerseys, and exclusive fan collections for the upcoming FIFA World Cup 2026. Support your nation in style!',
        badge: 'WORLD CUP 2026 EXCLUSIVE',
        primaryColor: 'from-[#0b3c5d] to-[#041c2c]',
        productId: 'shirt-5',
        customImage: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1600'
      },
      {
        id: 'slide-2',
        title: 'ARGENTINA THREE STARS',
        subtitle: 'Defending Champions Match Jersey',
        description: 'Own a piece of tournament history. Premium gold heat-pressed emblems with dry-fit cooling ventilation fabric.',
        badge: 'DEFENDING CHAMPIONS',
        primaryColor: 'from-[#1e3a8a] to-[#0f172a]',
        productId: 'shirt-4',
        customImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1600'
      },
      {
        id: 'slide-3',
        title: 'BRAZIL RETRO SAMBA',
        subtitle: 'Seleção Historical Authentic Reissue',
        description: 'The golden classic of Ronaldo No.9. Rare weave texture with vintage embroidery lines direct from the Rio vaults.',
        badge: 'SAMBA LEGENDS',
        primaryColor: 'from-[#9a0400] to-[#450a0a]',
        productId: 'shirt-3',
        customImage: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&q=80&w=1600'
      },
      {
        id: 'slide-4',
        title: 'GERMANY RETRO 1990',
        subtitle: 'The Geometric Classic Jersey',
        description: 'Rep the ultimate tournament geometry. Woven details, heavy knit ribbed collars, and pristine historical authenticity.',
        badge: 'HISTORIC REISSUE',
        primaryColor: 'from-[#111827] to-[#030712]',
        productId: 'shirt-6',
        customImage: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&q=80&w=1600'
      },
      {
        id: 'slide-5',
        title: 'DHAKA HUB FAN WEAR',
        subtitle: 'Exclusive Epic Vanskap BD Capsule',
        description: 'Engineered for maximum breathable comfort under Dhaka summers. Express your sheer addiction to the beautiful game.',
        badge: 'LOCAL DHAKA RELEASES',
        primaryColor: 'from-[#e10600] to-[#450a0a]',
        productId: 'shirt-1',
        customImage: 'https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&q=80&w=1600'
      }
    ];
    setSlides(wcSlides);
    setSelectedSlideIdx(0);
  };

  // Seller request controls
  const handleSellerRequest = async (id: string, action: 'Approved' | 'Rejected') => {
    const status = action === 'Approved' ? 'APPROVED' : 'REJECTED';
    if (isApiEnabled() && getToken()) {
      try {
        await api.updateSellerRequest(id, { status });
        setSellerRequestsDb((prev) =>
          prev.map((req) => (req.id === id ? { ...req, status } : req)),
        );
        handleAddLog(`[SELLER] ${action} request ${id} in database`);
        return;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update seller request');
        return;
      }
    }
    setSellerRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, status: action } : req)),
    );
  };

  const visibleSellerRequests =
    isApiEnabled() && getToken() && sellerRequestsDb.length >= 0
      ? sellerRequestsDb.map((r) => ({
          id: r.id,
          shirtName: r.shirtName,
          brand: r.brand,
          season: r.season,
          condition: r.condition,
          expectedPrice: r.expectedPrice,
          status:
            r.status === 'APPROVED'
              ? ('Approved' as const)
              : r.status === 'REJECTED'
                ? ('Rejected' as const)
                : ('Pending' as const),
          date: '',
        }))
      : sellerRequests;

  const todayStr = '2026-07-18';

  // Order status modifier with Timeline Event Logger & Live State Updates
  const handleUpdateOrderStatus = (orderId: string, newStatus: string, customNote?: string) => {
    const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    if (isApiEnabled() && getToken()) {
      void api.updateOrderStatus(orderId, newStatus, customNote).catch((err) => {
        console.error('Failed to persist order status', err);
        alert(err instanceof Error ? err.message : 'Failed to update order status in database');
      });
    }
    setOrders((prev) => {
      const next = prev.map((o) => {
        if (o.id === orderId) {
          const newEvent = {
            id: `evt-${Date.now()}`,
            status: newStatus,
            timestamp,
            note: customNote || `Order status updated to ${newStatus}`,
            updatedBy: 'Admin Operations'
          };
          const updatedTimeline = [newEvent, ...(o.timeline || [])];
          return {
            ...o,
            status: newStatus,
            timeline: updatedTimeline
          };
        }
        return o;
      });
      if (!(isApiEnabled() && getToken())) {
        persistOrders(next);
      }
      return next;
    });
    handleAddLog(`[ORDER] Order ${orderId} status changed to "${newStatus}"`);
    if (selectedOrderForModal && selectedOrderForModal.id === orderId) {
      setSelectedOrderForModal(prev => prev ? {
        ...prev,
        status: newStatus,
        timeline: [{ id: `evt-${Date.now()}`, status: newStatus, timestamp, note: customNote || `Order status updated to ${newStatus}`, updatedBy: 'Admin Operations' }, ...(prev.timeline || [])]
      } : null);
    }
  };

  // Open Detail Operations Modal
  const handleOpenOrderModal = (order: Order) => {
    setSelectedOrderForModal(order);
    setEditingInternalNotes(order.internalNotes || '');
    setEditingCarrier(order.carrier || 'Steadfast Courier');
    setEditingTrackingNumber(order.trackingNumber || `BD-SF-${Math.floor(100000 + Math.random() * 900000)}`);
    setEditingTrackingUrl(order.trackingUrl || `https://steadfast.com.bd/tracking/${order.trackingNumber || 'BD-SF-100200'}`);
    setEditingShippedDate(order.shippedDate || todayStr);
    setEditingEstDelivery(order.estimatedDelivery || '1-3 Business Days');
  };

  // Save Order Tracking & Logistics
  const handleSaveOrderLogistics = (orderId: string) => {
    const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    if (isApiEnabled() && getToken()) {
      void api
        .updateOrderLogistics(orderId, {
          carrier: editingCarrier,
          trackingNumber: editingTrackingNumber,
          trackingUrl: editingTrackingUrl,
          shippedAt: editingShippedDate || undefined,
          internalNotes: editingInternalNotes || undefined,
          note: `Logistics updated: Carrier: ${editingCarrier}, Tracking #${editingTrackingNumber}`,
        })
        .catch((err) => {
          alert(err instanceof Error ? err.message : 'Failed to save logistics to database');
        });
    }
    setOrders((prev) => {
      const next = prev.map((o) => {
        if (o.id === orderId) {
          const newEvent = {
            id: `evt-${Date.now()}`,
            status: o.status,
            timestamp,
            note: `Logistics updated: Carrier: ${editingCarrier}, Tracking #${editingTrackingNumber}`,
            updatedBy: 'Logistics Desk'
          };
          return {
            ...o,
            carrier: editingCarrier,
            trackingNumber: editingTrackingNumber,
            trackingUrl: editingTrackingUrl,
            shippedDate: editingShippedDate,
            estimatedDelivery: editingEstDelivery,
            timeline: [newEvent, ...(o.timeline || [])]
          };
        }
        return o;
      });
      if (!(isApiEnabled() && getToken())) {
        persistOrders(next);
      }
      return next;
    });
    if (selectedOrderForModal && selectedOrderForModal.id === orderId) {
      setSelectedOrderForModal(prev => prev ? {
        ...prev,
        carrier: editingCarrier,
        trackingNumber: editingTrackingNumber,
        trackingUrl: editingTrackingUrl,
        shippedDate: editingShippedDate,
        estimatedDelivery: editingEstDelivery,
        timeline: [{ id: `evt-${Date.now()}`, status: prev.status, timestamp, note: `Logistics updated: Carrier: ${editingCarrier}, Tracking #${editingTrackingNumber}`, updatedBy: 'Logistics Desk' }, ...(prev.timeline || [])]
      } : null);
    }
    handleAddLog(`[ORDER] Updated carrier/tracking info for Order ${orderId}`);
    alert('✓ Logistics & tracking info saved!');
  };

  // Save Internal Admin Notes
  const handleSaveInternalNotes = (orderId: string) => {
    if (isApiEnabled() && getToken()) {
      void api
        .updateOrderLogistics(orderId, { internalNotes: editingInternalNotes })
        .catch((err) => {
          alert(err instanceof Error ? err.message : 'Failed to save notes to database');
        });
    }
    setOrders((prev) => {
      const next = prev.map((o) => o.id === orderId ? { ...o, internalNotes: editingInternalNotes } : o);
      if (!(isApiEnabled() && getToken())) {
        persistOrders(next);
      }
      return next;
    });
    if (selectedOrderForModal && selectedOrderForModal.id === orderId) {
      setSelectedOrderForModal(prev => prev ? { ...prev, internalNotes: editingInternalNotes } : null);
    }
    handleAddLog(`[ORDER] Updated internal notes for Order ${orderId}`);
    alert('✓ Internal admin notes saved!');
  };

  // Simulated Bulk Order Generator — offline/demo only
  const handleAddSimulatedOrders = (count: number) => {
    if (isApiEnabled() && getToken()) {
      alert('Simulated orders are disabled while connected to the live database. Create real orders from the storefront.');
      return;
    }
    const customerNames = [
      'Siyam Rahman', 'Fahim Chowdhury', 'Arifur Bari', 'Farzana Yasmin', 
      'Rashedul Bari', 'Anika Bushra', 'Sultana Haque', 'Ziaul Kabir'
    ];
    const cities = ['Dhaka', 'Chittagong', 'Sylhet', 'Rajshahi', 'Khulna'];
    const addresses = [
      'Sector 11, Uttara', 'OR Nizam Road', 'Zindabazar', 'Shaheb Bazar', 'Boyra Main Road'
    ];
    const phones = ['+880 1711-223344', '+880 1819-334455', '+880 1912-445566', '+880 1515-556677'];
    const carriers = ['Steadfast Courier', 'RedX Logistics', 'Pathao Courier', 'Paperfly', 'DHL Express'];
    const allStatuses: Order['status'][] = [
      'Pending', 'Confirmed', 'Packed', 'Ready to Ship', 
      'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refund Request'
    ];
    
    const newOrders: Order[] = [];
    
    for (let i = 0; i < count; i++) {
      const randomCustName = customerNames[Math.floor(Math.random() * customerNames.length)];
      const randomEmail = `${randomCustName.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomAddress = `${addresses[Math.floor(Math.random() * addresses.length)]}, ${randomCity}`;
      const randomPhone = phones[Math.floor(Math.random() * phones.length)];
      const status = allStatuses[i % allStatuses.length];
      const carrier = carriers[Math.floor(Math.random() * carriers.length)];
      const trackingNum = `BD-${carrier.slice(0, 2).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
      
      const randomProd = products[Math.floor(Math.random() * products.length)];
      if (!randomProd) continue;
      
      const qty = Math.floor(Math.random() * 2) + 1;
      const size = randomProd.sizes[Math.floor(Math.random() * randomProd.sizes.length)] || 'M';
      
      const orderId = `ORD-SIM-${Math.floor(100000 + Math.random() * 900000)}`;
      const subtotal = randomProd.price * qty;
      const tax = 0;
      const shipping = 70;
      const total = subtotal + shipping;
      const timestamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      
      const newOrder: Order = {
        id: orderId,
        date: todayStr,
        createdAt: todayStr,
        status,
        carrier,
        trackingNumber: trackingNum,
        trackingUrl: `https://${carrier.toLowerCase().replace(/\s+/g, '')}.com/track/${trackingNum}`,
        shippedDate: status === 'Shipped' || status === 'Delivered' ? todayStr : undefined,
        estimatedDelivery: '1-3 Business Days',
        customerNotes: 'Please deliver after 3 PM if possible. Call before arriving.',
        internalNotes: `Customer verified via phone. High value authentic order (${status}).`,
        timeline: [
          { id: `evt-${Date.now()}-2`, status: status, timestamp, note: `Order moved to ${status}`, updatedBy: 'Admin System' },
          { id: `evt-${Date.now()}-1`, status: 'Pending', timestamp: '2026-07-24 09:00', note: 'Order placed by customer via checkout', updatedBy: 'Customer' }
        ],
        items: [
          {
            product: randomProd,
            selectedSize: size,
            addBadge: true,
            customPrint: { name: 'RONALDO', number: 7 },
            quantity: qty
          }
        ],
        subtotal,
        tax,
        shipping,
        total,
        deliveryRegion: randomCity === 'Dhaka' ? 'inside' : 'outside',
        deliveryCharge: randomCity === 'Dhaka' ? 70 : 130,
        shippingAddress: {
          fullName: randomCustName,
          email: randomEmail,
          addressLine1: randomAddress,
          city: randomCity,
          postalCode: `${Math.floor(1000 + Math.random() * 8000)}`,
          country: 'Bangladesh',
          phone: randomPhone
        },
        paymentMethod: 'Cash on Delivery',
        paymentStatus: status === 'Delivered' ? 'Paid' : 'Unpaid'
      };
      
      newOrders.push(newOrder);
      
      // Dynamic Stock decrement
      setProducts((prev) => 
        prev.map((p) => p.id === randomProd.id ? { ...p, stock: Math.max(0, p.stock - qty) } : p)
      );
      
      // Register/Update Customer profile
      setCustomers((prev) => {
        const existingIdx = prev.findIndex((c) => c.email.toLowerCase() === randomEmail.toLowerCase());
        let updatedCusts = [...prev];
        if (existingIdx >= 0) {
          updatedCusts[existingIdx] = {
            ...updatedCusts[existingIdx],
            ordersCount: updatedCusts[existingIdx].ordersCount + 1,
            totalSpent: updatedCusts[existingIdx].totalSpent + total,
          };
        } else {
          updatedCusts.push({
            id: `cust-${Date.now()}-${i}`,
            fullName: randomCustName,
            email: randomEmail,
            phone: randomPhone,
            address: randomAddress,
            city: randomCity,
            location: randomCity,
            ordersCount: 1,
            totalSpent: total,
            joinedDate: todayStr
          });
        }
        localStorage.setItem('vault_saved_customers', JSON.stringify(updatedCusts));
        return updatedCusts;
      });
      
      handleAddLog(`[ORD_SIM] Automatically generated simulated sale order ${orderId} for ${randomCustName} [${status}] (${formatPrice(total)})`);
    }
    
    setOrders((prev) => {
      const next = [...newOrders, ...prev];
      persistOrders(next);
      return next;
    });
    alert(`✓ Successfully loaded ${count} simulated checkout orders covering all status pipelines!`);
  };

  // Trigger CSV Download — supports weekly / monthly / yearly / specific date
  const filterOrdersByDownloadRange = (list: Order[]) => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const parseOrderDate = (o: Order) => {
      const raw = o.createdAt || o.date || '';
      const t = Date.parse(raw);
      return Number.isFinite(t) ? t : 0;
    };
    if (orderDownloadRange === 'all') return list;
    if (orderDownloadRange === 'weekly') {
      const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      return list.filter((o) => parseOrderDate(o) >= weekAgo);
    }
    if (orderDownloadRange === 'monthly') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime();
      return list.filter((o) => parseOrderDate(o) >= monthAgo);
    }
    if (orderDownloadRange === 'yearly') {
      const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime();
      return list.filter((o) => parseOrderDate(o) >= yearAgo);
    }
    if (orderDownloadRange === 'date') {
      const target = startOfDay(new Date(orderDownloadDate));
      return list.filter((o) => {
        const t = parseOrderDate(o);
        return t >= target && t < target + 24 * 60 * 60 * 1000;
      });
    }
    return list;
  };

  const downloadOrdersCsv = (list: Order[], filename: string) => {
    const csvRows = [
      ['Report Date', todayStr],
      ['Filter', orderDownloadRange === 'date' ? `date:${orderDownloadDate}` : orderDownloadRange],
      ['Total Orders', list.length],
      [],
      ['Order ID', 'Customer', 'Phone', 'Date', 'Total Value', 'Status', 'Payment Method', 'Tracking'],
    ];
    list.forEach((o) => {
      csvRows.push([
        o.id,
        o.shippingAddress?.fullName || 'N/A',
        o.shippingAddress?.phone || '',
        o.date || o.createdAt || '',
        String(o.total),
        o.status,
        o.paymentMethod || '',
        o.trackingNumber || '',
      ]);
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportCSVReport = () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportProgress(5);

    const interval = setInterval(() => {
      setExportProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          const filtered = filterOrdersByDownloadRange(orders);
          downloadOrdersCsv(filtered, `JerseyAddictsBD_Orders_${orderDownloadRange}.csv`);
          handleAddLog('[SYSTEM] Successfully generated and exported filtered order list CSV.');
          return 100;
        }
        return p + 25;
      });
    }, 200);
  };

  const handleDownloadInvoiceForOrder = (order: Order) => {
    setInvoiceOrder(order);
    setIsInvoiceModalOpen(true);
  };

  // KPIs (live path uses adminStats inside dashboard; no fake historical pad)
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingRequestsCount = sellerRequests.filter((r) => r.status === 'Pending').length;
  const lowStockCount = products.filter((p) => p.stock <= 3).length;
  const liveDb = isApiEnabled() && !!getToken();

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [openNavGroups, setOpenNavGroups] = useState<Record<string, boolean>>({
    Command: true,
    'Stock Product': true,
    Inventory: true,
    Operations: true,
    'Catalog Meta': true,
    'Storefront CMS': true,
    Settings: true,
  });

  const SIDEBAR_GROUPS: {
    title: string;
    collapsible?: boolean;
    items: { id: string; label: string; icon: LucideIcon }[];
  }[] = [
    {
      title: 'Command',
      collapsible: false,
      items: [
        { id: 'dashboard', label: 'Overview', icon: LayoutGrid },
        { id: 'pos', label: 'POS', icon: CreditCard },
        { id: 'sales', label: 'Invoice List', icon: FileText },
        { id: 'orders', label: 'Online Orders', icon: ShoppingBag },
        { id: 'analytics', label: 'Sales Trends', icon: TrendingUp },
      ],
    },
    {
      title: 'Stock Product',
      collapsible: true,
      items: [{ id: 'product-management', label: 'Product', icon: Box }],
    },
    {
      title: 'Inventory',
      collapsible: true,
      items: [{ id: 'inventory', label: 'Inventory', icon: Box }],
    },
    {
      title: 'Operations',
      collapsible: true,
      items: [
        { id: 'customers', label: 'Customers', icon: Users },
        { id: 'expenses', label: 'Expenses', icon: DollarSign },
        { id: 'accounts', label: 'Accounts', icon: Layers },
      ],
    },
    {
      title: 'Catalog Meta',
      collapsible: true,
      items: [
        { id: 'leagues', label: 'Leagues', icon: Trophy },
        { id: 'clubs', label: 'Clubs', icon: ShieldCheck },
        { id: 'national-teams', label: 'National Teams', icon: Globe },
        { id: 'locations', label: 'Outlets', icon: MapPin },
      ],
    },
    {
      title: 'Storefront CMS',
      collapsible: true,
      items: [
        { id: 'homepage-builder', label: 'Homepage', icon: Layers },
        { id: 'page-builder', label: 'Pages', icon: FileText },
        { id: 'menu-builder', label: 'Navigation', icon: Compass },
        { id: 'mega-menu', label: 'Mega Menu', icon: Grid },
        { id: 'header-builder', label: 'Header', icon: Monitor },
        { id: 'footer-builder', label: 'Footer', icon: Layers },
        { id: 'announcement-bar', label: 'Announcement', icon: Bell },
        { id: 'banner-management', label: 'Banners', icon: Image },
        { id: 'hero-slider', label: 'Hero Slides', icon: Image },
      ],
    },
    {
      title: 'Settings',
      collapsible: true,
      items: [{ id: 'brand-customizer', label: 'Theme', icon: SlidersHorizontal }],
    },
  ];

  const activeModuleLabel =
    SIDEBAR_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeSidebarTab)?.label || 'Dashboard';

  // Prefer friendlier labels for header when multiple items share an id
  const headerModuleLabel = (() => {
    if (activeSidebarTab === 'sales') return 'Invoice List';
    if (activeSidebarTab === 'inventory') return 'Inventory';
    if (activeSidebarTab === 'product-management') return 'Product';
    return activeModuleLabel;
  })();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const staffName = staffUser?.fullName || 'Shop Admin';
  const staffId = staffUser?.email?.split('@')[0]?.toUpperCase() || 'EV-ADMIN';
  const staffRole = staffUser?.role || 'Admin';

  const REMOVED_ADMIN_TABS = new Set([
    'backup-restore',
    'collections',
    'categories',
    'brands',
    'players',
    'reviews',
    'blogs',
    'gallery',
    'videos',
    'testimonials',
    'newsletter',
    'media-library',
    'roles-permissions',
    'system-settings',
  ]);

  useEffect(() => {
    if (REMOVED_ADMIN_TABS.has(activeSidebarTab)) {
      setActiveSidebarTab('dashboard');
    }
  }, [activeSidebarTab]);

  return (
    <section className="admin-shell flex w-full min-h-screen bg-[#f5f5f5] text-zinc-950 overflow-x-hidden">
      
      {saveFeedback && (
        <div className="fixed top-4 right-4 z-[80] bg-white text-zinc-950 border border-zinc-300 text-[13px] font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <CheckCircle size={16} /> {saveFeedback}
        </div>
      )}
      {orderNotify && (
        <div className="fixed top-4 left-4 z-[80] bg-white text-zinc-950 border border-zinc-300 text-[13px] font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn max-w-[90vw]">
          <ShoppingBag size={16} /> {orderNotify}
        </div>
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          aria-label="Close menu overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left sidebar — OUDS-style icons + collapsible groups */}
      <aside
        className={`admin-sidebar w-[260px] shrink-0 bg-white border-r border-zinc-200 flex flex-col z-50
          max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:shadow-2xl max-lg:h-dvh
          transition-transform duration-300
          ${sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
          lg:translate-x-0 lg:sticky lg:top-0 lg:h-dvh lg:max-h-dvh lg:self-start
          overflow-hidden
        `}
      >
        <div className="px-4 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark imgClassName="w-8 h-8" />
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-zinc-950 leading-tight truncate">Epic Vanskap</p>
              <p className="text-[13px] text-zinc-700 truncate font-bold">Management</p>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden p-1.5 rounded-md hover:bg-zinc-100 text-zinc-800 cursor-pointer"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              placeholder="Search modules..."
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              className="w-full text-[14px] py-2 pl-9 pr-3 bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:border-zinc-950 text-zinc-950 placeholder:text-zinc-500 font-semibold"
            />
          </div>
        </div>

        <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto px-2.5 pb-4 pt-1 space-y-3">
          {SIDEBAR_GROUPS.map((group) => {
            const q = sidebarSearch.toLowerCase().trim();
            const filteredItems = group.items.filter((item) =>
              !q || item.label.toLowerCase().includes(q) || group.title.toLowerCase().includes(q),
            );
            if (filteredItems.length === 0) return null;

            const isOpen = q ? true : openNavGroups[group.title] !== false;
            const showChevron = !!group.collapsible;

            return (
              <div key={group.title} className="shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!showChevron) return;
                    setOpenNavGroups((prev) => ({ ...prev, [group.title]: !isOpen }));
                  }}
                  className={`w-full flex items-center justify-between px-3 mb-1 ${
                    showChevron ? 'cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <span className="text-[11px] font-extrabold tracking-wider text-zinc-500 uppercase">
                    {group.title}
                  </span>
                  {showChevron ? (
                    isOpen ? (
                      <ChevronUp size={14} className="text-zinc-500" />
                    ) : (
                      <ChevronDown size={14} className="text-zinc-500" />
                    )
                  ) : null}
                </button>

                {isOpen && (
                  <div className="flex flex-col gap-0.5">
                    {filteredItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSidebarTab === item.id;
                      return (
                        <button
                          key={`${group.title}-${item.id}-${item.label}`}
                          type="button"
                          onClick={() => selectAdminModule(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[14px] font-semibold transition-colors cursor-pointer leading-snug ${
                            isActive
                              ? 'bg-zinc-950 text-white shadow-sm'
                              : 'text-zinc-900 hover:bg-zinc-100'
                          }`}
                        >
                          <Icon
                            size={17}
                            strokeWidth={2.1}
                            className={`shrink-0 ${isActive ? 'text-white' : 'text-zinc-700'}`}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top header bar */}
        <header className="sticky top-0 z-30 bg-[#f5f5f5]/95 backdrop-blur border-b border-zinc-200 px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg bg-white border border-zinc-200 text-zinc-900 cursor-pointer"
                aria-label="Open menu"
              >
                <Layers size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-[12px] text-zinc-700 truncate font-semibold">
                  epic vanskap / {activeSidebarTab === 'dashboard' ? 'dashboard' : headerModuleLabel.toLowerCase()}
                </p>
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight leading-tight">
                  {activeSidebarTab === 'dashboard' ? 'Dashboard' : headerModuleLabel}
                </h1>
                {activeSidebarTab === 'dashboard' && (
                  <p className="text-[13px] text-zinc-800 mt-0.5 hidden sm:block font-medium">
                    {greeting}, {staffName.split(' ')[0]}. Here&apos;s what&apos;s happening today.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5 ml-auto">
              <div className="hidden md:flex items-center gap-4 text-[12px]">
                <div>
                  <p className="text-zinc-700 uppercase tracking-wide text-[11px] font-bold">Employee ID</p>
                  <p className="font-semibold text-zinc-950">{staffId}</p>
                </div>
                <div className="h-8 w-px bg-zinc-300" />
                <div>
                  <p className="text-zinc-700 uppercase tracking-wide text-[11px] font-bold">Employee Name</p>
                  <p className="font-semibold text-zinc-950">{staffName}</p>
                </div>
                <div className="h-8 w-px bg-zinc-300" />
                <div>
                  <p className="text-zinc-700 uppercase tracking-wide text-[11px] font-bold">Role</p>
                  <p className="font-semibold text-zinc-950">{staffRole}</p>
                </div>
              </div>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="text-[12px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 cursor-pointer"
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 w-full min-w-0 px-4 sm:px-6 lg:px-8 py-5 md:py-6">

      {/* RENDER ACTIVE TAB */}
      {activeSidebarTab === 'dashboard' && (() => {
        // Live KPIs from Neon — when API is connected, trust adminStats / live props (no seed pads)
        const liveOrdersRevenue = orders
          .filter((o) => o.status !== 'Cancelled')
          .reduce((sum, o) => sum + o.total, 0);
        const dynamicRevenue = adminStats?.revenue ?? liveOrdersRevenue;
        const dynamicExpense = adminStats?.expense ?? Math.round(dynamicRevenue * 0.42);
        const dynamicProfit = adminStats?.profit ?? dynamicRevenue - dynamicExpense;

        const pendingOrdersCount =
          adminStats?.pendingOrdersCount ??
          orders.filter((o) => o.status === 'Pending' || o.status === 'Processing').length;
        const completedOrdersCount = orders.filter((o) => o.status === 'Delivered').length;
        const cancelledOrdersCount = orders.filter((o) => o.status === 'Cancelled').length;
        const totalOrdersCount = adminStats?.orderCount ?? orders.length;

        const todayStr = new Date().toISOString().slice(0, 10);
        const todayOrders = orders.filter((o) => {
          const raw = o.createdAt || o.date || '';
          return raw.startsWith(todayStr) || (parseOrderDate(o)?.toISOString().slice(0, 10) === todayStr);
        });
        const todayOrdersCount = todayOrders.length;
        const todayOrdersRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);

        const openQueueOrders = orders.filter(
          (o) => !['Delivered', 'Cancelled', 'Returned'].includes(o.status),
        );
        const nowMs = Date.now();
        const queueAgesMin = openQueueOrders
          .map((o) => {
            const d = parseOrderDate(o);
            return d ? Math.max(0, Math.floor((nowMs - d.getTime()) / 60_000)) : null;
          })
          .filter((n): n is number => n != null);
        const avgQueueWaitMin =
          queueAgesMin.length > 0
            ? Math.round(queueAgesMin.reduce((a, b) => a + b, 0) / queueAgesMin.length)
            : 0;
        const oldestQueueOrder = openQueueOrders.reduce<(typeof openQueueOrders)[number] | null>((oldest, o) => {
          const d = parseOrderDate(o);
          const od = oldest ? parseOrderDate(oldest) : null;
          if (!d) return oldest;
          if (!od || d.getTime() < od.getTime()) return o;
          return oldest;
        }, null);
        const formatMinutes = (mins: number) => {
          if (mins < 60) return `${mins}m`;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return m ? `${h}h ${m}m` : `${h}h`;
        };

        const warehouseUnits = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
        const dynamicLowStockCount =
          adminStats?.lowStockCount ?? products.filter((p) => p.stock > 0 && p.stock <= 3).length;
        const dynamicOutOfStockCount =
          adminStats?.outOfStockCount ?? products.filter((p) => p.stock === 0).length;
        const catalogProductCount = adminStats?.productCount ?? products.length;

        // Top Selling calculations from live orders only (no fake pads)
        const pMap: { [key: string]: { name: string; sales: number; revenue: number } } = {};
        orders.forEach((o) => {
          if (o.status !== 'Cancelled') {
            o.items.forEach((it) => {
              if (it.product && it.product.id) {
                const cur = pMap[it.product.id] || {
                  name: it.product.name,
                  sales: 0,
                  revenue: 0,
                };
                cur.sales += it.quantity;
                cur.revenue += (it.product.price || 0) * it.quantity;
                pMap[it.product.id] = cur;
              }
            });
          }
        });
        const topProducts = Object.entries(pMap)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 4);

        const tMap: { [key: string]: number } = {};
        orders.forEach((o) => {
          if (o.status !== 'Cancelled') {
            o.items.forEach((it) => {
              if (it.product) {
                const t = it.product.club || it.product.country || 'Unknown';
                tMap[t] = (tMap[t] || 0) + it.quantity;
              }
            });
          }
        });
        const topTeams = Object.entries(tMap)
          .map(([name, sales]) => ({ name, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 4);

        const lMap: { [key: string]: number } = {};
        orders.forEach((o) => {
          if (o.status !== 'Cancelled') {
            o.items.forEach((it) => {
              if (it.product) {
                const l = it.product.league || it.product.category || 'Other';
                lMap[l] = (lMap[l] || 0) + it.quantity;
              }
            });
          }
        });
        const topLeagues = Object.entries(lMap)
          .map(([name, sales]) => ({ name, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 4);

        // Filter and rank customers
        const filteredCustomers = customers.filter((c) => {
          const s = customerSearch.toLowerCase();
          return c.fullName.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || c.phone.includes(s) || c.city.toLowerCase().includes(s);
        });

        let displayCustomers = [...filteredCustomers];
        if (customerFilter === 'repeated') {
          displayCustomers = displayCustomers.filter((c) => c.ordersCount >= 2);
        } else if (customerFilter === 'best') {
          displayCustomers = displayCustomers.sort((a, b) => b.totalSpent - a.totalSpent);
        }

        // Charts Monthly Data — Neon aggregates (always pad to 12 months for SVG chart)
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const rawMonthly =
          adminStats?.monthlyTrends?.map((m) => ({
            month: m.month,
            orders: m.sales,
            revenue: m.revenue,
          })) ||
          (() => {
            const map = new Map<string, { orders: number; revenue: number }>();
            orders.forEach((o) => {
              if (o.status === 'Cancelled') return;
              const key = (o.date || o.createdAt || '').slice(0, 7) || 'unknown';
              const cur = map.get(key) || { orders: 0, revenue: 0 };
              cur.orders += 1;
              cur.revenue += o.total;
              map.set(key, cur);
            });
            return [...map.entries()].map(([key, v]) => ({
              month: key.length >= 7 ? monthLabels[Number(key.slice(5, 7)) - 1] || key : key,
              orders: v.orders,
              revenue: v.revenue,
            }));
          })();

        const byMonth = new Map(rawMonthly.map((m) => [m.month, m]));
        const monthlyData = monthLabels.map((label) => {
          const hit = byMonth.get(label);
          return {
            month: label,
            orders: hit?.orders ?? 0,
            revenue: hit?.revenue ?? 0,
          };
        });

        // Real month-over-month from Neon trends (last two buckets)
        const trendSeries =
          adminStats?.monthlyTrends && adminStats.monthlyTrends.length
            ? adminStats.monthlyTrends
            : monthlyData.map((m) => ({ month: m.month, sales: m.orders, revenue: m.revenue }));
        const curTrend = trendSeries[trendSeries.length - 1] || { month: '—', sales: 0, revenue: 0 };
        const prevTrend = trendSeries[trendSeries.length - 2] || { month: '—', sales: 0, revenue: 0 };
        const momPct = (cur: number, prev: number) => {
          if (!prev) return cur > 0 ? 100 : 0;
          return Math.round(((cur - prev) / prev) * 1000) / 10;
        };
        const revMom = momPct(curTrend.revenue || 0, prevTrend.revenue || 0);
        const ordMom = momPct(curTrend.sales || 0, prevTrend.sales || 0);
        const curOrdersCount = curTrend.sales || orders.filter((o) => o.status !== 'Cancelled').length;
        const curRevenue = curTrend.revenue || dynamicRevenue;
        const avgOrderValue = curOrdersCount > 0 ? Math.round(curRevenue / curOrdersCount) : 0;
        const prevAov =
          (prevTrend.sales || 0) > 0 ? Math.round((prevTrend.revenue || 0) / (prevTrend.sales || 1)) : 0;
        const aovMom = momPct(avgOrderValue, prevAov);
        const custMom = momPct(customers.length, Math.max(0, customers.length - Math.min(customers.length, 3)));

        // Top cities from live shipping addresses
        const cityMap: { [key: string]: number } = {};
        orders.forEach((o) => {
          if (o.status === 'Cancelled') return;
          const city = o.shippingAddress?.city || 'Unknown';
          cityMap[city] = (cityMap[city] || 0) + 1;
        });
        const topCities = Object.entries(cityMap)
          .map(([name, sales]) => ({ name, sales }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 4);

        // Customer Profile select
        const handleSelectCustomer = (c: CustomerProfile) => {
          setCustFormId(c.id);
          setCustFormName(c.fullName);
          setCustFormEmail(c.email);
          setCustFormPhone(c.phone);
          setCustFormAddress(c.address);
          setCustFormCity(c.city || 'Dhaka');
          setCustFormNotes(c.notes || '');
          setCustFormOrders(c.ordersCount);
          setCustFormSpent(c.totalSpent);
          handleAddLog(`[CRM] Loaded profile for ${c.fullName} into editor form.`);
        };

        // Save Customer Profile Form
        const handleSaveCustomerProfile = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!custFormName || !custFormEmail || !custFormPhone) {
            alert('Required inputs: Full Name, Email, and Phone number are missing.');
            return;
          }

          try {
            if (isApiEnabled() && getToken()) {
              if (custFormId) {
                const updated = await api.updateUser(custFormId, {
                  fullName: custFormName,
                  phone: custFormPhone,
                  location: custFormCity,
                });
                setCustomers((prev) =>
                  prev.map((c) => (c.id === custFormId ? { ...c, ...updated } : c)),
                );
                handleAddLog(`[CUSTOMER] Updated DB profile for ${custFormName}`);
              } else {
                const created = await api.createUser({
                  email: custFormEmail,
                  fullName: custFormName,
                  phone: custFormPhone,
                  location: custFormCity,
                  role: 'Customer',
                  password: `Temp${Math.random().toString(36).slice(2, 10)}!`,
                });
                setCustomers((prev) => [created as CustomerProfile, ...prev]);
                handleAddLog(`[CUSTOMER] Created DB profile for ${custFormName}`);
              }
            } else {
              setCustomers((prev) => {
                let next;
                const existingIdx = prev.findIndex(
                  (c) =>
                    c.email.toLowerCase() === custFormEmail.toLowerCase() ||
                    (custFormId && c.id === custFormId),
                );
                if (existingIdx >= 0) {
                  next = [...prev];
                  next[existingIdx] = {
                    ...next[existingIdx],
                    fullName: custFormName,
                    phone: custFormPhone,
                    address: custFormAddress,
                    city: custFormCity,
                    location: custFormCity,
                    notes: custFormNotes,
                    ordersCount: Number(custFormOrders),
                    totalSpent: Number(custFormSpent),
                  };
                } else {
                  next = [
                    {
                      id: `cust-${Date.now()}`,
                      fullName: custFormName,
                      email: custFormEmail,
                      phone: custFormPhone,
                      address: custFormAddress,
                      city: custFormCity,
                      location: custFormCity,
                      notes: custFormNotes,
                      ordersCount: Number(custFormOrders),
                      totalSpent: Number(custFormSpent),
                      joinedDate: todayStr,
                    },
                    ...prev,
                  ];
                }
                localStorage.setItem('vault_saved_customers', JSON.stringify(next));
                return next;
              });
            }
          } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save customer');
            return;
          }

          setCustFormId('');
          setCustFormName('');
          setCustFormEmail('');
          setCustFormPhone('');
          setCustFormAddress('');
          setCustFormCity('Dhaka');
          setCustFormNotes('');
          setCustFormOrders(1);
          setCustFormSpent(150);
          alert('Customer profile saved successfully!');
        };

        // Trigger CSV Download simulation
        const handleExportCSVReport = () => {
          if (isExporting) return;
          setIsExporting(true);
          setExportProgress(5);
          
          const interval = setInterval(() => {
            setExportProgress((p) => {
              if (p >= 100) {
                clearInterval(interval);
                setIsExporting(false);
                
                // Trigger real file download simulation with sales data!
                const csvRows = [
                  ['Report Date', '2026-07-18'],
                  ['Total Sourced Revenue (৳)', dynamicRevenue],
                  ['Projected Profit (৳)', dynamicProfit],
                  ['Projected Expense (৳)', dynamicExpense],
                  ['Total Active Orders', orders.length],
                  [],
                  ['Order ID', 'Customer', 'Date', 'Total Value', 'Status', 'Payment Method']
                ];
                
                orders.forEach(o => {
                  csvRows.push([o.id, o.shippingAddress.fullName, o.date, o.total, o.status, o.paymentMethod]);
                });
                
                const csvContent = "data:text/csv;charset=utf-8," 
                  + csvRows.map(e => e.join(",")).join("\n");
                
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "JerseyAddictsBD_Sales_Report.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                handleAddLog('[SYSTEM] Successfully generated and exported full CSV database audit register.');
                return 100;
              }
              return p + 25;
            });
          }, 350);
        };

        // Reset Simulated sales database
        const handleResetDatabase = async () => {
          if (liveDb) {
            toast('Cannot reset while connected to Neon. Clear demo data only works in offline mode.', 'error');
            return;
          }
          const ok = await confirmAsync({
            title: 'Reset demo database',
            message:
              'Are you sure you want to clear the simulated database history? This resets orders, customer entries, and activities back to defaults.',
            danger: true,
            confirmText: 'Reset data',
          });
          if (!ok) return;
          setOrders([]);
          localStorage.removeItem('vault_orders');
          localStorage.removeItem('vault_saved_customers');
          localStorage.removeItem('vault_admin_logs');
          setCustomers([
            { id: 'cust-1', fullName: 'Yasin Ahmed', email: 'yasinahmed000997@gmail.com', phone: '+880 1840-990700', address: 'Bailey Road', city: 'Dhaka', location: 'Dhaka', notes: 'Premium collector. Prefers XL Adidas kits.', ordersCount: 3, totalSpent: 980, joinedDate: '2026-03-12' },
            { id: 'cust-2', fullName: 'Taskin Kabir', email: 'taskin.kabir@dhakafc.com', phone: '+880 1711-223344', address: 'Gulshan 2', city: 'Dhaka', location: 'Dhaka', notes: 'Interested in World Cup 1998 releases.', ordersCount: 2, totalSpent: 538, joinedDate: '2026-04-05' },
            { id: 'cust-3', fullName: 'Nafis Imtiaz', email: 'nafis.imtiaz@gmail.com', phone: '+880 1912-345678', address: 'Agrabad', city: 'Chittagong', location: 'Chittagong', notes: 'Vintage retro lover. Loves Maradona tribute kits.', ordersCount: 1, totalSpent: 349, joinedDate: '2026-05-18' }
          ]);
          setLogs([
            '[2026-07-18 14:02] ADMIN: Reset database back to default historical logs.',
            '[2026-07-18 13:45] STOCK: Sourced inventory check completed.'
          ]);
          toast('Admin simulation database has been successfully reset!', 'success');
        };

        return (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Summary cards — Ouds-style */}
            {(() => {
              const stockValueAtCost = products.reduce(
                (sum, p) => sum + (Number(p.price) || 0) * 0.42 * (Number(p.stock) || 0),
                0,
              );
              const lastMonthLabel = prevTrend.month && prevTrend.month !== '—' ? prevTrend.month : 'Prior month';
              const lastMonthRevenue = prevTrend.revenue || 0;
              const lastMonthOrders = prevTrend.sales || 0;
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">Today&apos;s sales</p>
                      <p className="text-2xl font-bold text-zinc-950 mt-1 tracking-tight">
                        {formatPrice(todayOrdersRevenue)}
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        {todayOrdersCount} invoice{todayOrdersCount === 1 ? '' : 's'}
                        {openQueueOrders.length
                          ? ` · avg wait ${formatMinutes(avgQueueWaitMin)}`
                          : ''}
                      </p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">Last month sales</p>
                      <p className="text-2xl font-bold text-zinc-950 mt-1 tracking-tight">
                        {formatPrice(lastMonthRevenue)}
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        {lastMonthOrders} invoice{lastMonthOrders === 1 ? '' : 's'}
                        {lastMonthLabel !== 'Prior month' ? ` · ${lastMonthLabel}` : ''}
                      </p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">Stock value</p>
                      <p className="text-2xl font-bold text-zinc-950 mt-1 tracking-tight">
                        {formatPrice(stockValueAtCost)}
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        At cost · {warehouseUnits} units · {catalogProductCount} SKUs
                      </p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">Open queue</p>
                      <p className="text-2xl font-bold text-zinc-950 mt-1 tracking-tight">
                        {pendingOrdersCount}
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        Pending / processing
                        {oldestQueueOrder
                          ? ` · oldest ${formatOrderWait(oldestQueueOrder, nowMs)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">All-time revenue</p>
                      <p className="text-xl font-bold text-zinc-950 mt-1">{formatPrice(dynamicRevenue)}</p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        Profit {formatPrice(dynamicProfit)} · Cost {formatPrice(dynamicExpense)}
                      </p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">Orders</p>
                      <p className="text-xl font-bold text-zinc-950 mt-1">{totalOrdersCount}</p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        {completedOrdersCount} delivered · {cancelledOrdersCount} cancelled
                      </p>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-xl p-5">
                      <p className="text-[13px] text-zinc-600">Stock alerts</p>
                      <p className="text-xl font-bold text-zinc-950 mt-1">
                        {dynamicLowStockCount + dynamicOutOfStockCount}
                      </p>
                      <p className="text-[12px] text-zinc-500 mt-1">
                        {dynamicLowStockCount} low · {dynamicOutOfStockCount} out of stock
                      </p>
                    </div>
                  </div>

                  {/* Trending products */}
                  <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-zinc-950">Trending products</h3>
                      <button
                        type="button"
                        onClick={() => selectAdminModule('product-management')}
                        className="text-[12px] font-medium text-zinc-600 hover:text-zinc-950 cursor-pointer"
                      >
                        View catalog
                      </button>
                    </div>
                    {topProducts.length === 0 ? (
                      <p className="px-5 py-8 text-[13px] text-zinc-500">No sales yet.</p>
                    ) : (
                      <ul className="divide-y divide-zinc-100">
                        {topProducts.map((p, i) => (
                          <li key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                            <span className="text-[12px] font-semibold text-zinc-400 w-5">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-zinc-950 truncate">{p.name}</p>
                              <p className="text-[12px] text-zinc-500">{p.sales} sold</p>
                            </div>
                            <p className="text-[13px] font-semibold text-zinc-950 tabular-nums">
                              {formatPrice(p.revenue)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Quick actions */}
            <div className="bg-white border border-zinc-200 rounded-xl p-4 md:p-5">
              <h3 className="text-[15px] font-semibold text-zinc-950 mb-3">Quick actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {!liveDb && (
                  <>
                    <button
                      onClick={() => handleAddSimulatedOrders(1)}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-700 px-4 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group hover:scale-[1.02]"
                    >
                      <PlusCircle size={14} className="group-hover:scale-110 transition-transform" />
                      +1 Simulated Sale
                    </button>
                    <button
                      onClick={() => handleAddSimulatedOrders(5)}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-700 px-4 py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group hover:scale-[1.02]"
                    >
                      <Sparkles size={14} className="group-hover:scale-110 transition-transform text-amber-200" />
                      Generate Bulk Sales (+5)
                    </button>
                  </>
                )}
                {liveDb && (
                  <div className="bg-white border border-emerald-200 px-4 py-3 rounded-xl text-[11px] font-mono text-emerald-800 col-span-1 sm:col-span-2 flex items-center gap-2">
                    <BadgeCheck size={14} className="text-emerald-700 flex-shrink-0" />
                    Live Neon ledger — simulated sales disabled. Place real orders from the storefront.
                  </div>
                )}
                <button
                  onClick={handleRestockLowItems}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Shirt size={14} className="text-emerald-800" />
                  Restock Low Stock (12 Qty)
                </button>
                <button
                  onClick={handleExportCSVReport}
                  disabled={isExporting}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-200 px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Auditing {exportProgress}%
                    </>
                  ) : (
                    <>
                      <Download size={14} className="text-emerald-800" />
                      Export Sales Report (CSV)
                    </>
                  )}
                </button>
              </div>
              
              {isExporting && (
                <div className="w-full bg-emerald-100/40 rounded-full h-1 mt-4 overflow-hidden">
                  <div className="bg-emerald-800 h-full transition-all duration-350" style={{ width: `${exportProgress}%` }} />
                </div>
              )}
            </div>

            {/* Sales performance */}
            <div className="bg-white border border-zinc-200 rounded-xl p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-zinc-950">Sales performance</h3>
                  <p className="text-[12px] text-zinc-500 mt-0.5">Monthly revenue and order volume</p>
                </div>
                
                <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                  <button
                    onClick={() => setChartMetric('revenue')}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer ${chartMetric === 'revenue' ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-700 hover:text-zinc-950'}`}
                  >
                    Revenue
                  </button>
                  <button
                    onClick={() => setChartMetric('sales')}
                    className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all cursor-pointer ${chartMetric === 'sales' ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-700 hover:text-zinc-950'}`}
                  >
                    Volume
                  </button>
                </div>
              </div>

              {chartMetric === 'revenue' ? (
                <div>
                  <div className="mb-3 flex justify-between items-center text-[10px] font-mono text-emerald-800">
                    <span>July Sourced Revenue Progress (৳ Taka):</span>
                    <span className="font-extrabold text-emerald-950 text-xs">Baseline + Real Time Tracker</span>
                  </div>
                  
                  {/* SVG Line Graph with Area fill */}
                  <div className="h-64 w-full bg-emerald-50/20 rounded-2xl border border-emerald-50 relative p-4 flex flex-col justify-between">
                    <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-40">
                      <div className="border-b border-emerald-100 w-full h-0 text-[8px] font-mono text-emerald-600">৳2,00,000</div>
                      <div className="border-b border-emerald-100 w-full h-0 text-[8px] font-mono text-emerald-600">৳1,50,000</div>
                      <div className="border-b border-emerald-100 w-full h-0 text-[8px] font-mono text-emerald-600">৳1,00,000</div>
                      <div className="border-b border-emerald-100 w-full h-0 text-[8px] font-mono text-emerald-600">৳50,000</div>
                    </div>
                    
                    {/* SVG Curve Area chart */}
                    <div className="relative w-full h-48 mt-4">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 1200 300" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#18181b" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#18181b" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Area Polygon */}
                        <polygon
                          points={`
                            0,300 
                            100,${300 - (monthlyData[0].revenue / 200000) * 300} 
                            200,${300 - (monthlyData[1].revenue / 200000) * 300} 
                            300,${300 - (monthlyData[2].revenue / 200000) * 300} 
                            400,${300 - (monthlyData[3].revenue / 200000) * 300} 
                            500,${300 - (monthlyData[4].revenue / 200000) * 300} 
                            600,${300 - (monthlyData[5].revenue / 200000) * 300} 
                            700,${300 - (Math.min(200000, monthlyData[6].revenue) / 200000) * 300} 
                            800,${300 - (monthlyData[7].revenue / 200000) * 300} 
                            900,${300 - (monthlyData[8].revenue / 200000) * 300} 
                            1000,${300 - (monthlyData[9].revenue / 200000) * 300} 
                            1100,${300 - (monthlyData[10].revenue / 200000) * 300} 
                            1200,${300 - (monthlyData[11].revenue / 200000) * 300} 
                            1200,300`}
                          fill="url(#revenueGrad)"
                        />
                        {/* Smooth Line */}
                        <polyline
                          fill="none"
                          stroke="#18181b"
                          strokeWidth="3"
                          points={`
                            100,${300 - (monthlyData[0].revenue / 200000) * 300} 
                            200,${300 - (monthlyData[1].revenue / 200000) * 300} 
                            300,${300 - (monthlyData[2].revenue / 200000) * 300} 
                            400,${300 - (monthlyData[3].revenue / 200000) * 300} 
                            500,${300 - (monthlyData[4].revenue / 200000) * 300} 
                            600,${300 - (monthlyData[5].revenue / 200000) * 300} 
                            700,${300 - (Math.min(200000, monthlyData[6].revenue) / 200000) * 300} 
                            800,${300 - (monthlyData[7].revenue / 200000) * 300} 
                            900,${300 - (monthlyData[8].revenue / 200000) * 300} 
                            1000,${300 - (monthlyData[9].revenue / 200000) * 300} 
                            1100,${300 - (monthlyData[10].revenue / 200000) * 300} 
                            1200,${300 - (monthlyData[11].revenue / 200000) * 300}`}
                        />
                        {/* Markers */}
                        <circle cx="700" cy={300 - (Math.min(200000, monthlyData[6].revenue) / 200000) * 300} r="6" fill="#18181b" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                      {/* Interactive indicator for active month */}
                      <div className="absolute top-2 left-[58%] -translate-x-1/2 bg-emerald-950 text-white rounded-lg p-2.5 shadow-lg border border-emerald-800 text-[10px] font-mono pointer-events-none">
                        <span className="block font-bold text-emerald-400">JULY 2026 (CUR)</span>
                        <span className="block text-xs font-black">৳{monthlyData[6].revenue.toLocaleString()} Taka</span>
                        <span className="text-[9px] text-emerald-300">({curTrend.sales || 0} orders · {curTrend.month})</span>
                      </div>
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-emerald-850 px-2 mt-4 pt-1 border-t border-emerald-100">
                      {monthlyData.map((d, i) => (
                        <span key={i} className={d.month === 'Jul' ? 'font-black text-emerald-950 underline' : ''}>{d.month}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex justify-between items-center text-[10px] font-mono text-emerald-850">
                    <span>Sourced Orders Handled Per Month:</span>
                    <span className="font-extrabold text-emerald-950">Vitals Volume Tracker</span>
                  </div>

                  {/* SVG Bar Chart */}
                  <div className="h-64 w-full bg-emerald-50/20 rounded-2xl border border-emerald-50 p-4 flex flex-col justify-between">
                    <div className="h-44 flex items-end justify-between gap-2.5 md:gap-5 pt-6 relative">
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                        <div className="border-b border-emerald-100 w-full" />
                        <div className="border-b border-emerald-100 w-full" />
                        <div className="border-b border-emerald-100 w-full" />
                        <div className="border-b border-emerald-100 w-full" />
                      </div>

                      {monthlyData.map((item, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer h-full justify-end">
                          <div className="absolute -top-6 bg-emerald-950 text-white px-1.5 py-0.5 rounded text-[8px] font-mono opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                            {item.orders} sales
                          </div>
                          <div
                            className={`w-full hover:bg-emerald-850 rounded-t-md transition-all duration-350 shadow ${item.month === 'Jul' ? 'bg-emerald-800' : 'bg-emerald-600/40'}`}
                            style={{ height: `${(item.orders / 65) * 100}%` }}
                          />
                          <span className={`text-[8px] font-mono mt-1 ${item.month === 'Jul' ? 'font-black text-emerald-950' : 'text-emerald-700'}`}>{item.month}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="text-[9px] font-mono text-emerald-700 text-center mt-2">
                      Bar heights are scaled relative to standard monthly volume capacity (max 65 orders limit).
                    </div>
                  </div>
                </div>
              )}

              {/* MONTHLY COMPARISON STUDY */}
              <div className="mt-8 pt-6 border-t border-emerald-100">
                <h4 className="text-xs font-black uppercase text-emerald-950 mb-3 font-mono flex items-center gap-1.5">
                  <RefreshCw size={12} className="text-emerald-700" />
                  Monthly Comparison Ledger ({curTrend.month} vs {prevTrend.month})
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50 flex flex-col justify-between">
                    <span className="text-[9px] text-emerald-700 font-mono block">REVENUE ({curTrend.month})</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-black text-emerald-950">{formatPrice(curRevenue)}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-800 block mt-1 flex items-center gap-1">
                      {revMom >= 0 ? <ArrowUpRight size={10} className="text-emerald-700" /> : <ArrowDownRight size={10} className="text-rose-600" />}
                      {revMom >= 0 ? '▲' : '▼'} {Math.abs(revMom)}% vs {prevTrend.month}
                    </span>
                  </div>

                  <div className="bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50 flex flex-col justify-between">
                    <span className="text-[9px] text-emerald-700 font-mono block">ORDERS PROCESSED</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-black text-emerald-950">{curOrdersCount} orders</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-800 block mt-1 flex items-center gap-1">
                      {ordMom >= 0 ? <ArrowUpRight size={10} className="text-emerald-700" /> : <ArrowDownRight size={10} className="text-rose-600" />}
                      {ordMom >= 0 ? '▲' : '▼'} {Math.abs(ordMom)}% vs {prevTrend.month}
                    </span>
                  </div>

                  <div className="bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50 flex flex-col justify-between">
                    <span className="text-[9px] text-emerald-700 font-mono block">AVERAGE ORDER VALUE</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-black text-emerald-950">{formatPrice(avgOrderValue)}</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-800 block mt-1 flex items-center gap-1">
                      {aovMom >= 0 ? <ArrowUpRight size={10} className="text-emerald-700" /> : <ArrowDownRight size={10} className="text-rose-600" />}
                      {aovMom >= 0 ? '▲' : '▼'} {Math.abs(aovMom)}% vs {prevTrend.month}
                    </span>
                  </div>

                  <div className="bg-emerald-50/30 p-3.5 rounded-xl border border-emerald-100/50 flex flex-col justify-between">
                    <span className="text-[9px] text-emerald-700 font-mono block">CUSTOMERS IN CRM</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-base font-black text-emerald-950">{customers.length} Collectors</span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-800 block mt-1 flex items-center gap-1">
                      <Users size={10} className="text-emerald-700" />
                      From Neon user directory
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* LEADERBOARDS & RANKINGS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* TOP SELLING PRODUCTS */}
              <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-emerald-950 font-mono flex items-center gap-2 mb-3">
                    <Shirt size={13} className="text-emerald-800" />
                    Top Selling Products
                  </h3>
                  <div className="space-y-3">
                    {topProducts.length === 0 && (
                      <p className="text-[11px] text-emerald-700 font-mono">No paid orders yet — leaderboard fills from live Neon sales.</p>
                    )}
                    {topProducts.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-emerald-50/60 pb-2">
                        <div className="min-w-0 pr-3">
                          <span className="font-mono text-[10px] text-emerald-700 font-bold block">#0{idx+1} RANKING</span>
                          <span className="font-bold text-emerald-950 truncate block">{p.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono font-black text-emerald-850 block">{p.sales} sales</span>
                          <span className="text-[10px] text-emerald-700 font-mono block">{formatPrice(p.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TOP SELLING TEAMS */}
              <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-emerald-950 font-mono flex items-center gap-2 mb-3">
                    <Users size={13} className="text-emerald-800" />
                    Top Shipping Cities
                  </h3>
                  <div className="space-y-3">
                    {(topCities.length ? topCities : topTeams).length === 0 && (
                      <p className="text-[11px] text-emerald-700 font-mono">No city data yet from live orders.</p>
                    )}
                    {(topCities.length ? topCities : topTeams).map((t, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-emerald-50/60 pb-2">
                        <div className="min-w-0 pr-3">
                          <span className="font-mono text-[10px] text-emerald-700 font-bold block">#0{idx+1} CITY</span>
                          <span className="font-bold text-emerald-950 truncate block">{t.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono font-black text-emerald-850 block">{t.sales} orders</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TOP SELLING LEAGUES */}
              <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-emerald-950 font-mono flex items-center gap-2 mb-3">
                    <AreaChart size={13} className="text-emerald-800" />
                    Top Selling Leagues / Formats
                  </h3>
                  <div className="space-y-3">
                    {topLeagues.map((l, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-emerald-50/60 pb-2">
                        <div className="min-w-0 pr-3">
                          <span className="font-mono text-[10px] text-emerald-700 font-bold block">#0{idx+1} CLASSIFICATION</span>
                          <span className="font-bold text-emerald-950 truncate block">{l.name}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono font-black text-emerald-850 block">{l.sales} units</span>
                          <span className="text-[10px] text-emerald-700 font-mono block">DEMAND PEAK</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* CUSTOMER COMMAND DESK (CUSTOMER DIRECTORY + PROFILE SAVE FORM) */}
            <div className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-sm">
              <div className="border-b border-emerald-50 pb-4 mb-6">
                <h3 className="text-sm font-black uppercase text-emerald-950 flex items-center gap-2">
                  <UserCheck size={16} className="text-emerald-800" />
                  Epic Vanskap BD Customer Directory & CRM Room
                </h3>
                <p className="text-[10px] text-emerald-700 font-mono">Manage persistent customer portfolios and save collectors profiles</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT SIDE: CUSTOMER SEARCH & LISTS (8 Columns) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search bar */}
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-emerald-600 pointer-events-none">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        placeholder="Search by name, email, phone or city..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full bg-emerald-50/30 border border-emerald-100 hover:border-emerald-200 rounded-xl py-2 pl-10 pr-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 focus:bg-white"
                      />
                    </div>
                    {/* CRM Filters */}
                    <div className="flex bg-emerald-50 p-1 rounded-xl border border-emerald-100 shrink-0">
                      <button
                        onClick={() => setCustomerFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${customerFilter === 'all' ? 'bg-emerald-800 text-white' : 'text-emerald-800 hover:text-emerald-900'}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setCustomerFilter('repeated')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${customerFilter === 'repeated' ? 'bg-emerald-800 text-white' : 'text-emerald-800 hover:text-emerald-900'}`}
                        title="Customers who made 2 or more orders"
                      >
                        Repeated Customer List (2+)
                      </button>
                      <button
                        onClick={() => setCustomerFilter('best')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${customerFilter === 'best' ? 'bg-emerald-800 text-white' : 'text-emerald-800 hover:text-emerald-900'}`}
                        title="Customers ranked by highest spending volume"
                      >
                        Best Customers
                      </button>
                    </div>
                  </div>

                  {/* Customer directory table container */}
                  <div className="border border-emerald-100 rounded-xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-emerald-50/50 border-b border-emerald-100 text-[10px] font-mono text-emerald-800 uppercase">
                          <th className="py-2.5 px-4">Collector Profile</th>
                          <th className="py-2.5 px-4">Contact</th>
                          <th className="py-2.5 px-4 text-center">Orders</th>
                          <th className="py-2.5 px-4 text-right">Total Spent</th>
                          <th className="py-2.5 px-4 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50 bg-white">
                        {displayCustomers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-[10px] font-mono text-emerald-700">
                              No matching collectors found in Dhaka ledger.
                            </td>
                          </tr>
                        ) : (
                          displayCustomers.map((c) => (
                            <tr key={c.id} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-extrabold text-emerald-950 flex items-center gap-1">
                                  {c.fullName}
                                  {c.ordersCount >= 2 && (
                                    <span className="bg-emerald-100 text-emerald-850 font-mono text-[8px] px-1.5 py-0.5 rounded uppercase font-bold" title="Repeated Customer">
                                      Repeated
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] text-emerald-700 font-mono block">{c.city} • Joined {c.joinedDate}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[10px] text-emerald-850">
                                <span className="block">{c.email}</span>
                                <span className="text-emerald-700 text-[9px] block">{c.phone}</span>
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-emerald-950 font-mono">
                                {c.ordersCount}
                              </td>
                              <td className="py-3 px-4 text-right font-black text-emerald-900 font-mono">
                                {formatPrice(c.totalSpent)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleSelectCustomer(c)}
                                  className="bg-emerald-50 hover:bg-emerald-800 hover:text-white border border-emerald-200 text-emerald-800 text-[9px] font-mono uppercase px-2.5 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Edit size={10} />
                                  Edit
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* RIGHT SIDE: CUSTOMER SAVE / UPDATE FORM (5 Columns) */}
                <div className="lg:col-span-5 bg-emerald-50/30 border border-emerald-100 rounded-2xl p-5">
                  <div className="border-b border-emerald-100 pb-3 mb-4">
                    <h4 className="text-xs font-black uppercase text-emerald-950 font-mono flex items-center gap-1.5">
                      <Save size={13} className="text-emerald-800" />
                      {custFormId ? 'Modify Collector Profile' : 'Save Customer Information'}
                    </h4>
                    <p className="text-[9px] text-emerald-700 font-mono">Input fields below will compile straight to secure persistent directory storage.</p>
                  </div>

                  <form onSubmit={handleSaveCustomerProfile} className="space-y-3 text-xs">
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-emerald-700 uppercase font-bold block">FULL NAME *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Siyam Ahmed"
                        value={custFormName}
                        onChange={(e) => setCustFormName(e.target.value)}
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-emerald-700 uppercase font-bold block">EMAIL ADDRESS *</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. siyam@gmail.com"
                        value={custFormEmail}
                        onChange={(e) => setCustFormEmail(e.target.value)}
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-emerald-700 uppercase font-bold block">PHONE NUMBER *</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. +880 1712..."
                          value={custFormPhone}
                          onChange={(e) => setCustFormPhone(e.target.value)}
                          className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-emerald-700 uppercase font-bold block">LOCATION/CITY</label>
                        <select
                          value={custFormCity}
                          onChange={(e) => setCustFormCity(e.target.value)}
                          className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                        >
                          <option value="Dhaka">Dhaka</option>
                          <option value="Chittagong">Chittagong</option>
                          <option value="Sylhet">Sylhet</option>
                          <option value="Rajshahi">Rajshahi</option>
                          <option value="Khulna">Khulna</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-emerald-700 uppercase block">SHIPPING ADDRESS LINE</label>
                      <input
                        type="text"
                        placeholder="Road 4, Dhanmondi"
                        value={custFormAddress}
                        onChange={(e) => setCustFormAddress(e.target.value)}
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-emerald-700 uppercase block">SIMULATED ORDERS COUNT</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="1"
                          value={custFormOrders}
                          onChange={(e) => setCustFormOrders(Number(e.target.value))}
                          className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-emerald-700 uppercase block">TOTAL SPENT VALUE (৳)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="3500"
                          value={custFormSpent}
                          onChange={(e) => setCustFormSpent(Number(e.target.value))}
                          className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-mono text-emerald-700 uppercase block">MEMO / COLLECTORS PREFERENCE NOTES</label>
                      <textarea
                        rows={2}
                        placeholder="Prefers classic 90s vintage. Prefers XL sizes."
                        value={custFormNotes}
                        onChange={(e) => setCustFormNotes(e.target.value)}
                        className="w-full bg-white border border-emerald-100 rounded-xl p-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        type="submit"
                        className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-wider py-3 rounded-xl transition-all cursor-pointer shadow-sm text-center"
                      >
                        {custFormId ? '✓ Update Profile' : '✓ Save Profile'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustFormId('');
                          setCustFormName('');
                          setCustFormEmail('');
                          setCustFormPhone('');
                          setCustFormAddress('');
                          setCustFormCity('Dhaka');
                          setCustFormNotes('');
                          setCustFormOrders(1);
                          setCustFormSpent(150);
                        }}
                        className="bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 text-xs font-bold py-3 rounded-xl transition-all cursor-pointer"
                      >
                        Clear Form
                      </button>
                    </div>

                  </form>
                </div>

              </div>
            </div>

            {/* DYNAMIC ACTIVE ORDERS OPERATIONAL COMMAND DESK */}
            <div className="bg-white border border-emerald-100 rounded-3xl p-6 shadow-sm space-y-6">
              {/* Desk Top Bar */}
              <div className="border-b border-emerald-50 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase text-emerald-950 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-emerald-800" />
                    Bangladesh Orders Lifecycle & Management Hub
                  </h3>
                  <p className="text-[10px] text-emerald-700 font-mono font-bold">
                    Full-pipeline order processing: Invoices, Shipping Addresses, Logistics Tracking, Timelines, Status updates, and Internal Notes.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {!liveDb && (
                    <button
                      type="button"
                      onClick={() => handleAddSimulatedOrders(9)}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Generate Sample Orders (All 9 Statuses)</span>
                    </button>
                  )}
                  {liveDb && (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                      Showing live Neon orders ({orders.length})
                    </span>
                  )}
                </div>
              </div>

              {/* Status Filter Tabs (9 Statuses + All) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                  <span className="uppercase tracking-wider font-mono text-[10px]">Filter Order Status Pipeline:</span>
                  <span className="text-[10px] font-mono text-emerald-700">Showing {orders.filter((o) => (orderFilterStatus === 'All' || o.status === orderFilterStatus) && (!orderSearchQuery || o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) || (o.shippingAddress?.fullName || '').toLowerCase().includes(orderSearchQuery.toLowerCase()) || (o.shippingAddress?.phone || '').includes(orderSearchQuery))).length} of {orders.length} Total Orders</span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                  {[
                    'All', 'Pending', 'Confirmed', 'Packed', 
                    'Ready to Ship', 'Shipped', 'Delivered', 
                    'Cancelled', 'Returned', 'Refund Request'
                  ].map((status) => {
                    const count = status === 'All' 
                      ? orders.length 
                      : orders.filter((o) => o.status === status).length;
                    const isActive = orderFilterStatus === status;

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setOrderFilterStatus(status)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                          isActive
                            ? 'bg-emerald-950 text-white border-emerald-950 shadow-sm'
                            : 'bg-emerald-50/50 hover:bg-emerald-100/80 text-emerald-900 border-emerald-100'
                        }`}
                      >
                        <span>{status}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-mono font-black rounded-full ${
                          isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-200/60 text-emerald-900'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search & Quick Controls Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100">
                <div className="relative w-full sm:w-80">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700" />
                  <input
                    type="text"
                    placeholder="Search ID, customer, phone, tracking..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-medium"
                  />
                  {orderSearchQuery && (
                    <button 
                      type="button" 
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-950 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="text-[10px] font-mono text-emerald-800 flex items-center gap-3">
                  <span>💡 Tip: Click <b>Manage Order</b> to view full address, timeline, tracking details & internal admin notes</span>
                </div>
              </div>

              {/* Order Management Table */}
              <div className="border border-emerald-100 rounded-2xl overflow-hidden overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-950 text-white text-[10px] font-mono uppercase tracking-wider">
                      <th className="py-3 px-4">Order ID & Date</th>
                      <th className="py-3 px-4">Wait / Time</th>
                      <th className="py-3 px-4">Customer & Address</th>
                      <th className="py-3 px-4">Purchased Items</th>
                      <th className="py-3 px-4">Tracking & Carrier</th>
                      <th className="py-3 px-4 text-center">Pipeline Status</th>
                      <th className="py-3 px-4 text-right">Invoice Sum</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50 bg-white">
                    {orders.filter((o) => {
                      const matchesStatus = orderFilterStatus === 'All' || o.status === orderFilterStatus;
                      const q = orderSearchQuery.toLowerCase().trim();
                      const matchesSearch = !q || 
                        o.id.toLowerCase().includes(q) ||
                        (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
                        (o.shippingAddress?.phone || '').toLowerCase().includes(q) ||
                        (o.shippingAddress?.email || '').toLowerCase().includes(q) ||
                        (o.trackingNumber || '').toLowerCase().includes(q) ||
                        o.items?.some(i => (i.product?.name || '').toLowerCase().includes(q));
                      return matchesStatus && matchesSearch;
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-xs font-mono text-emerald-700 bg-emerald-50/20">
                          No orders matched current filter query "{orderFilterStatus}". Click "Generate Sample Orders" to load test data!
                        </td>
                      </tr>
                    ) : (
                      orders
                        .filter((o) => {
                          const matchesStatus = orderFilterStatus === 'All' || o.status === orderFilterStatus;
                          const q = orderSearchQuery.toLowerCase().trim();
                          const matchesSearch = !q || 
                            o.id.toLowerCase().includes(q) ||
                            (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
                            (o.shippingAddress?.phone || '').toLowerCase().includes(q) ||
                            (o.shippingAddress?.email || '').toLowerCase().includes(q) ||
                            (o.trackingNumber || '').toLowerCase().includes(q) ||
                            o.items?.some(i => (i.product?.name || '').toLowerCase().includes(q));
                          return matchesStatus && matchesSearch;
                        })
                        .map((o) => (
                          <tr key={o.id} className="hover:bg-emerald-50/40 transition-colors">
                            {/* Order ID & Date */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-black text-emerald-950 block text-xs">{o.id}</span>
                              <span className="text-[12px] text-zinc-950 font-bold block mt-0.5">
                                {formatOrderClock(o)}
                              </span>
                              <div className="flex items-center gap-1 mt-1">
                                <span className="text-[9px] font-mono text-emerald-900 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                  {o.paymentMethod || 'Cash on Delivery'}
                                </span>
                                {o.paymentStatus && (
                                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                                    o.paymentStatus === 'Paid' ? 'bg-emerald-800 text-white' : 'bg-amber-100 text-amber-900'
                                  }`}>
                                    {o.paymentStatus}
                                  </span>
                                )}
                                {(o.customerNotes?.includes('PRE-ORDER') ||
                                  o.items?.some((i) => i.product?.isPreOrder)) && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-extrabold uppercase bg-amber-500 text-white">
                                    Pre-Order
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Wait / Time Needed */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-black font-mono ${
                                  ['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                                    ? 'text-emerald-700'
                                    : 'text-amber-800'
                                }`}
                              >
                                <Clock size={12} />
                                {formatOrderWait(o)}
                              </span>
                              <span className="block text-[9px] text-emerald-700 font-mono mt-0.5">
                                {['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                                  ? 'Closed'
                                  : 'Needs action'}
                              </span>
                            </td>

                            {/* Customer & Address */}
                            <td className="py-3.5 px-4 max-w-[200px]">
                              <span className="font-extrabold text-emerald-950 block text-xs">{o.shippingAddress?.fullName}</span>
                              <span className="text-[10px] font-mono text-emerald-700 block truncate">{o.shippingAddress?.addressLine1}, {o.shippingAddress?.city}</span>
                              <span className="text-[10px] text-emerald-900 font-mono block font-bold">{o.shippingAddress?.phone}</span>
                            </td>

                            {/* Purchased Items */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1 max-w-[220px]">
                                {o.items?.map((item, idx) => (
                                  <div key={idx} className="text-[11px] leading-tight border-b border-emerald-50/80 last:border-0 pb-1 last:pb-0">
                                    <span className="font-black text-emerald-950 block truncate">✓ {item.product?.name || 'Jersey Kit'}</span>
                                    <div className="text-[9px] text-emerald-700 font-mono flex items-center gap-1">
                                      <span>Size: <b>{item.selectedSize}</b></span>
                                      <span>• Qty: <b>{item.quantity}</b></span>
                                      {item.addBadge && <span className="text-amber-800 font-bold bg-amber-50 px-1 rounded">Badge</span>}
                                      {item.customPrint?.name && <span className="text-blue-800 font-bold bg-blue-50 px-1 rounded">Custom #{item.customPrint.number}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Tracking & Carrier */}
                            <td className="py-3.5 px-4 font-mono text-[10px]">
                              {o.trackingNumber ? (
                                <div>
                                  <span className="font-bold text-emerald-950 block">{o.carrier || 'Steadfast'}</span>
                                  <span className="text-emerald-700 font-bold block">{o.trackingNumber}</span>
                                  {o.trackingUrl && (
                                    <a
                                      href={o.trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[9px] text-blue-700 hover:underline flex items-center gap-1 font-bold mt-0.5"
                                    >
                                      <span>Track Package</span>
                                      <ExternalLink size={9} />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-600 italic">No tracking yet</span>
                              )}
                            </td>

                            {/* Status Quick Dropdown */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <select
                                  value={o.status}
                                  onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                                  className={`text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-xl border cursor-pointer focus:outline-none ${
                                    o.status === 'Pending' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                                    o.status === 'Confirmed' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                                    o.status === 'Packed' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                                    o.status === 'Ready to Ship' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                                    o.status === 'Shipped' ? 'bg-sky-100 text-sky-900 border-sky-300' :
                                    o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                    o.status === 'Cancelled' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                                    o.status === 'Returned' ? 'bg-orange-100 text-orange-900 border-orange-300' :
                                    'bg-violet-100 text-violet-900 border-violet-300'
                                  }`}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Confirmed">Confirmed</option>
                                  <option value="Packed">Packed</option>
                                  <option value="Ready to Ship">Ready to Ship</option>
                                  <option value="Shipped">Shipped</option>
                                  <option value="Delivered">Delivered</option>
                                  <option value="Cancelled">Cancelled</option>
                                  <option value="Returned">Returned</option>
                                  <option value="Refund Request">Refund Request</option>
                                </select>
                              </div>
                            </td>

                            {/* Total Price */}
                            <td className="py-3.5 px-4 text-right font-black text-emerald-950 font-mono text-xs">
                              {formatPrice(o.total)}
                            </td>

                            {/* Desk Actions */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenOrderModal(o)}
                                  className="bg-emerald-950 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                  title="View full order details, address, timeline & internal notes"
                                >
                                  <Eye size={12} />
                                  <span>Manage</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setInvoiceOrder(o);
                                    setIsInvoiceModalOpen(true);
                                  }}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                  title="Generate / Print Official Invoice"
                                >
                                  <Printer size={12} />
                                  <span>Invoice</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECURE ACTIVITY LOGS CONSOLE */}
            <div className="bg-white text-zinc-950 border border-zinc-200 rounded-3xl p-6 relative overflow-hidden shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b border-zinc-200 pb-3">
                <h3 className="text-xs font-black uppercase text-zinc-950 font-mono flex items-center gap-2">
                  <Activity size={14} className="text-zinc-950 animate-pulse" />
                  Live Secured Database Activity Console Logs
                </h3>
                <span className="bg-zinc-950 text-white font-mono text-[8px] px-2 py-0.5 rounded border border-zinc-800">
                  SECURE CONNECTION • 128-BIT
                </span>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-2 font-mono text-[12px] text-zinc-800 select-all pr-2 font-semibold">
                {logs.map((log, i) => (
                  <p key={i} className="flex justify-between hover:bg-zinc-100 p-1 rounded transition-colors">
                    <span className="truncate max-w-[80%] text-zinc-950">{log}</span>
                    <span className="text-zinc-950 font-bold flex-shrink-0">STATUS: OK</span>
                  </p>
                ))}
              </div>
              
              <div className="mt-5 pt-3 border-t border-zinc-200 flex justify-between items-center">
                <p className="text-[12px] text-zinc-700 font-mono font-semibold">
                  MongoDB Cloud Partition • Node Ingress Active on Port 3000
                </p>
                {!liveDb && (
                  <button
                    onClick={handleResetDatabase}
                    className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 border border-zinc-300 font-mono text-[12px] px-3 py-1.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 font-bold"
                  >
                    <Trash2 size={11} />
                    Reset Admin Simulated Data
                  </button>
                )}
                {liveDb && (
                  <span className="text-[12px] text-zinc-700 font-mono font-semibold">Live Neon mode — reset disabled</span>
                )}
              </div>
            </div>

          </div>
        );
      })()}

      {activeSidebarTab === 'inventory' && (
        <InventoryEditor
          products={products}
          setProducts={setProducts}
          formatPrice={formatPrice}
          onRequireStaffLogin={onRequireStaffLogin}
          shopName={appConfig?.logoText || 'Epic Vanskap'}
        />
      )}

      {activeSidebarTab === 'seller-requests' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-sm font-bold uppercase text-emerald-950">Collector Submission Approval Desk</h3>
            <p className="text-[10px] text-emerald-700 font-mono">Approve submitted user shirts for physical verification checks or reject them directly</p>
          </div>

          <div className="space-y-4">
            {visibleSellerRequests.length === 0 ? (
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-8 text-center text-sm text-emerald-800">
                No seller requests in the database yet.
              </div>
            ) : (
              visibleSellerRequests.map((req) => (
              <div
                key={req.id}
                className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] px-2.5 py-0.5 rounded font-bold border border-emerald-200">
                      ID: {req.id}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-mono">{req.date}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-black ${
                      req.status === 'Pending'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : req.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {req.status}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-emerald-950">{req.shirtName}</h4>
                  <p className="text-xs text-emerald-850">
                    Brand: <span className="text-emerald-950 font-mono">{req.brand}</span> | Season: <span className="text-emerald-950 font-mono">{req.season}</span> | Condition: <span className="text-emerald-800 font-bold">{req.condition}</span>
                  </p>
                  <p className="text-xs font-semibold text-emerald-850">
                    Seller Expected Value: <span className="text-emerald-950 font-mono font-black">${req.expectedPrice}</span>
                  </p>
                </div>

                {req.status === 'Pending' && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={() => handleSellerRequest(req.id, 'Approved')}
                      className="flex-1 md:flex-none bg-emerald-800 hover:bg-emerald-900 border border-emerald-700 text-white text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} /> Approve Submission
                    </button>
                    <button
                      onClick={() => handleSellerRequest(req.id, 'Rejected')}
                      className="flex-1 md:flex-none bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSidebarTab === 'homepage-builder' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Homepage Product Row Sections */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
              <div>
                <h3 className="text-base font-bold uppercase text-emerald-950">Homepage Product Rows</h3>
                <p className="text-[11px] text-emerald-800 font-mono mt-0.5">
                  Edit rows, pick products from current stock, or auto-fill by category.
                  {liveDb && (
                    <span className="block mt-1 text-emerald-700 font-bold">
                      Live database — changes save for all visitors (not just this browser).
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="bg-white border-2 border-amber-300 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-100 pb-4">
                <div>
                  <h4 className="text-sm font-black uppercase text-emerald-950">Hot Deals / Flash Offer Vault</h4>
                  <p className="text-[10px] text-emerald-700 font-mono mt-1 max-w-xl">
                    Add multiple discount products, set a fixed deal price for each, mark hot deals, and control what shoppers see on the homepage.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleDailyDealVisibility}
                  className={`text-[10px] font-black uppercase px-4 py-2 rounded-full cursor-pointer shrink-0 ${
                    dailyDealVisible ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {dailyDealVisible ? 'Showing on Homepage' : 'Hidden — Click to Show'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-black uppercase text-emerald-800 block mb-1">
                    Section Headline
                  </label>
                  <input
                    type="text"
                    value={dailyDealSection?.title || 'LIMITED DAILY DEAL DECK'}
                    onChange={(e) => updateHomepageSection('daily-deals', { title: e.target.value })}
                    placeholder="LIMITED DAILY DEAL DECK"
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-950 uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono font-black uppercase text-emerald-800 block mb-1">
                    Offer Ends At (countdown)
                  </label>
                  <input
                    type="datetime-local"
                    value={
                      appConfig.dailyDealEndsAt
                        ? (() => {
                            const d = new Date(appConfig.dailyDealEndsAt);
                            if (!Number.isFinite(d.getTime())) return '';
                            const pad = (n: number) => String(n).padStart(2, '0');
                            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                          })()
                        : ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      persistFlashDeals(
                        flashDealItems,
                        raw ? new Date(raw).toISOString() : null,
                      );
                    }}
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-emerald-950"
                  />
                  <p className="text-[9px] text-emerald-600 font-mono mt-1">
                    Leave empty for a rolling same-day style timer.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-mono font-black uppercase text-emerald-800 block">
                    Add Products to Hot Deals
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" size={14} />
                    <input
                      type="search"
                      value={flashOfferSearch}
                      onChange={(e) => setFlashOfferSearch(e.target.value)}
                      placeholder="Search product name, SKU, brand…"
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-emerald-950"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto border border-emerald-100 rounded-xl divide-y divide-emerald-50">
                    {flashOfferProducts
                      .filter((p) => {
                        const q = flashOfferSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          p.name.toLowerCase().includes(q) ||
                          (p.sku || '').toLowerCase().includes(q) ||
                          (p.brand || '').toLowerCase().includes(q) ||
                          (p.category || '').toLowerCase().includes(q)
                        );
                      })
                      .map((p) => {
                        const selected = flashDealItems.some((d) => d.productId === p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => (selected ? removeFlashDealProduct(p.id) : addFlashDealProduct(p.id))}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer transition-colors ${
                              selected ? 'bg-amber-50' : 'bg-white hover:bg-emerald-50/50'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 overflow-hidden flex items-center justify-center shrink-0">
                              <JerseyRenderer
                                productId={p.id}
                                uploadedImage={p.uploadedImage}
                                imageKey={p.image}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-emerald-950 truncate uppercase">{p.name}</p>
                              <p className="text-[10px] font-mono text-emerald-700 truncate">
                                {p.brand} · catalog ৳{Math.round(Number(p.price) || 0).toLocaleString()}
                              </p>
                            </div>
                            {selected ? (
                              <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-2 py-1 rounded-full shrink-0">
                                In deals
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase text-emerald-700 shrink-0">+ Add</span>
                            )}
                          </button>
                        );
                      })}
                    {flashOfferProducts.length === 0 && (
                      <p className="px-3 py-4 text-xs text-emerald-700 font-mono">No products available. Add products first.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-mono font-black uppercase text-emerald-800 block">
                    Active Deals ({flashDealItems.length}) — fix prices here
                  </label>
                  {flashDealItems.length === 0 ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                      <p className="text-[11px] text-rose-700 font-mono">
                        No deal products yet. Add one or more kits from the list — then set the fixed deal price shoppers will pay.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                      {flashDealItems.map((deal, index) => {
                        const product = flashOfferProducts.find((p) => p.id === deal.productId);
                        if (!product) {
                          return (
                            <div
                              key={deal.productId}
                              className="rounded-xl border border-rose-200 bg-rose-50/40 p-3 flex items-center justify-between gap-2"
                            >
                              <p className="text-[11px] font-mono text-rose-700">
                                Missing product ({deal.productId})
                              </p>
                              <button
                                type="button"
                                onClick={() => removeFlashDealProduct(deal.productId)}
                                className="text-[9px] font-black uppercase text-rose-700 cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        }
                        const savePct = calcDiscountPercent(
                          Number(deal.compareAtPrice) || Number(product.price) || 0,
                          Number(deal.dealPrice) || 0,
                        );
                        return (
                          <div
                            key={deal.productId}
                            className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 space-y-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-lg bg-white border border-emerald-100 overflow-hidden flex items-center justify-center shrink-0">
                                <JerseyRenderer
                                  productId={product.id}
                                  uploadedImage={product.uploadedImage}
                                  imageKey={product.image}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-emerald-950 uppercase leading-snug truncate">
                                  {product.name}
                                </p>
                                <p className="text-[10px] font-mono text-emerald-700">
                                  Catalog ৳{Math.round(Number(product.price) || 0).toLocaleString()}
                                  {savePct > 0 ? ` · SAVE ${savePct}%` : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => moveFlashDeal(deal.productId, -1)}
                                  className="p-1 rounded border border-emerald-200 text-emerald-800 disabled:opacity-30 cursor-pointer"
                                  title="Move up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === flashDealItems.length - 1}
                                  onClick={() => moveFlashDeal(deal.productId, 1)}
                                  className="p-1 rounded border border-emerald-200 text-emerald-800 disabled:opacity-30 cursor-pointer"
                                  title="Move down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeFlashDealProduct(deal.productId)}
                                  className="p-1 rounded border border-rose-200 text-rose-700 cursor-pointer"
                                  title="Remove"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] font-mono font-black uppercase text-emerald-800 block mb-1">
                                  Fixed deal price (৳)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={deal.dealPrice}
                                  onChange={(e) =>
                                    updateFlashDealItem(deal.productId, {
                                      dealPrice: roundMoney(Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-full bg-white border border-rose-200 rounded-lg px-2 py-1.5 text-sm font-black text-red-600"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-mono font-black uppercase text-emerald-800 block mb-1">
                                  Was / compare price (৳)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={deal.compareAtPrice ?? ''}
                                  onChange={(e) =>
                                    updateFlashDealItem(deal.productId, {
                                      compareAtPrice:
                                        e.target.value === ''
                                          ? null
                                          : roundMoney(Number(e.target.value) || 0),
                                    })
                                  }
                                  className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-sm font-bold text-emerald-900"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-mono font-black uppercase text-emerald-800 block mb-1">
                                  Items left (scarcity)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={deal.stockLeft ?? ''}
                                  onChange={(e) =>
                                    updateFlashDealItem(deal.productId, {
                                      stockLeft:
                                        e.target.value === ''
                                          ? null
                                          : Math.max(0, Math.round(Number(e.target.value) || 0)),
                                    })
                                  }
                                  className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-950"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-mono font-black uppercase text-emerald-800 block mb-1">
                                  Claimed % (0–100)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step={1}
                                  value={deal.claimedPercent ?? ''}
                                  onChange={(e) =>
                                    updateFlashDealItem(deal.productId, {
                                      claimedPercent:
                                        e.target.value === ''
                                          ? null
                                          : Math.min(
                                              100,
                                              Math.max(0, Math.round(Number(e.target.value) || 0)),
                                            ),
                                    })
                                  }
                                  className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-950"
                                />
                              </div>
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={deal.isHotDeal === true}
                                onChange={(e) =>
                                  updateFlashDealItem(deal.productId, { isHotDeal: e.target.checked })
                                }
                                className="rounded border-amber-400 text-amber-500 focus:ring-amber-400"
                              />
                              <span className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                                <Flame size={12} className="text-amber-500" /> Show as Hot Deal badge
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {productRowSections.map((section) => {
                const cat = resolveSectionCategory(section) || '';
                const productCount = countProductsInSection(section, products);
                const isManual = usesManualProductSelection(section);
                const selectedIds = section.selectedProductIds || [];
                const isPickerOpen = expandedProductPickerSectionId === section.id;
                const pickerProducts = stockProducts.filter((p) => {
                  const q = productPickerSearch.toLowerCase();
                  if (!q) return true;
                  return (
                    p.name.toLowerCase().includes(q) ||
                    p.category?.toLowerCase().includes(q) ||
                    p.sku?.toLowerCase().includes(q)
                  );
                });

                return (
                  <div key={section.id} className="bg-white border border-emerald-100 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded uppercase">
                          {section.id}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700">
                          {productCount} showing
                          {isManual ? ` (${selectedIds.length} hand-picked)` : cat ? ` (category: ${cat})` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedProductPickerSectionId(isPickerOpen ? null : section.id);
                            setProductPickerSearch('');
                          }}
                          className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full cursor-pointer flex items-center gap-1 ${
                            isPickerOpen
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <Edit size={11} /> {isPickerOpen ? 'Close Picker' : 'Pick Products'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateHomepageSection(section.id, { visible: !section.visible }, true)}
                          className={`text-[9px] font-black uppercase px-2 py-1 rounded-full cursor-pointer ${
                            section.visible ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {section.visible ? 'Visible' : 'Hidden'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHomepageSection(section.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"
                          title="Delete section"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={section.title || ''}
                        onChange={(e) => updateHomepageSection(section.id, { title: e.target.value })}
                        placeholder="Section title"
                        className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-950"
                      />
                      <input
                        type="text"
                        value={section.subtitle || ''}
                        onChange={(e) => updateHomepageSection(section.id, { subtitle: e.target.value })}
                        placeholder="Subtitle"
                        className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-emerald-800"
                      />
                      <select
                        value={cat}
                        onChange={(e) =>
                          updateHomepageSection(
                            section.id,
                            {
                              productCategory: e.target.value,
                              sectionType: 'product-row',
                              productSelectionMode: 'category',
                              selectedProductIds: [],
                            },
                            true,
                          )
                        }
                        className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-950"
                      >
                        {categoryNameOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={section.buttonText ?? 'VIEW ALL'}
                        onChange={(e) => updateHomepageSection(section.id, { buttonText: e.target.value })}
                        placeholder="Button label (empty = hide)"
                        className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-emerald-800"
                      />
                    </div>

                    {isPickerOpen && (
                      <div className="border border-emerald-100 rounded-xl bg-emerald-50/30 p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h5 className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
                              Select from current stock
                            </h5>
                            <p className="text-[9px] font-mono text-emerald-700">
                              Click products to add/remove. Hand-picked products override category filter.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                selectAllStockForSection(
                                  section.id,
                                  pickerProducts.map((p) => p.id),
                                )
                              }
                              className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-800 text-white cursor-pointer"
                            >
                              Select all in stock
                            </button>
                            {isManual && (
                              <button
                                type="button"
                                onClick={() => clearSectionManualProducts(section.id)}
                                className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 cursor-pointer"
                              >
                                Use category only
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search stock by name, SKU, category..."
                            value={productPickerSearch}
                            onChange={(e) => setProductPickerSearch(e.target.value)}
                            className="w-full bg-white border border-emerald-200 rounded-lg py-2 pl-3 pr-8 text-xs text-emerald-950"
                          />
                          <Search size={12} className="absolute right-2.5 top-2.5 text-emerald-600" />
                        </div>

                        {selectedIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedIds.map((id) => {
                              const p = products.find((prod) => prod.id === id);
                              if (!p) return null;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => toggleSectionProduct(section.id, id)}
                                  className="text-[9px] font-bold bg-emerald-800 text-white px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer"
                                >
                                  {p.name.slice(0, 24)}
                                  <X size={10} />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[280px] overflow-y-auto pr-1">
                          {pickerProducts.length === 0 && (
                            <p className="col-span-full text-[10px] font-mono text-emerald-700 text-center py-4">
                              No in-stock products match your search.
                            </p>
                          )}
                          {pickerProducts.map((p) => {
                            const isSelected = selectedIds.includes(p.id);
                            const thumb =
                              p.uploadedImage ||
                              p.image ||
                              p.images?.[0] ||
                              p.gallery?.[0] ||
                              '';
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleSectionProduct(section.id, p.id)}
                                className={`text-left p-2 rounded-xl border transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500'
                                    : 'border-emerald-100 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                                }`}
                              >
                                <div className="aspect-square rounded-lg bg-emerald-50/60 mb-1.5 overflow-hidden flex items-center justify-center">
                                  {thumb ? (
                                    <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <Shirt size={20} className="text-emerald-400" />
                                  )}
                                </div>
                                <p className="text-[9px] font-bold text-emerald-950 line-clamp-2 leading-tight">{p.name}</p>
                                <p className="text-[8px] font-mono text-emerald-700 mt-0.5">{p.category} · {p.stock} left</p>
                                {isSelected && (
                                  <span className="text-[8px] font-black text-emerald-800 uppercase mt-1 block">Selected</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-white border border-emerald-100 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-emerald-950 uppercase">Add New Homepage Product Row</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Section title e.g. Champions League Vault"
                  value={newProductRowTitle}
                  onChange={(e) => setNewProductRowTitle(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold text-emerald-950"
                />
                <input
                  type="text"
                  placeholder="Subtitle (optional)"
                  value={newProductRowSubtitle}
                  onChange={(e) => setNewProductRowSubtitle(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-2 text-[10px] font-mono text-emerald-800"
                />
                <input
                  type="text"
                  list="homepage-category-options"
                  placeholder="Category name (creates if new)"
                  value={newProductRowCategory}
                  onChange={(e) => setNewProductRowCategory(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-bold text-emerald-950"
                />
              </div>
              <datalist id="homepage-category-options">
                {categoryNameOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={handleAddProductRowSection}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Add Product Row Section
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl">
            <div>
              <h3 className="text-base font-bold uppercase text-emerald-950">Interactive Homepage Carousel Builder</h3>
              <p className="text-[11px] text-emerald-800 font-mono mt-0.5">Add, edit, or remove slides, upload custom slide banner images, and pair with target products.</p>
            </div>
            <button
              type="button"
              onClick={handleAddSlide}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer flex-shrink-0"
            >
              <Plus size={14} className="stroke-[3]" /> Add New Banner Slide
            </button>
          </div>

          {/* Match Countdown Timer Settings */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-6 space-y-6">
            <div className="border-b border-emerald-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
                <h4 className="text-sm font-mono font-black text-emerald-950 uppercase tracking-widest">
                  LIVE MATCH COUNTDOWN TIMER CONTROLLER & PRESETS
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ ...appConfig, timerEnabled: false })}
                  className={`text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
                    appConfig.timerEnabled === false
                      ? 'bg-red-600 text-white font-black'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  🔴 HIDE / TURN OFF (SHOW NOTHING)
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ ...appConfig, timerEnabled: true })}
                  className={`text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
                    appConfig.timerEnabled !== false
                      ? 'bg-emerald-800 text-white font-black'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  🟢 SHOW TIMER
                </button>
              </div>
            </div>

            {/* Featured Rivalries (Filterable / Searchable Grid) */}
            <div className="space-y-3 bg-white border border-emerald-100 p-4 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                <label className="text-[10px] text-emerald-950 font-mono uppercase tracking-widest block font-bold">
                  ⭐ SELECT PRESET RIVALRY MATCH ({RIVALRY_PRESETS.length} CLASSIC DERBIES):
                </label>
                <span className="text-[9px] text-emerald-600 font-mono">
                  Sets Team 1, Team 2, Emojis, Stage/Label & Ideal Countdown hours!
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                {RIVALRY_PRESETS.map((preset) => {
                  const isActive = appConfig.timerTeam1 === preset.team1.code && appConfig.timerTeam2 === preset.team2.code;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => onUpdateConfig({
                        ...appConfig,
                        timerTeam1: preset.team1.code,
                        timerTeam1Emoji: preset.team1.emoji,
                        timerTeam2: preset.team2.code,
                        timerTeam2Emoji: preset.team2.emoji,
                        timerLabel: preset.label,
                        timerTargetHours: preset.hours,
                        timerEnabled: true
                      })}
                      className={`text-left p-2 rounded-xl transition-all cursor-pointer border flex flex-col justify-between h-[68px] ${
                        isActive
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                          : 'bg-white border border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50 text-emerald-850'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase tracking-tight">
                          {preset.label}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-emerald-850">
                          {preset.hours}h
                        </span>
                      </div>
                      <p className="text-[10px] font-black text-emerald-950 line-clamp-1">
                        {preset.name}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-700">
                        <span>{preset.team1.emoji} {preset.team1.code}</span>
                        <span>vs</span>
                        <span>{preset.team2.code} {preset.team2.emoji}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Time Hours Presets */}
            <div className="space-y-2 bg-white border border-emerald-100 p-4 rounded-xl">
              <label className="text-[10px] text-emerald-950 font-mono uppercase tracking-widest block font-bold">
                ⏰ QUICK TIME DURATION PRESETS:
              </label>
              <div className="flex flex-wrap gap-2.5">
                {[12, 24, 36, 48, 72, 96, 120].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => onUpdateConfig({ ...appConfig, timerTargetHours: hours, timerEnabled: true })}
                    className={`text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer border ${
                      appConfig.timerTargetHours === hours
                        ? 'bg-emerald-800 text-white border-emerald-800 font-extrabold'
                        : 'bg-white text-emerald-700 border border-emerald-100 hover:bg-emerald-50'
                    }`}
                  >
                    {hours} Hours ({Math.round(hours / 24)} Days)
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Interactive Team Selectors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              
              {/* TEAM 1 SEARCH & SELECTOR */}
              <div className="bg-white border border-emerald-100 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="text-[11px] font-mono font-black text-emerald-950 uppercase tracking-widest">
                    👈 SELECT TEAM 1 (HOME)
                  </span>
                  <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-200/60">
                    Selected: {appConfig.timerTeam1Emoji} {appConfig.timerTeam1}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-emerald-700 font-mono uppercase block mb-1">League Category:</label>
                    <select
                      value={team1Category}
                      onChange={(e) => setTeam1Category(e.target.value)}
                      className="w-full bg-white border border-emerald-100 rounded-lg py-1 px-2 text-[11px] text-emerald-950 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="All">All Categories</option>
                      {Array.from(new Set(TEAMS_LIST.map((t) => t.category))).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-emerald-700 font-mono uppercase block mb-1">Search Club:</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type name..."
                        value={team1Search}
                        onChange={(e) => setTeam1Search(e.target.value)}
                        className="w-full bg-white border border-emerald-100 rounded-lg py-1 pl-2 pr-6 text-[11px] text-emerald-950 focus:outline-none focus:border-emerald-500"
                      />
                      <Search size={10} className="absolute right-2 top-2 text-emerald-600" />
                    </div>
                  </div>
                </div>

                {/* Grid list of team items for Team 1 */}
                <div className="bg-white rounded-lg p-2 max-h-[140px] overflow-y-auto space-y-1 border border-emerald-100">
                  {TEAMS_LIST.filter((t) => {
                    const matchesCat = team1Category === 'All' || t.category === team1Category;
                    const matchesSearch = t.name.toLowerCase().includes(team1Search.toLowerCase()) || t.code.toLowerCase().includes(team1Search.toLowerCase());
                    return matchesCat && matchesSearch;
                  }).slice(0, 40).map((team) => (
                    <button
                      key={team.name}
                      type="button"
                      onClick={() => onUpdateConfig({
                        ...appConfig,
                        timerTeam1: team.code,
                        timerTeam1Emoji: team.emoji,
                        timerEnabled: true
                      })}
                      className={`w-full text-left py-1.5 px-2.5 rounded text-[10px] font-bold flex items-center justify-between transition-all ${
                        appConfig.timerTeam1 === team.code
                          ? 'bg-emerald-800 text-white'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs">{team.emoji}</span>
                        <span>{team.name}</span>
                      </span>
                      <span className="font-mono opacity-80 uppercase tracking-wider">{team.code}</span>
                    </button>
                  ))}
                  {TEAMS_LIST.filter((t) => {
                    const matchesCat = team1Category === 'All' || t.category === team1Category;
                    const matchesSearch = t.name.toLowerCase().includes(team1Search.toLowerCase()) || t.code.toLowerCase().includes(team1Search.toLowerCase());
                    return matchesCat && matchesSearch;
                  }).length === 0 && (
                    <p className="text-[10px] text-gray-500 text-center py-2">No matching clubs found.</p>
                  )}
                </div>
              </div>

              {/* TEAM 2 SEARCH & SELECTOR */}
              <div className="bg-white border border-emerald-100 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <span className="text-[11px] font-mono font-black text-emerald-950 uppercase tracking-widest">
                    👈 SELECT TEAM 2 (AWAY)
                  </span>
                  <span className="bg-emerald-50 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-200/60">
                    Selected: {appConfig.timerTeam2} {appConfig.timerTeam2Emoji}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-emerald-700 font-mono uppercase block mb-1">League Category:</label>
                    <select
                      value={team2Category}
                      onChange={(e) => setTeam2Category(e.target.value)}
                      className="w-full bg-white border border-emerald-100 rounded-lg py-1 px-2 text-[11px] text-emerald-950 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="All">All Categories</option>
                      {Array.from(new Set(TEAMS_LIST.map((t) => t.category))).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-emerald-700 font-mono uppercase block mb-1">Search Club:</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type name..."
                        value={team2Search}
                        onChange={(e) => setTeam2Search(e.target.value)}
                        className="w-full bg-white border border-emerald-100 rounded-lg py-1 pl-2 pr-6 text-[11px] text-emerald-950 focus:outline-none focus:border-emerald-500"
                      />
                      <Search size={10} className="absolute right-2 top-2 text-emerald-600" />
                    </div>
                  </div>
                </div>

                {/* Grid list of team items for Team 2 */}
                <div className="bg-white rounded-lg p-2 max-h-[140px] overflow-y-auto space-y-1 border border-emerald-100">
                  {TEAMS_LIST.filter((t) => {
                    const matchesCat = team2Category === 'All' || t.category === team2Category;
                    const matchesSearch = t.name.toLowerCase().includes(team2Search.toLowerCase()) || t.code.toLowerCase().includes(team2Search.toLowerCase());
                    return matchesCat && matchesSearch;
                  }).slice(0, 40).map((team) => (
                    <button
                      key={team.name}
                      type="button"
                      onClick={() => onUpdateConfig({
                        ...appConfig,
                        timerTeam2: team.code,
                        timerTeam2Emoji: team.emoji,
                        timerEnabled: true
                      })}
                      className={`w-full text-left py-1.5 px-2.5 rounded text-[10px] font-bold flex items-center justify-between transition-all ${
                        appConfig.timerTeam2 === team.code
                          ? 'bg-emerald-800 text-white'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs">{team.emoji}</span>
                        <span>{team.name}</span>
                      </span>
                      <span className="font-mono opacity-80 uppercase tracking-wider">{team.code}</span>
                    </button>
                  ))}
                  {TEAMS_LIST.filter((t) => {
                    const matchesCat = team2Category === 'All' || t.category === team2Category;
                    const matchesSearch = t.name.toLowerCase().includes(team2Search.toLowerCase()) || t.code.toLowerCase().includes(team2Search.toLowerCase());
                    return matchesCat && matchesSearch;
                  }).length === 0 && (
                    <p className="text-[10px] text-emerald-600 text-center py-2">No matching clubs found.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Live values inputs and fine-tuning */}
            <div className="pt-3 border-t border-emerald-100">
              <p className="text-[10px] text-emerald-700 font-mono uppercase tracking-wider mb-2 font-bold">
                🔧 MANUAL FINE-TUNING / CUSTOM OVERWRITE (IF YOU WANT TO TYPE ENTIRELY CUSTOM VALUES):
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-700 font-mono uppercase block">Team 1 Code:</label>
                  <input
                    type="text"
                    value={appConfig.timerTeam1 || 'ESP'}
                    onChange={(e) => onUpdateConfig({ ...appConfig, timerTeam1: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-700 font-mono uppercase block">Team 1 Emoji:</label>
                  <input
                    type="text"
                    value={appConfig.timerTeam1Emoji || '🇪🇸'}
                    onChange={(e) => onUpdateConfig({ ...appConfig, timerTeam1Emoji: e.target.value })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-700 font-mono uppercase block">Team 2 Code:</label>
                  <input
                    type="text"
                    value={appConfig.timerTeam2 || 'BEL'}
                    onChange={(e) => onUpdateConfig({ ...appConfig, timerTeam2: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-emerald-700 font-mono uppercase block">Team 2 Emoji:</label>
                  <input
                    type="text"
                    value={appConfig.timerTeam2Emoji || '🇧🇪'}
                    onChange={(e) => onUpdateConfig({ ...appConfig, timerTeam2Emoji: e.target.value })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-[10px] text-emerald-700 font-mono uppercase block">Stage / Label:</label>
                  <input
                    type="text"
                    value={appConfig.timerLabel || 'QUARTER-FINAL'}
                    onChange={(e) => onUpdateConfig({ ...appConfig, timerLabel: e.target.value })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-[10px] text-emerald-700 font-mono uppercase block">Countdown Hours:</label>
                  <input
                    type="number"
                    value={appConfig.timerTargetHours !== undefined ? appConfig.timerTargetHours : 20}
                    onChange={(e) => onUpdateConfig({ ...appConfig, timerTargetHours: Number(e.target.value) })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STYLISH CAROUSEL MANAGER (4-5 IMAGE HERO CONTROLLER) */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-emerald-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="text-emerald-800 h-4 w-4" />
                  <h4 className="text-sm font-mono font-black text-emerald-950 uppercase tracking-widest">
                    PRESTIGE HERO CAROUSEL CONTROLLER (4-5 IMAGE SLOTS)
                  </h4>
                </div>
                <p className="text-[11px] text-emerald-800 font-mono mt-1">
                  Configure 4-5 high-resolution banner images, target product routes, and promotional captions. Changes sync globally instantly.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={bulkLoadWCPresets}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono text-[10px] uppercase font-black px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Instantly populates 5 stunning ready-to-go 2026 World Cup slider graphics"
                >
                  <Sparkles size={12} className="text-emerald-700" /> Apply World Cup 2026 Presets
                </button>
                {slides.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddSlide}
                    className="bg-emerald-800 hover:bg-emerald-700 text-white font-black text-[10px] uppercase px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={12} className="stroke-[3]" /> Add Slide Slot
                  </button>
                )}
              </div>
            </div>

            {/* 5 Slot Navigation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {[0, 1, 2, 3, 4].map((idx) => {
                const slide = slides[idx];
                const isSelected = selectedSlideIdx === idx;
                
                if (slide) {
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setSelectedSlideIdx(idx)}
                      className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between h-[90px] cursor-pointer group overflow-hidden ${
                        isSelected
                          ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'bg-white border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      {/* Micro slide background thumbnail */}
                      <div className="absolute inset-0 opacity-10 group-hover:opacity-15 transition-opacity">
                        <img
                          src={slide.customImage || CAROUSEL_PRESETS[idx % CAROUSEL_PRESETS.length].url}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      
                      <div className="relative z-10 flex items-center justify-between w-full">
                        <span className={`font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          SLOT {idx + 1}
                        </span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                      
                      <div className="relative z-10 mt-2">
                        <p className="text-[10px] font-black text-emerald-950 truncate leading-tight">
                          {slide.title || 'Untitled Slide'}
                        </p>
                        <p className="text-[8px] font-mono text-emerald-700 truncate mt-0.5">
                          {slide.badge || 'No tag'}
                        </p>
                      </div>
                    </button>
                  );
                } else {
                  return (
                    <button
                      key={`empty-slot-${idx}`}
                      type="button"
                      onClick={handleAddSlide}
                      className="text-center p-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50 hover:border-emerald-400 transition-all flex flex-col items-center justify-center h-[90px] cursor-pointer group"
                    >
                      <Plus size={14} className="text-emerald-600 group-hover:text-emerald-800 transition-colors" />
                      <span className="text-[9px] font-mono font-bold text-emerald-700 uppercase tracking-wider mt-1 block">
                        ACTIVATE SLOT {idx + 1}
                      </span>
                    </button>
                  );
                }
              })}
            </div>

            {/* Active Slot Configuration Dashboard */}
            {slides.length > 0 && slides[selectedSlideIdx] ? (
              (() => {
                const activeSlide = slides[selectedSlideIdx];
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 border-t border-emerald-100">
                    
                    {/* COLUMN 1: LIVE INTERACTIVE PREVIEW SIMULATOR (5 COLS) */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-800 font-bold">
                            Live Simulated Canvas
                          </span>
                        </div>
                        
                        {/* Desktop / Mobile Device preview switches */}
                        <div className="flex items-center gap-1 bg-emerald-50 p-1 rounded-lg border border-emerald-100">
                          <button
                            type="button"
                            onClick={() => setPreviewDeviceMode('desktop')}
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              previewDeviceMode === 'desktop'
                                ? 'bg-emerald-800 text-white'
                                : 'text-emerald-600 hover:text-emerald-850'
                            }`}
                            title="Simulate PC/Tablet Desktop Layout"
                          >
                            <Monitor size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewDeviceMode('mobile')}
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              previewDeviceMode === 'mobile'
                                ? 'bg-emerald-800 text-white'
                                : 'text-emerald-600 hover:text-emerald-850'
                            }`}
                            title="Simulate Mobile Portrait Device"
                          >
                            <Smartphone size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Simulator Stage view */}
                      <div className="bg-emerald-50/20 rounded-2xl border border-emerald-100 p-4 flex items-center justify-center min-h-[280px]">
                        <div
                          className={`relative overflow-hidden rounded-xl bg-cover bg-center border border-neutral-900 shadow-2xl transition-all duration-300 flex flex-col justify-end ${
                            previewDeviceMode === 'desktop'
                              ? 'aspect-[16/10] w-full max-w-md'
                              : 'aspect-[9/16] w-[210px]'
                          }`}
                          style={{
                            backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0.85)), url(${
                              activeSlide.customImage || CAROUSEL_PRESETS[selectedSlideIdx % CAROUSEL_PRESETS.length].url
                            })`,
                          }}
                        >
                          <div className="p-4 space-y-1 text-white">
                            <span className="bg-amber-400 text-black text-[7px] font-black uppercase px-1 py-0.5 rounded tracking-wider">
                              {activeSlide.badge || 'PROMO BADGE'}
                            </span>
                            <h5 className="text-xs sm:text-sm font-black uppercase tracking-tight text-white leading-tight mt-1">
                              {activeSlide.title || 'ENTER BANNER TITLE'}
                            </h5>
                            <p className="text-[7px] text-gray-300 uppercase font-bold tracking-wider leading-none">
                              {activeSlide.subtitle || 'Enter slide subtitle'}
                            </p>
                            <p className="text-[8px] text-gray-400 line-clamp-2 leading-tight py-0.5">
                              {activeSlide.description || 'Describe the unique retro jersey release or mystery box campaign pack here...'}
                            </p>
                            <div className="pt-1.5 flex items-center justify-between">
                              <span className="inline-block bg-white text-black font-black text-[7px] uppercase px-2 py-1 rounded">
                                SHOP NOW
                              </span>
                              <span className="text-[6px] font-mono text-gray-500 bg-black/60 px-1 py-0.5 rounded">
                                Product: {products.find(p => p.id === activeSlide.productId)?.name || 'Default'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 2: FORMS AND ASSET SELECTORS (7 COLS) */}
                    <div className="lg:col-span-7 space-y-5">
                      
                      {/* Curated Sports Atmosphere Preset Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-emerald-950 font-mono uppercase block font-bold tracking-widest">
                          🌅 CHOOSE ATMOSPHERE GRAPHIC PRESET:
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {CAROUSEL_PRESETS.map((pSet) => {
                            const isPresetActive = activeSlide.customImage === pSet.url;
                            return (
                              <button
                                key={pSet.name}
                                type="button"
                                onClick={() => handleUpdateSlide({ ...activeSlide, customImage: pSet.url })}
                                className={`group text-center p-1 rounded-lg border transition-all cursor-pointer overflow-hidden relative h-[48px] flex items-center justify-center ${
                                  isPresetActive
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-emerald-100 hover:border-emerald-200 bg-white'
                                }`}
                                title={`Set background image to ${pSet.name}`}
                              >
                                <img
                                  src={pSet.url}
                                  alt={pSet.name}
                                  className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="relative z-10 text-[8px] font-mono font-black text-emerald-950 leading-none px-1 text-center truncate drop-shadow-md">
                                  {pSet.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Custom File Upload Area */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-emerald-700 font-mono uppercase block">Or Upload Custom Banner File:</label>
                        <label className="bg-white hover:bg-emerald-50/50 border border-emerald-100 hover:border-emerald-200 p-3 rounded-xl flex items-center gap-3.5 cursor-pointer transition-all">
                          <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {activeSlide.customImage ? (
                              <img
                                src={activeSlide.customImage}
                                alt="Custom Slide"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <Image size={16} className="text-emerald-600" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-emerald-950 uppercase">Upload custom banner image</p>
                            <p className="text-[9px] text-emerald-700 truncate">Tap to pick custom file from your device</p>
                          </div>
                          
                          <span className="bg-emerald-800 text-white font-extrabold text-[9px] uppercase px-2.5 py-1.5 rounded-lg">
                            Upload
                          </span>
                          
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const url = await uploadStoreImage(file, 'banners', {
                                  maxEdge: 1600,
                                  quality: 0.8,
                                  maxBytes: 900_000,
                                });
                                handleUpdateSlide({ ...activeSlide, customImage: url });
                              } catch (err) {
                                alert(err instanceof Error ? err.message : 'Failed to upload banner image');
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Captions & Texts inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] text-emerald-700 font-mono uppercase block">Slide Badge Tag:</label>
                          <input
                            type="text"
                            value={activeSlide.badge}
                            onChange={(e) => handleUpdateSlide({ ...activeSlide, badge: e.target.value })}
                            className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. WORLD CUP EXCLUSIVE"
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] text-emerald-700 font-mono uppercase block">Slide Subtitle:</label>
                          <input
                            type="text"
                            value={activeSlide.subtitle}
                            onChange={(e) => handleUpdateSlide({ ...activeSlide, subtitle: e.target.value })}
                            className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Rare Historic Reissues"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] text-emerald-700 font-mono uppercase block">Slide Title:</label>
                          <input
                            type="text"
                            value={activeSlide.title}
                            onChange={(e) => handleUpdateSlide({ ...activeSlide, title: e.target.value })}
                            className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. THE 1998 FRANCE VAULT"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] text-emerald-700 font-mono uppercase block">Slide Description:</label>
                          <textarea
                            rows={2}
                            value={activeSlide.description}
                            onChange={(e) => handleUpdateSlide({ ...activeSlide, description: e.target.value })}
                            className="w-full bg-white border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                            placeholder="Provide descriptive copy about the capsule/jerseys featured."
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] text-emerald-700 font-mono uppercase block">Target Product Destination:</label>
                          <select
                            value={activeSlide.productId}
                            onChange={(e) => handleUpdateSlide({ ...activeSlide, productId: e.target.value })}
                            className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-3.5 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id} className="bg-white text-emerald-950">
                                {p.name} (${p.price})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Slide Ordering Toolbar and delete */}
                      <div className="flex items-center justify-between pt-3 border-t border-emerald-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => moveSlide(selectedSlideIdx, 'left')}
                            disabled={selectedSlideIdx === 0}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 disabled:opacity-30 disabled:pointer-events-none p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
                          >
                            <ChevronLeft size={14} /> Move Left
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSlide(selectedSlideIdx, 'right')}
                            disabled={selectedSlideIdx === slides.length - 1}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 disabled:opacity-30 disabled:pointer-events-none p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
                          >
                            Move Right <ChevronRight size={14} />
                          </button>
                        </div>

                        {slides.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteSlide(activeSlide.id)}
                            className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs uppercase font-mono font-bold"
                          >
                            <Trash2 size={13} /> Delete Slide Slot
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-10 bg-emerald-50/20 rounded-2xl border border-emerald-100 border-dashed">
                <AlertTriangle className="text-emerald-800 h-8 w-8 mx-auto mb-2" />
                <p className="text-xs font-bold text-emerald-950 uppercase font-mono">No Slider Banners Active</p>
                <p className="text-[10px] text-emerald-700 font-mono mt-1">Please add or load default slides above to begin customization.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {activeSidebarTab === 'coupons' && (
        <div className="space-y-4 animate-fadeIn bg-emerald-50/40 border border-emerald-100 rounded-2xl p-8">
          <h3 className="text-sm font-bold uppercase text-emerald-950">Coupons Disabled</h3>
          <p className="text-xs text-emerald-800 font-mono leading-relaxed">
            Promo codes and coupon campaigns are turned off. Orders use full listed prices only — no checkout discounts.
          </p>
        </div>
      )}

      {/* ROUTE BRAND CUSTOMIZER & THEME EDITOR */}
      {activeSidebarTab === 'brand-customizer' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Header Description */}
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
            <h3 className="text-lg font-black uppercase text-emerald-950">Bangladesh Theme & Brand Customizer Desk</h3>
            <p className="text-xs text-emerald-800 font-mono mt-1">
              Command Center calibrated for Bangladeshi retail outlets. Edit live branding logos, inject custom pricing rates, select regional color palettes, and configure custom footer footprints in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Col: Configurations */}
            <div className="lg:col-span-7 space-y-8">
              
              {/* Brand Logo & Currency Calibration */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl space-y-4">
                <h4 className="text-xs font-mono font-black text-emerald-950 uppercase tracking-widest border-b border-emerald-100 pb-2">
                  Brand Logo & Currency Setup
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">LOGO BRAND TEXT</label>
                    <input
                      type="text"
                      value={appConfig.logoText}
                      onChange={(e) => onUpdateConfig({ ...appConfig, logoText: e.target.value })}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">LOGO SUBTEXT / OUTLET</label>
                    <input
                      type="text"
                      value={appConfig.logoSubtext}
                      onChange={(e) => onUpdateConfig({ ...appConfig, logoSubtext: e.target.value })}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">CURRENCY SYMBOL</label>
                    <input
                      type="text"
                      value={appConfig.currencySymbol}
                      onChange={(e) => onUpdateConfig({ ...appConfig, currencySymbol: e.target.value })}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">CURRENCY CODE</label>
                    <input
                      type="text"
                      value={appConfig.currencyCode}
                      onChange={(e) => onUpdateConfig({ ...appConfig, currencyCode: e.target.value })}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">EXCHANGE RATE ($1 USD to BDT)</label>
                    <input
                      type="number"
                      value={appConfig.exchangeRate}
                      onChange={(e) => onUpdateConfig({ ...appConfig, exchangeRate: Number(e.target.value) })}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-mono text-emerald-700 block">bKASH / NAGAD SEND MONEY NUMBER</label>
                    <input
                      type="text"
                      value={appConfig.bkashPersonalNumber || '01865962232'}
                      onChange={(e) => onUpdateConfig({ ...appConfig, bkashPersonalNumber: e.target.value })}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-mono font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                      placeholder="01865962232"
                    />
                    <p className="text-[9px] text-emerald-700 font-mono">
                      Shown on checkout for bKash and Nagad Send Money.
                    </p>
                  </div>
                  <div className="space-y-1 sm:col-span-3 border-t border-emerald-100 pt-4 mt-2">
                    <label className="text-[10px] font-mono text-emerald-700 block font-black">bKASH CHECKOUT OPTIONS</label>
                    <select
                      value={appConfig.bkashPaymentMode || 'both'}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...appConfig,
                          bkashPaymentMode: e.target.value as 'full' | 'partial' | 'both',
                        })
                      }
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="both">Customer chooses (Full or Partial)</option>
                      <option value="full">Full payment only</option>
                      <option value="partial">Partial advance only</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">PARTIAL ADVANCE PER JERSEY (BDT)</label>
                    <input
                      type="number"
                      min={1}
                      value={appConfig.bkashPartialAmountBdt ?? 300}
                      onChange={(e) =>
                        onUpdateConfig({
                          ...appConfig,
                          bkashPartialAmountBdt: Math.max(1, Number(e.target.value) || 300),
                        })
                      }
                      disabled={(appConfig.bkashPaymentMode || 'both') === 'full'}
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-mono font-bold text-emerald-950 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    />
                    <p className="text-[9px] text-emerald-700 font-mono">
                      1 jersey → ৳{appConfig.bkashPartialAmountBdt ?? 300} · 2 → ৳
                      {((appConfig.bkashPartialAmountBdt ?? 300) * 2).toLocaleString('en-BD')} · 3 → ৳
                      {((appConfig.bkashPartialAmountBdt ?? 300) * 3).toLocaleString('en-BD')}
                    </p>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-emerald-800 font-medium">
                  ⚡ Checkout bKash / Nagad Send Money to{' '}
                  {appConfig.bkashPersonalNumber || '01865962232'} —{' '}
                  {(appConfig.bkashPaymentMode || 'both') === 'both'
                    ? 'customer picks Full or Partial on checkout'
                    : (appConfig.bkashPaymentMode || 'both') === 'full'
                      ? 'full order total only'
                      : `৳${appConfig.bkashPartialAmountBdt ?? 300} × jersey qty advance only`}
                  .
                </p>
              </div>

              {/* Theme Preset Selector */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl space-y-4">
                <h4 className="text-xs font-mono font-black text-emerald-950 uppercase tracking-widest border-b border-emerald-100 pb-2">
                  Select Visual Theme Preset
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Theme 1 */}
                  <button
                    onClick={() => onUpdateConfig({ ...appConfig, theme: 'classic' })}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      appConfig.theme === 'classic'
                        ? 'bg-emerald-100/60 border-emerald-500 shadow-sm'
                        : 'bg-white border-emerald-100 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-emerald-950">Classic Emerald Vault</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    </div>
                    <p className="text-[10px] text-emerald-800 leading-normal">
                      Curated light forest green layout paired with rich emerald details and golden text elements.
                    </p>
                  </button>

                  {/* Theme 2 */}
                  <button
                    onClick={() => onUpdateConfig({ ...appConfig, theme: 'crimson' })}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      appConfig.theme === 'crimson'
                        ? 'bg-red-50 border-red-500 shadow-sm'
                        : 'bg-white border-emerald-100 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-emerald-950">Crimson Bengal Pride</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    </div>
                    <p className="text-[10px] text-emerald-800 leading-normal">
                      Deep crimson watermarks and warm brick red accents. Inspired directly by the Bengal flag.
                    </p>
                  </button>

                  {/* Theme 3 */}
                  <button
                    onClick={() => onUpdateConfig({ ...appConfig, theme: 'royal' })}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      appConfig.theme === 'royal'
                        ? 'bg-blue-50 border-blue-500 shadow-sm'
                        : 'bg-white border-emerald-100 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-emerald-950">Royal Prestige Blue</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    </div>
                    <p className="text-[10px] text-emerald-800 leading-normal">
                      Luxury premium blue watermarks with deep gold borders. Evokes historical elegance.
                    </p>
                  </button>

                  {/* Theme 4 */}
                  <button
                    onClick={() => onUpdateConfig({ ...appConfig, theme: 'bengal' })}
                    className={`p-4 rounded-xl text-left border transition-all ${
                      appConfig.theme === 'bengal'
                        ? 'bg-amber-50 border-amber-500 shadow-sm'
                        : 'bg-white border-emerald-100 hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-emerald-950">Royal Bengal Tiger</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    </div>
                    <p className="text-[10px] text-emerald-800 leading-normal">
                      Coal-black layouts and fierce tiger-orange tags. Represents Dhaka curated athletic gear.
                    </p>
                  </button>
                </div>
              </div>

              {/* Footer Customizer Form */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl space-y-4">
                <h4 className="text-xs font-mono font-black text-emerald-950 uppercase tracking-widest border-b border-emerald-100 pb-2">
                  Footer Editorial Customizer
                </h4>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-emerald-700 block">FOOTER ABOUT TEXT</label>
                  <textarea
                    rows={3}
                    value={appConfig.footerAbout}
                    onChange={(e) => onUpdateConfig({ ...appConfig, footerAbout: e.target.value })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs font-sans text-emerald-950 focus:outline-none focus:border-emerald-500 leading-relaxed"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-mono text-emerald-700 block">OUTLET LOCATION CARDS</label>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = [...(appConfig.footerLocations || [])];
                        copy.push({
                          city: `Outlet ${copy.length + 1}`,
                          address: '',
                          phone: '+880 ',
                        });
                        onUpdateConfig({ ...appConfig, footerLocations: copy });
                      }}
                      className="text-[10px] font-black uppercase tracking-wider bg-emerald-800 text-white px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      + Add Outlet
                    </button>
                  </div>
                  {(appConfig.footerLocations || []).map((loc, idx) => (
                    <div key={idx} className="border border-emerald-100 rounded-2xl p-4 space-y-2 bg-white relative">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase">Outlet #{idx + 1}</span>
                        {(appConfig.footerLocations || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const copy = (appConfig.footerLocations || []).filter((_, i) => i !== idx);
                              onUpdateConfig({ ...appConfig, footerLocations: copy });
                            }}
                            className="text-[10px] font-bold text-rose-600 cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={loc.city}
                        onChange={(e) => {
                          const copy = [...(appConfig.footerLocations || [])];
                          copy[idx] = { ...copy[idx], city: e.target.value };
                          onUpdateConfig({ ...appConfig, footerLocations: copy });
                        }}
                        placeholder="City / Outlet name"
                        className="w-full bg-emerald-50/40 border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950"
                      />
                      <input
                        type="text"
                        value={loc.address}
                        onChange={(e) => {
                          const copy = [...(appConfig.footerLocations || [])];
                          copy[idx] = { ...copy[idx], address: e.target.value };
                          onUpdateConfig({ ...appConfig, footerLocations: copy });
                        }}
                        placeholder="Full address"
                        className="w-full bg-emerald-50/40 border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950"
                      />
                      <input
                        type="text"
                        value={loc.phone}
                        onChange={(e) => {
                          const copy = [...(appConfig.footerLocations || [])];
                          copy[idx] = { ...copy[idx], phone: e.target.value };
                          onUpdateConfig({ ...appConfig, footerLocations: copy });
                        }}
                        placeholder="Helpline / phone"
                        className="w-full bg-emerald-50/40 border border-emerald-100 rounded-xl py-2 px-3 text-xs text-emerald-950 font-mono"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-emerald-700 block">TRADEMARK / COPYRIGHT FOOTNOTE</label>
                  <input
                    type="text"
                    value={appConfig.footerCopyright}
                    onChange={(e) => onUpdateConfig({ ...appConfig, footerCopyright: e.target.value })}
                    className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

            </div>

            {/* Right Col: Secure Staff Sessions & Stock Adding */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Secure Authorized Staff Sessions */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                  <h4 className="text-xs font-mono font-black text-emerald-950 uppercase tracking-widest">
                    Authorized Staff Sessions
                  </h4>
                  <span className="bg-emerald-100 text-emerald-800 font-mono text-[9px] px-2 py-0.5 rounded border border-emerald-200/60 animate-pulse">
                    SECURE ACCESS
                  </span>
                </div>

                <p className="text-[11px] text-emerald-800 leading-normal">
                  You are currently managing the vault via authenticated administrator credentials. Access sessions are audited under regional regulations.
                </p>

                <div className="space-y-3">
                  {[
                    { name: 'Kazi Yasin Ahmed (Dhaka HQ)', status: 'ACTIVE SESSION', loc: 'Dhaka, Bangladesh', active: true },
                    { name: 'Bailey Road Staff Terminal', status: 'STANDBY', loc: 'Dhaka, Bangladesh', active: false },
                    { name: 'International Curators (Gattuso)', status: 'STANDBY', loc: 'Milan, Italy', active: false }
                  ].map((sessionUser) => (
                    <div
                      key={sessionUser.name}
                      className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                        sessionUser.active
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-white border-emerald-100 text-emerald-700'
                      }`}
                    >
                      <div>
                        <p className="text-[11px] font-bold">{sessionUser.name}</p>
                        <p className="text-[10px] text-emerald-600 font-mono font-medium">📍 {sessionUser.loc}</p>
                      </div>
                      <span className={`text-[9px] font-mono font-bold ${sessionUser.active ? 'text-emerald-800' : 'text-emerald-600'}`}>
                        {sessionUser.status}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-100 font-mono text-[10px] text-emerald-700 space-y-1">
                  <p>✔ SESSION STATUS: AUTHORIZED</p>
                  <p>✔ GATEWAY: Bailey Road, Dhaka 1217</p>
                  <p>✔ REGION: Dhaka Division</p>
                </div>
              </div>

              {/* Stock Stock Adding Form */}
              <div className="bg-emerald-50/40 border border-emerald-100 p-6 rounded-2xl space-y-4">
                <h4 className="text-xs font-mono font-black text-emerald-950 uppercase tracking-widest border-b border-emerald-100 pb-2">
                  + Add New Stock To Bangladesh Catalog
                </h4>
                
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const nameInput = form.elements.namedItem('shirt_name') as HTMLInputElement;
                    const brandInput = form.elements.namedItem('shirt_brand') as HTMLInputElement;
                    const priceInput = form.elements.namedItem('shirt_price') as HTMLInputElement;
                    const stockInput = form.elements.namedItem('shirt_stock') as HTMLInputElement;
                    const categoryInput = form.elements.namedItem('shirt_category') as HTMLSelectElement;

                    if (!nameInput.value || !brandInput.value || !priceInput.value) {
                      alert('Please fill out all required fields');
                      return;
                    }

                    if (isApiEnabled() && !getToken()) {
                      if (onRequireStaffLogin) onRequireStaffLogin();
                      else alert('Sign in as staff is required to save products to the database.');
                      return;
                    }

                    const newId = `shirt-custom-${Date.now()}`;
                    const bdtPrice = Number(priceInput.value);
                    const usdPrice = Math.round(bdtPrice / appConfig.exchangeRate);

                    const newProd: Product = {
                      id: newId,
                      name: nameInput.value,
                      slug: nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                      price: usdPrice,
                      originalPrice: usdPrice + 30,
                      image: 'shirt-custom',
                      images: [],
                      brand: brandInput.value,
                      season: '2025/2026',
                      year: 2026,
                      condition: 'Mint',
                      conditionDetail: 'Sourced from local archives in perfect collectible condition.',
                      color: 'Green/Red',
                      sizes: ['S', 'M', 'L', 'XL', '2XL'],
                      sku: `BD-SKU-${Math.floor(100000 + Math.random() * 900000)}`,
                      badgeAvailable: true,
                      printAvailable: true,
                      rating: 5.0,
                      reviewsCount: 1,
                      description: 'Special customized vintage retro jersey added to the Dhaka Football Vault system.',
                      specification: {
                        material: '100% Polyester Mesh',
                        madeIn: 'Bangladesh',
                        fit: 'Aero Athlete Standard'
                      },
                      category: categoryInput.value as any,
                      stock: Number(stockInput.value) || 10,
                      isFeatured: true,
                      uploadedImage: quickAddImage || undefined,
                    };

                    setProducts((prev) => {
                      const updated = [newProd, ...prev];
                      if (!(isApiEnabled() && getToken())) {
                        localStorage.setItem('vault_custom_products', JSON.stringify(updated));
                      } else {
                        void api
                          .createProduct({
                            name: newProd.name,
                            slug: newProd.slug,
                            sku: newProd.sku,
                            price: newProd.price,
                            description: newProd.description,
                            image: newProd.image,
                            brand: newProd.brand,
                            season: newProd.season,
                            year: newProd.year,
                            condition: String(newProd.condition),
                            conditionDetail: newProd.conditionDetail || '',
                            color: newProd.color || 'Multi',
                            sizes: newProd.sizes,
                            stock: newProd.stock,
                            status: 'Active',
                            category: newProd.category,
                          })
                          .then((saved) => {
                            setProducts((cur) =>
                              cur.map((p) => (p.id === newProd.id ? { ...p, ...saved } : p)),
                            );
                          })
                          .catch((err) => {
                            alert(err instanceof Error ? err.message : 'Failed to save product to database');
                          });
                      }
                      return updated;
                    });

                    form.reset();
                    setQuickAddImage('');
                    alert(`Successfully added "${newProd.name}" to Bangladesh stock at ${appConfig.currencySymbol}${bdtPrice}!`);
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-emerald-700 block">JERSEY CATALOG NAME *</label>
                    <input
                      name="shirt_name"
                      required
                      placeholder="e.g. Bangladesh 1999 World Cup Vintage"
                      className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-emerald-700 block">BRAND (ADIDAS/NIKE) *</label>
                      <input
                        name="shirt_brand"
                        required
                        placeholder="e.g. Adidas"
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-emerald-700 block">CATEGORY</label>
                      <select
                        name="shirt_category"
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="World Cup">World Cup Vault</option>
                        <option value="Classic">Classic Vintage</option>
                        <option value="Current Season">Current Season</option>
                        <option value="Legends">Legends Tribute</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-emerald-700 block">PRICE IN BANGLADESH TAKA (৳) *</label>
                      <input
                        name="shirt_price"
                        type="number"
                        required
                        placeholder="e.g. 5500"
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-emerald-700 block">INITIAL INVENTORY STOCK *</label>
                      <input
                        name="shirt_stock"
                        type="number"
                        required
                        placeholder="e.g. 15"
                        className="w-full bg-white border border-emerald-100 rounded-xl py-2.5 px-4 text-xs text-emerald-950 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Mobile-optimized touch image upload trigger */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono text-emerald-700 block uppercase font-bold">Jersey Photo (Optional):</label>
                    <label className="flex items-center gap-3.5 bg-white hover:bg-emerald-50/50 border border-emerald-100 hover:border-emerald-200 p-3 rounded-xl cursor-pointer transition-all group">
                      <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                        {quickAddImage ? (
                          <img
                            src={quickAddImage}
                            alt="Quick add preview"
                            className="w-full h-full object-contain filter drop-shadow"
                          />
                        ) : (
                          <Image size={15} className="text-emerald-700 group-hover:text-emerald-600 transition-colors" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-emerald-800 text-white group-hover:bg-emerald-700 border border-emerald-600 text-[9px] font-extrabold uppercase px-3 py-1.5 rounded-lg transition-all inline-flex items-center gap-1">
                          <Upload size={9} />
                          Browse Photo
                        </div>
                        {quickAddImage ? (
                          <span className="text-[9px] text-emerald-800 font-mono block mt-0.5 truncate">✓ Photo loaded</span>
                        ) : (
                          <span className="text-[9px] text-emerald-700 font-mono block mt-0.5">JPEG/PNG → Cloudinary (max 5MB)</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            alert('File is too large! Maximum limit is 5MB.');
                            return;
                          }
                          try {
                            const url = await uploadStoreImage(file, 'products');
                            setQuickAddImage(url);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Failed to upload image to Cloudinary');
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {quickAddImage && (
                      <button
                        type="button"
                        onClick={() => setQuickAddImage('')}
                        className="text-[9px] text-red-600 hover:text-red-700 hover:underline font-mono block mt-1"
                      >
                        ✕ Remove Selected Photo
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer shadow-sm mt-2"
                  >
                    + Add Jersey to Dhaka Stock
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 28 EXTENDED DYNAMIC CMS MODULE PANELS */}
      {!['dashboard', 'inventory', 'seller-requests', 'homepage-builder', 'coupons', 'brand-customizer'].includes(activeSidebarTab) && (
        <div className="bg-white border border-emerald-100 p-6 rounded-3xl space-y-8 animate-fadeIn">
          
          {/* MODULE: analytics */}
          {activeSidebarTab === 'analytics' && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4">
                <h3 className="text-base font-bold uppercase text-emerald-950">REVENUE & SALES TRENDS CENTRE</h3>
                <p className="text-[10px] text-emerald-700 font-mono">Live metrics from your orders and customer records.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <span className="text-[9px] font-mono text-emerald-800 uppercase block font-bold">Year-on-Year Growth</span>
                  <div className="text-xl font-black text-emerald-950 mt-1">
                    {analyticsSnapshot.hasOrderData
                      ? `${analyticsSnapshot.yoyGrowth >= 0 ? '+' : ''}${analyticsSnapshot.yoyGrowth}%`
                      : '—'}
                  </div>
                  <p className="text-[9px] text-emerald-700 mt-1 font-mono">
                    {analyticsSnapshot.hasOrderData
                      ? `${analyticsSnapshot.currentYear}: ৳${analyticsSnapshot.curYearRev.toLocaleString()} vs ${analyticsSnapshot.prevYear}: ৳${analyticsSnapshot.prevYearRev.toLocaleString()}`
                      : 'No order data yet'}
                  </p>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <span className="text-[9px] font-mono text-emerald-800 uppercase block font-bold">Order Fulfillment Rate</span>
                  <div className="text-xl font-black text-emerald-950 mt-1">
                    {analyticsSnapshot.hasOrderData ? `${analyticsSnapshot.fulfillmentRate}%` : '—'}
                  </div>
                  <p className="text-[9px] text-emerald-700 mt-1 font-mono">
                    {analyticsSnapshot.hasOrderData
                      ? 'Delivered orders vs active (non-cancelled) orders'
                      : 'No order data yet'}
                  </p>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                  <span className="text-[9px] font-mono text-emerald-800 uppercase block font-bold">Dhaka Repeat Buyers</span>
                  <div className="text-xl font-black text-emerald-950 mt-1">
                    {analyticsSnapshot.dhakaBuyerCount > 0 ? `${analyticsSnapshot.dhakaRepeatRate}%` : '—'}
                  </div>
                  <p className="text-[9px] text-emerald-700 mt-1 font-mono">
                    {analyticsSnapshot.dhakaBuyerCount > 0
                      ? `${analyticsSnapshot.dhakaRepeatCount} of ${analyticsSnapshot.dhakaBuyerCount} Dhaka buyers with 2+ orders`
                      : 'No Dhaka customer data yet'}
                  </p>
                </div>
              </div>
              <div className="bg-emerald-950 text-emerald-200 p-6 rounded-2xl border border-emerald-900 space-y-4">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                  MONTHLY SALES CURVE (TAKA) — {analyticsSnapshot.currentYear}
                </h4>
                <div className="h-40 w-full flex items-end justify-between gap-1 pt-4 relative">
                  <div className="absolute left-2 top-2 text-[9px] font-mono opacity-65">
                    ৳{analyticsSnapshot.maxMonthly.toLocaleString()}
                  </div>
                  <div className="absolute left-2 top-20 text-[9px] font-mono opacity-65">
                    ৳{Math.round(analyticsSnapshot.maxMonthly / 2).toLocaleString()}
                  </div>
                  <div className="absolute left-2 bottom-8 text-[9px] font-mono opacity-65">৳0</div>
                  {analyticsSnapshot.monthlyRevenue.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full z-10">
                      <div
                        className="w-full max-w-[28px] bg-emerald-500 rounded-t-sm transition-all"
                        style={{
                          height: `${Math.max(4, (m.revenue / analyticsSnapshot.maxMonthly) * 100)}%`,
                        }}
                        title={`${m.month}: ৳${m.revenue.toLocaleString()}`}
                      />
                      <span className="text-[8px] font-mono pt-2 text-emerald-300">{m.month.slice(0, 3).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
                {!analyticsSnapshot.hasOrderData && (
                  <p className="text-[10px] font-mono text-emerald-400 text-center">Place orders to populate this chart.</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const csvRows = [
                      ['Metric', 'Value'],
                      ['Year-on-Year Growth (%)', analyticsSnapshot.yoyGrowth],
                      [`${analyticsSnapshot.currentYear} Revenue (BDT)`, analyticsSnapshot.curYearRev],
                      [`${analyticsSnapshot.prevYear} Revenue (BDT)`, analyticsSnapshot.prevYearRev],
                      ['Order Fulfillment Rate (%)', analyticsSnapshot.fulfillmentRate],
                      ['Dhaka Repeat Buyers (%)', analyticsSnapshot.dhakaRepeatRate],
                      [],
                      ['Month', 'Revenue (BDT)'],
                      ...analyticsSnapshot.monthlyRevenue.map((m) => [m.month, m.revenue]),
                    ];
                    const csvContent = `data:text/csv;charset=utf-8,${csvRows.map((r) => r.join(',')).join('\n')}`;
                    const link = document.createElement('a');
                    link.href = encodeURI(csvContent);
                    link.download = `analytics-report-${analyticsSnapshot.currentYear}.csv`;
                    link.click();
                  }}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  Download CSV
                </button>
                <button type="button" onClick={() => window.print()} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold text-xs px-4 py-2.5 rounded-xl border border-emerald-200 cursor-pointer">Print PDF</button>
              </div>
            </div>
          )}

          {/* MODULE: page-builder */}
          {activeSidebarTab === 'page-builder' && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold uppercase text-emerald-950">CUSTOM PAGE BUILDER</h3>
                  <p className="text-[10px] text-emerald-700 font-mono">Rename storefront pages, then click Save to publish changes live.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ ...appConfig, pages: draftPages });
                    showSaveFeedback('Page names saved & published');
                  }}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Save size={14} /> Save Page Names
                </button>
              </div>
              <div className="space-y-4 bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100">
                <h4 className="text-xs font-bold text-emerald-950 uppercase">STOREFRONT PAGES & LANDING SECTIONS ({draftPages.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {draftPages.map((page) => (
                    <div key={page.id} className="bg-white border border-emerald-100 p-4 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-mono font-bold bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded uppercase">ID: {page.id}</span>
                          {page.isCustom && <span className="bg-amber-100 text-amber-900 font-mono text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">Custom Page</span>}
                        </div>
                        <input
                          type="text"
                          value={page.name}
                          onChange={(e) => {
                            setDraftPages((prev) => prev.map((p) => (p.id === page.id ? { ...p, name: e.target.value } : p)));
                          }}
                          className="w-full text-xs font-bold text-emerald-950 mt-2 bg-emerald-50/40 border border-emerald-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirmAsync({
                              title: 'Delete page',
                              message: `Are you sure you want to delete page "${page.name}"?`,
                              danger: true,
                              confirmText: 'Delete',
                            });
                            if (!ok) return;
                            const updatedPages = draftPages.filter((p) => p.id !== page.id);
                            setDraftPages(updatedPages);
                            const updatedNav = (appConfig.menuItems || []).filter(
                              (m) => m.url !== page.id && m.url !== page.slug
                            );
                            onUpdateConfig({ ...appConfig, pages: updatedPages, menuItems: updatedNav });
                            showSaveFeedback(`Deleted page "${page.name}"`);
                          }}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          title="Delete Page"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ ...appConfig, pages: draftPages });
                    showSaveFeedback('Page names saved & published');
                  }}
                  className="w-full sm:w-auto bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save size={14} /> Save & Update Pages
                </button>
              </div>
              <div className="space-y-4 bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100">
                <h4 className="text-xs font-bold text-emerald-950 uppercase">CREATE NEW LANDING PAGE</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="text-[9px] font-mono text-emerald-700 block uppercase font-bold">Page Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Champions League Vault"
                      value={newPageName}
                      onChange={e => {
                        setNewPageName(e.target.value);
                        if (!newPageSlug) {
                          setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                        }
                      }}
                      className="w-full bg-white border border-emerald-200 rounded-xl py-2 px-4 text-xs font-semibold text-emerald-950"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-emerald-700 block uppercase font-bold">Unique URL Slug *</label>
                    <input
                      type="text"
                      placeholder="e.g. champions-league"
                      value={newPageSlug}
                      onChange={e => setNewPageSlug(e.target.value)}
                      className="w-full bg-white border border-emerald-200 rounded-xl py-2 px-4 text-xs font-mono text-emerald-950"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newPageName.trim() || !newPageSlug.trim()) return;
                      const cleanSlug = newPageSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
                      const nPage = { id: cleanSlug, name: newPageName.trim(), slug: cleanSlug, isCustom: true, visible: true, sections: [...(appConfig.homepageSections || [])] };
                      const newNav: MenuItem = {
                        id: `nav-page-${cleanSlug}`,
                        name: newPageName.trim(),
                        placement: 'Main Menu',
                        order: (appConfig.menuItems || []).length + 1,
                        url: cleanSlug,
                        status: 'Active',
                        icon: 'Trophy',
                        badgeText: 'NEW'
                      };
                      onUpdateConfig({
                        ...appConfig,
                        pages: [...(appConfig.pages || []), nPage],
                        menuItems: [...(appConfig.menuItems || []), newNav]
                      });
                      setNewPageName('');
                      setNewPageSlug('');
                      alert(`Custom page "${nPage.name}" created and published to navigation bar!`);
                    }}
                    className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase py-3 rounded-xl tracking-wider cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    <span>CREATE & PUBLISH PAGE</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODULE: menu-builder & mega-menu (Navigation Menu Builder) */}
          {(activeSidebarTab === 'menu-builder' || activeSidebarTab === 'mega-menu') && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-emerald-800 text-white font-mono text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">CMS SYSTEM</span>
                    <h3 className="text-lg font-black uppercase text-emerald-950 tracking-tight">NAVIGATION MENU BUILDER</h3>
                  </div>
                  <p className="text-xs text-emerald-700 font-mono mt-1">Edit menu structure, then Save or Update to publish to the live storefront.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({ ...appConfig, menuItems: draftMenuItems });
                      showSaveFeedback('Navigation menu saved');
                    }}
                    className="bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save size={14} /> Save Menu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateConfig({ ...appConfig, menuItems: draftMenuItems });
                      showSaveFeedback('Navigation menu updated & published');
                    }}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <RefreshCw size={14} /> Update Menu
                  </button>
                  <button
                  type="button"
                  onClick={() => {
                    const newItem: MenuItem = {
                      id: `nav-${Date.now()}`,
                      name: 'New Custom Menu',
                      placement: 'Main Menu',
                      parentId: null,
                      icon: 'Shirt',
                      order: draftMenuItems.length + 1,
                      url: '#listing',
                      status: 'Active',
                    };
                    setEditingMenuItem(newItem);
                    setIsAddingMenuItem(true);
                  }}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={16} />
                  <span>CREATE MENU ITEM</span>
                </button>
                </div>
              </div>

              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-emerald-700 uppercase font-bold">Total Menu Links</div>
                  <div className="text-2xl font-black text-emerald-950 font-display">{draftMenuItems.length}</div>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-emerald-700 uppercase font-bold">Main Header Menus</div>
                  <div className="text-2xl font-black text-emerald-800 font-display">
                    {draftMenuItems.filter(m => m.placement === 'Main Menu').length}
                  </div>
                </div>
                <div className="bg-amber-50/60 border border-amber-100 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-amber-700 uppercase font-bold">Mega Menu Links</div>
                  <div className="text-2xl font-black text-amber-900 font-display">
                    {draftMenuItems.filter(m => m.placement === 'Mega Menu').length}
                  </div>
                </div>
                <div className="bg-sky-50 border border-sky-200 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-sky-700 uppercase font-bold">Footer Navigation</div>
                  <div className="text-2xl font-black text-sky-900 font-display">
                    {draftMenuItems.filter(m => m.placement === 'Footer Menu').length}
                  </div>
                </div>
              </div>

              {/* PLACEMENT FILTER TABS */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {['All', 'Main Menu', 'Mega Menu', 'Footer Menu'].map((placement) => (
                  <button
                    key={placement}
                    type="button"
                    onClick={() => setMenuPlacementFilter(placement)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase whitespace-nowrap transition-all cursor-pointer ${
                      menuPlacementFilter === placement
                        ? 'bg-emerald-800 text-white shadow-sm'
                        : 'bg-white border border-emerald-100 text-emerald-900 hover:bg-emerald-50'
                    }`}
                  >
                    {placement === 'All' ? 'ALL MENUS' : placement}
                  </button>
                ))}
              </div>

              {/* MENU ITEMS HIERARCHICAL TREE VIEW */}
              <div className="space-y-4">
                {(() => {
                  const allMenuItems = draftMenuItems;
                  const filtered = allMenuItems
                    .filter((m) => menuPlacementFilter === 'All' || m.placement === menuPlacementFilter)
                    .sort((a, b) => a.order - b.order);

                  // Top level items (no parentId or parentId not matching any item in filtered)
                  const topLevel = filtered.filter((m) => !m.parentId);
                  const orphanChildren = filtered.filter((m) => m.parentId && !allMenuItems.some((p) => p.id === m.parentId));
                  const parentsToRender = [...topLevel, ...orphanChildren];

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white border border-emerald-100 rounded-2xl p-12 text-center space-y-3">
                        <Layers className="mx-auto text-emerald-400" size={36} />
                        <h4 className="text-sm font-bold text-emerald-950 uppercase">No menu items found in {menuPlacementFilter}</h4>
                        <p className="text-xs text-emerald-700 font-mono">Click "Create Menu Item" above to add custom menu links with icons and URLs.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {parentsToRender.map((parent) => {
                        const children = allMenuItems.filter((c) => c.parentId === parent.id).sort((a, b) => a.order - b.order);

                        return (
                          <div key={parent.id} className="bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                            {/* PARENT MENU ROW */}
                            <div className="p-4 bg-emerald-50/40 border-b border-emerald-100/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-mono text-xs font-bold shadow-sm">
                                  #{parent.order}
                                </div>
                                <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg flex items-center justify-center">
                                  {renderNavIcon(parent.icon, 18)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-emerald-950 uppercase tracking-tight">{parent.name}</h4>
                                    {parent.badgeText && (
                                      <span className="bg-emerald-500 text-emerald-950 font-mono text-[9px] font-black px-2 py-0.5 rounded uppercase">
                                        {parent.badgeText}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-700 mt-0.5">
                                    <span className="bg-emerald-200/60 text-emerald-950 px-2 py-0.5 rounded font-bold uppercase">{parent.placement}</span>
                                    <span>• Target URL: <strong className="text-emerald-900">{parent.url}</strong></span>
                                  </div>
                                </div>
                              </div>

                              {/* PARENT ACTIONS */}
                              <div className="flex items-center gap-1.5 self-end md:self-center">
                                <span className={`text-[9px] font-mono px-2.5 py-1 rounded-full uppercase font-bold mr-2 ${
                                  parent.status === 'Active' || parent.status === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {parent.status}
                                </span>

                                {/* Move Up/Down Order */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = allMenuItems.map((item) =>
                                      item.id === parent.id ? { ...item, order: Math.max(1, item.order - 1) } : item
                                    );
                                    setDraftMenuItems(updated);
                                  }}
                                  className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-all"
                                  title="Move Up"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = allMenuItems.map((item) =>
                                      item.id === parent.id ? { ...item, order: item.order + 1 } : item
                                    );
                                    setDraftMenuItems(updated);
                                  }}
                                  className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-all"
                                  title="Move Down"
                                >
                                  <ArrowDown size={14} />
                                </button>

                                {/* Add Child Subitem */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const childItem: MenuItem = {
                                      id: `nav-${Date.now()}`,
                                      name: `Sublink under ${parent.name}`,
                                      placement: parent.placement,
                                      parentId: parent.id,
                                      icon: 'Shirt',
                                      order: children.length + 1,
                                      url: '#listing',
                                      status: 'Active',
                                    };
                                    setEditingMenuItem(childItem);
                                    setIsAddingMenuItem(true);
                                  }}
                                  className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer text-xs font-bold flex items-center gap-1"
                                  title="Add Nested Subitem"
                                >
                                  <Plus size={14} />
                                  <span className="hidden sm:inline">Add Submenu</span>
                                </button>

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMenuItem({ ...parent });
                                    setIsAddingMenuItem(false);
                                  }}
                                  className="p-1.5 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer font-bold text-xs flex items-center gap-1"
                                  title="Edit Menu Item"
                                >
                                  <Edit size={14} />
                                  <span>Edit</span>
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const ok = await confirmAsync({
                                      title: 'Delete menu item',
                                      message: `Delete menu item "${parent.name}" and its sub-links?`,
                                      danger: true,
                                      confirmText: 'Delete',
                                    });
                                    if (!ok) return;
                                    const updated = allMenuItems.filter((m) => m.id !== parent.id && m.parentId !== parent.id);
                                    setDraftMenuItems(updated);
                                  }}
                                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Delete Menu Item"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* NESTED CHILDREN SUBMENU ROWS */}
                            {children.length > 0 && (
                              <div className="bg-emerald-50/20 p-3 space-y-2 border-t border-emerald-50">
                                {children.map((child) => (
                                  <div
                                    key={child.id}
                                    className="ml-4 md:ml-8 bg-white border border-emerald-100 rounded-xl p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-emerald-400 font-mono font-bold text-sm">└──</span>
                                      <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-900 flex items-center justify-center font-mono text-[10px] font-bold">
                                        #{child.order}
                                      </div>
                                      <div className="p-1.5 bg-emerald-50 text-emerald-800 rounded flex items-center justify-center">
                                        {renderNavIcon(child.icon, 14)}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-emerald-950">{child.name}</span>
                                          {child.badgeText && (
                                            <span className="bg-amber-100 text-amber-900 text-[8px] font-mono px-1.5 py-0.5 rounded font-black">
                                              {child.badgeText}
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] font-mono text-emerald-700 block">
                                          Parent: <strong className="text-emerald-900">{parent.name}</strong> | URL: {child.url}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 self-end md:self-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingMenuItem({ ...child });
                                          setIsAddingMenuItem(false);
                                        }}
                                        className="p-1 text-emerald-800 hover:bg-emerald-50 rounded font-bold text-[11px] flex items-center gap-1"
                                      >
                                        <Edit size={12} />
                                        <span>Edit</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const ok = await confirmAsync({
                                            title: 'Delete menu link',
                                            message: `Delete child menu item "${child.name}"?`,
                                            danger: true,
                                            confirmText: 'Delete',
                                          });
                                          if (!ok) return;
                                          const updated = allMenuItems.filter((m) => m.id !== child.id);
                                          setDraftMenuItems(updated);
                                        }}
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* EDIT / CREATE MENU ITEM MODAL */}
          {editingMenuItem && (
            <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white border border-emerald-100 rounded-3xl max-w-xl w-full p-6 space-y-6 shadow-2xl my-8">
                <div className="flex justify-between items-center border-b border-emerald-100 pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-emerald-700 uppercase font-bold tracking-widest">
                      {isAddingMenuItem ? 'CREATE NEW MENU LINK' : 'EDIT MENU ITEM CONFIGURATION'}
                    </span>
                    <h3 className="text-lg font-black uppercase text-emerald-950 font-display">
                      {editingMenuItem.name || 'MENU EDITOR'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingMenuItem(null)}
                    className="p-2 text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin">
                  {/* Menu Name */}
                  <div>
                    <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                      Menu Name
                    </label>
                    <input
                      type="text"
                      value={editingMenuItem.name}
                      onChange={(e) => setEditingMenuItem({ ...editingMenuItem, name: e.target.value })}
                      className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-bold text-emerald-950"
                      placeholder="e.g. World Cup Vault or Premier League"
                    />
                  </div>

                  {/* Menu Placement & Parent Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                        Placement Category
                      </label>
                      <select
                        value={editingMenuItem.placement}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, placement: e.target.value as MenuPlacement, parentId: null })}
                        className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Main Menu">Main Menu</option>
                        <option value="Mega Menu">Mega Menu</option>
                        <option value="Footer Menu">Footer Menu</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                        Parent Item (Nesting)
                      </label>
                      <select
                        value={editingMenuItem.parentId || ''}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, parentId: e.target.value ? e.target.value : null })}
                        className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">None (Top-Level Item)</option>
                        {(appConfig.menuItems || [])
                          .filter((m) => m.placement === editingMenuItem.placement && m.id !== editingMenuItem.id && !m.parentId)
                          .map((parent) => (
                            <option key={parent.id} value={parent.id}>
                              {parent.name} (#{parent.order})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Icon Selector Grid */}
                  <div>
                    <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                      Menu Icon Selection
                    </label>
                    <div className="grid grid-cols-5 gap-2 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                      {[
                        'Shirt', 'Trophy', 'Star', 'Flame', 'Sparkles', 'Tag', 'Box', 'Globe',
                        'ShieldCheck', 'Award', 'ShoppingBag', 'HelpCircle', 'Phone', 'Compass',
                        'Heart', 'Users', 'MapPin', 'Mail', 'Layers', 'Grid'
                      ].map((iconKey) => (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setEditingMenuItem({ ...editingMenuItem, icon: iconKey })}
                          className={`p-2.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[9px] font-mono transition-all cursor-pointer ${
                            editingMenuItem.icon === iconKey
                              ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600'
                              : 'bg-white border border-emerald-100 text-emerald-900 hover:bg-emerald-100'
                          }`}
                        >
                          {renderNavIcon(iconKey, 18)}
                          <span className="truncate max-w-full">{iconKey}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Order & Target Redirect URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                        Order Sequence
                      </label>
                      <input
                        type="number"
                        value={editingMenuItem.order}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, order: Number(e.target.value) })}
                        className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-mono font-bold text-emerald-950"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                        Target Redirect URL / Route
                      </label>
                      <input
                        type="text"
                        value={editingMenuItem.url}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, url: e.target.value })}
                        className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-mono text-emerald-950"
                        placeholder="e.g. All, World Cup, England, seller, faq, #listing"
                      />
                    </div>
                  </div>

                  {/* Badge Text & Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                        Badge Tag (Optional)
                      </label>
                      <input
                        type="text"
                        value={editingMenuItem.badgeText || ''}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, badgeText: e.target.value })}
                        className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-bold text-emerald-950"
                        placeholder="e.g. HOT, RARE, NEW"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-emerald-800 uppercase block font-bold mb-1">
                        Menu Status
                      </label>
                      <select
                        value={editingMenuItem.status}
                        onChange={(e) => setEditingMenuItem({ ...editingMenuItem, status: e.target.value as any })}
                        className="w-full bg-white border border-emerald-200 p-2.5 rounded-xl text-xs font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Save or Cancel */}
                <div className="flex justify-end gap-3 border-t border-emerald-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingMenuItem(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase text-emerald-800 hover:bg-emerald-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingMenuItem.name.trim()) {
                        alert('Please enter a menu name.');
                        return;
                      }
                      const existing = draftMenuItems;
                      let updated: MenuItem[];
                      if (isAddingMenuItem) {
                        updated = [...existing, editingMenuItem];
                      } else {
                        updated = existing.map((m) => (m.id === editingMenuItem.id ? editingMenuItem : m));
                      }
                      setDraftMenuItems(updated);
                      onUpdateConfig({ ...appConfig, menuItems: updated });
                      setEditingMenuItem(null);
                      setIsAddingMenuItem(false);
                      showSaveFeedback(isAddingMenuItem ? 'Menu item created & saved' : 'Menu item updated & saved');
                    }}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-2"
                  >
                    <Save size={16} />
                    <span>Save Menu Configuration</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODULE: header-builder */}
          {activeSidebarTab === 'header-builder' && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold uppercase text-emerald-950">HEADER CUSTOMIZER</h3>
                  <p className="text-[10px] text-emerald-700 font-mono">Edit logo text and exchange rate, then Save to publish.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ ...appConfig, logoText: draftLogoText, exchangeRate: draftExchangeRate });
                    showSaveFeedback('Header settings saved');
                  }}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save size={14} /> Save Header
                </button>
              </div>
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-mono text-emerald-700 block uppercase">Primary Company Logo Text</label>
                    <input type="text" value={draftLogoText} onChange={e => setDraftLogoText(e.target.value)} className="w-full bg-white border border-emerald-100 p-2.5 rounded-xl text-xs" />
                  </div>
                  <div>
                    <label className="text-[9px] font-mono text-emerald-700 block uppercase">Dhaka Exchange Rate (Taka per USD)</label>
                    <input type="number" value={draftExchangeRate} onChange={e => setDraftExchangeRate(Number(e.target.value))} className="w-full bg-white border border-emerald-100 p-2.5 rounded-xl text-xs font-mono" />
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-100">
                  <p className="text-[10px] text-emerald-700 font-mono mb-2">Live premium logo preview:</p>
                  <div className="brand-logo-lockup inline-flex items-center gap-2">
                    <img
                      src="/epic-vanskap-logo.png?v=1"
                      alt=""
                      className="w-7 h-7 rounded-lg object-contain bg-black"
                      width={28}
                      height={28}
                    />
                    <span className="brand-word brand-word-jersey">Epic</span>
                    <span className="brand-word brand-word-addicts">Vanskap</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULE: footer-builder */}
          {activeSidebarTab === 'footer-builder' && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold uppercase text-emerald-950">FOOTER BUILDER</h3>
                  <p className="text-[10px] text-emerald-700 font-mono">Customize about text and copyright, then Save.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateConfig({ ...appConfig, footerAbout: draftFooterAbout, footerCopyright: draftFooterCopyright });
                    showSaveFeedback('Footer settings saved');
                  }}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save size={14} /> Save Footer
                </button>
              </div>
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100 space-y-4">
                <div>
                  <label className="text-[9px] font-mono text-emerald-700 block uppercase">Footer About Us Story Text</label>
                  <textarea rows={3} value={draftFooterAbout} onChange={e => setDraftFooterAbout(e.target.value)} className="w-full bg-white border border-emerald-100 p-2.5 rounded-xl text-xs leading-relaxed" />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-emerald-700 block uppercase">Copyright Footnote Text</label>
                  <input type="text" value={draftFooterCopyright} onChange={e => setDraftFooterCopyright(e.target.value)} className="w-full bg-white border border-emerald-100 p-2.5 rounded-xl text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* MODULE: announcement-bar */}
          {activeSidebarTab === 'announcement-bar' && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4">
                <h3 className="text-base font-bold uppercase text-emerald-950">ANNOUNCEMENT BAR TICKER</h3>
                <p className="text-[10px] text-emerald-700 font-mono">Control the scrolling alert banner displayed at the absolute top of the client storefront.</p>
              </div>
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100 space-y-4">
                <div>
                  <label className="text-[9px] font-mono text-emerald-700 block uppercase">Ticker Announcement Text</label>
                  <input type="text" className="w-full bg-white border border-emerald-100 p-2.5 rounded-xl text-xs" defaultValue="VAULT SHIRTS RESTOCKED: EXHAUSTIVE VINTAGE ARRIVALS COMPLETED 12-POINT DHAKA micro-fabric tag checks!" />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-emerald-700 block uppercase">Announcements Marquee Speed (Seconds)</label>
                  <input type="number" className="w-full bg-white border border-emerald-100 p-2.5 rounded-xl text-xs font-mono" defaultValue={15} />
                </div>
                <button type="button" onClick={() => alert('Announcement bar updated!')} className="bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl">Inject Live Announcement Ticker</button>
              </div>
            </div>
          )}

          {/* MODULE: hero-slider & Banner Management Deck */}
          {(activeSidebarTab === 'hero-slider' || activeSidebarTab === 'banner-management') && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-800 text-white font-mono text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">DYNAMIC CMS</span>
                    <h3 className="text-lg font-black uppercase text-emerald-950 tracking-tight">BANNER MANAGEMENT DECK</h3>
                  </div>
                  <p className="text-xs text-emerald-700 font-mono mt-1">
                    Full backend control for Hero Slider, Category, Collection, League, Popup, Offer, Newsletter, Footer, Blog, and Mobile Banners.
                    {liveDb && (
                      <span className="block mt-1 text-emerald-700 font-bold">
                        Live database — title, subtitle, button are all optional. Changes save for all visitors.
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const newBanner: BannerConfig = {
                      id: `banner-${Date.now()}`,
                      name: 'New Promo Banner',
                      type: 'Hero Slider',
                      desktopImage: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1600',
                      tabletImage: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=1024',
                      mobileImage: 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=640',
                      title: '',
                      subtitle: '',
                      description: '',
                      cta: '',
                      ctaText: '',
                      buttonUrl: '',
                      productId: undefined,
                      openNewTab: false,
                      scheduleStart: new Date().toISOString().split('T')[0],
                      scheduleEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      status: 'Active',
                      sortOrder: (appConfig.banners || []).length,
                    };
                    setEditingBanner(newBanner);
                    setIsAddingBanner(true);
                    setBannerImageTab('desktop');
                  }}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest px-5 py-3 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-105"
                >
                  <Plus size={16} />
                  <span>CREATE NEW BANNER</span>
                </button>
              </div>

              {/* STATS OVERVIEW CARDS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-emerald-700 uppercase font-bold">Total Banners</div>
                  <div className="text-2xl font-black text-emerald-950 font-display">{(appConfig.banners || []).length}</div>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-emerald-700 uppercase font-bold">Active (live on site)</div>
                  <div className="text-2xl font-black text-emerald-800 font-display">
                    {(appConfig.banners || []).filter((b) => isBannerLive(b)).length}
                  </div>
                </div>
                <div className="bg-amber-50/60 border border-amber-100 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-amber-700 uppercase font-bold">Draft</div>
                  <div className="text-2xl font-black text-amber-900 font-display">
                    {(appConfig.banners || []).filter((b) => String(b.status || '').toLowerCase() === 'draft').length}
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <div className="text-[10px] font-mono text-slate-600 uppercase font-bold">Turned OFF</div>
                  <div className="text-2xl font-black text-slate-800 font-display">
                    {(appConfig.banners || []).filter((b) => String(b.status || '').toLowerCase() === 'inactive').length}
                  </div>
                </div>
              </div>

              {/* BANNER TYPE FILTER TABS */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {[
                  'All',
                  'Hero Slider',
                  'Category Banner',
                  'Collection Banner',
                  'League Banner',
                  'Popup Banner',
                  'Offer Banner',
                  'Newsletter Banner',
                  'Footer Banner',
                  'Blog Banner',
                  'Mobile Banner',
                ].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBannerCategoryFilter(type)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold uppercase whitespace-nowrap transition-all cursor-pointer ${
                      bannerCategoryFilter === type
                        ? 'bg-emerald-800 text-white shadow-sm'
                        : 'bg-white border border-emerald-100 text-emerald-900 hover:bg-emerald-50'
                    }`}
                  >
                    {type === 'All' ? 'ALL PLACEMENTS' : type}
                  </button>
                ))}
              </div>

              {/* BANNER CARDS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(appConfig.banners || [])
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .filter((b) => bannerCategoryFilter === 'All' || b.type === bannerCategoryFilter)
                  .map((banner) => {
                    const activeImg = banner.desktopImage || banner.image || 'https://images.unsplash.com/photo-1431324155629-1a6edd1dec1d?auto=format&fit=crop&q=80&w=800';
                    const isLive = isBannerLive(banner);

                    return (
                      <div
                        key={banner.id}
                        className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                          isLive ? 'border-emerald-100' : 'border-zinc-200'
                        }`}
                      >
                        <div>
                          {/* Banner Visual Header */}
                          <div className="relative h-48 bg-emerald-950 overflow-hidden group">
                            <img
                              src={activeImg}
                              alt={banner.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500 opacity-80"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-emerald-950/40 to-transparent p-4 flex flex-col justify-between">
                              <div className="flex justify-between items-start">
                                <span className="bg-emerald-900/90 backdrop-blur-md text-emerald-200 text-[10px] font-mono px-2.5 py-1 rounded-md border border-emerald-700/50 uppercase font-black">
                                  {banner.type || 'Hero Slider'} · P{(banner.sortOrder ?? 0) + 1}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-2.5 py-1 rounded-full uppercase font-black tracking-wider ${
                                    isLive
                                      ? 'bg-emerald-500 text-emerald-950'
                                      : banner.status === 'Draft' || banner.status === 'draft'
                                      ? 'bg-amber-400 text-amber-950'
                                      : 'bg-slate-700 text-slate-200'
                                  }`}
                                >
                                  {banner.status || 'Active'}
                                </span>
                              </div>
                              <div>
                                {banner.subtitle?.trim() && (
                                  <p className="text-[10px] font-mono text-emerald-300 uppercase tracking-widest font-bold">
                                    {banner.subtitle}
                                  </p>
                                )}
                                <h4 className="text-base font-black text-white uppercase tracking-tight line-clamp-1 font-display">
                                  {banner.title?.trim() || 'Image-only banner'}
                                </h4>
                              </div>
                            </div>
                          </div>

                          {/* Banner Body Specs */}
                          <div className="p-4 space-y-3 text-xs">
                            <p className="text-emerald-800 line-clamp-2 leading-relaxed">
                              {banner.description?.trim() || 'No description — image-only display on storefront.'}
                            </p>

                            {/* Responsive Images Thumbnails Indicator */}
                            <div className="grid grid-cols-3 gap-2 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/60 text-[9px] font-mono">
                              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                <span className="text-emerald-700 block uppercase font-bold">Desktop</span>
                                <span className="text-emerald-950">{banner.desktopImage ? '✓ Custom' : 'Default'}</span>
                              </div>
                              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                <span className="text-emerald-700 block uppercase font-bold">Tablet</span>
                                <span className="text-emerald-950">{banner.tabletImage ? '✓ Custom' : 'Default'}</span>
                              </div>
                              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                                <span className="text-emerald-700 block uppercase font-bold">Mobile</span>
                                <span className="text-emerald-950">{banner.mobileImage ? '✓ Custom' : 'Default'}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                              <div>
                                <span className="text-emerald-600 block uppercase text-[9px]">CTA Button</span>
                                <span className="font-bold text-emerald-950">{banner.cta || banner.ctaText || 'EXPLORE'}</span>
                              </div>
                              <div>
                                <span className="text-emerald-600 block uppercase text-[9px]">Target URL / Tab</span>
                                <span className="font-bold text-emerald-950 truncate block">
                                  {banner.buttonUrl || '#'} {banner.openNewTab ? '(New Tab ↗)' : ''}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-700 pt-1 border-t border-emerald-50">
                              <span>📅 Schedule Window:</span>
                              <span className="font-bold text-emerald-900">
                                {banner.scheduleStart || 'N/A'} — {banner.scheduleEnd || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Banner Card Actions */}
                        <div className="p-3 bg-emerald-50/30 border-t border-emerald-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              const newStatus = isLive ? 'Inactive' : 'Active';
                              const ok = await confirmAsync({
                                title: isLive ? 'Turn banner OFF' : 'Turn banner ON',
                                message: isLive
                                  ? `"${banner.title?.trim() || 'This banner'}" will be hidden from the homepage for all visitors.`
                                  : `"${banner.title?.trim() || 'This banner'}" will show on the homepage again.`,
                                confirmText: isLive ? 'Turn OFF' : 'Turn ON',
                                danger: isLive,
                              });
                              if (!ok) return;

                              // Functional update — avoid stale appConfig wiping other fields
                              const applyBanners = (banners: BannerConfig[]) => {
                                onUpdateConfig((prev) => ({ ...prev, banners }));
                              };

                              const optimistic = (appConfig.banners || []).map((b) =>
                                b.id === banner.id ? { ...b, status: newStatus as BannerConfig['status'] } : b,
                              );
                              applyBanners(optimistic);

                              // Keep carousel cache in sync so Hero Slides editor can't resurrect OFF heroes
                              const liveHeroes = optimistic.filter(
                                (b) =>
                                  (b.type === 'Hero Slider' || String(b.id || '').startsWith('banner-hero')) &&
                                  isBannerLive(b),
                              );
                              if (liveHeroes.length === 0) {
                                setSlides([]);
                              }

                              if (isApiEnabled() && getToken()) {
                                try {
                                  await api.updateBanner(banner.id, {
                                    ...normalizeBannerPayload({ ...banner, status: newStatus as BannerConfig['status'] }),
                                    status: newStatus,
                                  });
                                  toast(
                                    isLive ? 'Banner turned OFF — hidden on homepage' : 'Banner turned ON — live on homepage',
                                    'success',
                                  );
                                  const refreshed = await api.listBanners();
                                  if (refreshed.items?.length) {
                                    const items = refreshed.items as BannerConfig[];
                                    applyBanners(items);
                                    const stillLive = items.filter(
                                      (b) =>
                                        (b.type === 'Hero Slider' || String(b.id || '').startsWith('banner-hero')) &&
                                        isBannerLive(b),
                                    );
                                    if (stillLive.length === 0) setSlides([]);
                                  }
                                } catch (err) {
                                  applyBanners(appConfig.banners || []);
                                  toast(err instanceof Error ? err.message : 'Failed to update banner status', 'error');
                                }
                              } else {
                                toast(isLive ? 'Banner turned OFF' : 'Banner turned ON', 'success');
                              }
                            }}
                            className={`text-[10px] font-mono px-3 py-1.5 rounded-lg uppercase font-bold transition-all cursor-pointer ${
                              isLive
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                                : 'bg-emerald-800 hover:bg-emerald-900 text-white'
                            }`}
                          >
                            {isLive ? 'Turn OFF' : 'Turn ON'}
                          </button>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBanner({ ...banner });
                                setIsAddingBanner(false);
                                setBannerImageTab('desktop');
                              }}
                              className="p-2 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer font-bold text-xs flex items-center gap-1"
                              title="Edit Banner"
                            >
                              <Edit size={14} />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const dup: BannerConfig = {
                                  ...banner,
                                  id: `banner-${Date.now()}`,
                                  title: banner.title ? `${banner.title} (COPY)` : '',
                                  status: 'Draft',
                                  sortOrder: (appConfig.banners || []).length,
                                };
                                const updated = [...(appConfig.banners || []), dup];
                                updateBannersConfig(updated, 'Banner duplicated');
                              }}
                              className="p-2 text-emerald-800 hover:bg-emerald-100 rounded-lg transition-all cursor-pointer"
                              title="Duplicate Banner"
                            >
                              <Sparkles size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const label = banner.title?.trim() || 'this banner';
                                const ok = await confirmAsync({
                                  title: 'Delete banner',
                                  message: `Are you sure you want to delete banner "${label}"? This cannot be undone.`,
                                  danger: true,
                                  confirmText: 'Delete banner',
                                });
                                if (!ok) return;
                                const updated = (appConfig.banners || []).filter((b) => b.id !== banner.id);
                                updateBannersConfig(updated, 'Banner deleted for all visitors');
                                toast('Banner deleted', 'success');
                              }}
                              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                              title="Delete Banner"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* EDIT / CREATE BANNER MODAL */}
          {editingBanner && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-6">
              <div className="bg-white sm:rounded-2xl w-full max-w-6xl max-h-[94vh] shadow-2xl flex flex-col overflow-hidden border border-zinc-200">
                {/* Header */}
                <div className="flex items-center justify-between gap-4 px-5 sm:px-7 py-4 border-b border-zinc-100 shrink-0">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em] font-bold">
                      {isAddingBanner ? 'Create banner' : 'Edit banner'}
                    </p>
                    <h3 className="text-lg font-black text-zinc-900 truncate mt-0.5">
                      {editingBanner.title?.trim() || 'Banner editor'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBanner(null);
                      setIsAddingBanner(false);
                      setBannerImageTab('desktop');
                    }}
                    className="h-9 w-9 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 lg:grid-cols-2 min-h-0">
                    {/* LEFT — form */}
                    <div className="px-5 sm:px-7 py-6 space-y-6 border-b lg:border-b-0 lg:border-r border-zinc-100">
                      <section className="space-y-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Basics</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">Placement</label>
                            <select
                              value={editingBanner.type}
                              onChange={(e) => setEditingBanner({ ...editingBanner, type: e.target.value as BannerType })}
                              className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            >
                              <option value="Hero Slider">Hero Slider</option>
                              <option value="Category Banner">Category Banner</option>
                              <option value="Collection Banner">Collection Banner</option>
                              <option value="League Banner">League Banner</option>
                              <option value="Popup Banner">Popup Banner</option>
                              <option value="Offer Banner">Offer Banner</option>
                              <option value="Newsletter Banner">Newsletter Banner</option>
                              <option value="Footer Banner">Footer Banner</option>
                              <option value="Blog Banner">Blog Banner</option>
                              <option value="Mobile Banner">Mobile Banner</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">Status</label>
                            <select
                              value={editingBanner.status}
                              onChange={(e) => setEditingBanner({ ...editingBanner, status: e.target.value as any })}
                              className="w-full bg-zinc-50 border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            >
                              <option value="Active">Active</option>
                              <option value="Inactive">Inactive</option>
                              <option value="Draft">Draft</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">
                              Title <span className="text-zinc-400 font-normal">optional</span>
                            </label>
                            <input
                              type="text"
                              value={editingBanner.title || ''}
                              onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                              placeholder="Leave empty for image-only"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">
                              Subtitle <span className="text-zinc-400 font-normal">optional</span>
                            </label>
                            <input
                              type="text"
                              value={editingBanner.subtitle || ''}
                              onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                              placeholder="Short line under title"
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-zinc-700">
                            Description <span className="text-zinc-400 font-normal">optional</span>
                          </label>
                          <textarea
                            rows={2}
                            value={editingBanner.description}
                            onChange={(e) => setEditingBanner({ ...editingBanner, description: e.target.value })}
                            className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            placeholder="Promotional copy…"
                          />
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Link & CTA</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">CTA label</label>
                            <input
                              type="text"
                              value={editingBanner.cta || editingBanner.ctaText || ''}
                              onChange={(e) => setEditingBanner({ ...editingBanner, cta: e.target.value, ctaText: e.target.value })}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                              placeholder="SHOP NOW"
                            />
                          </div>
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">Button URL</label>
                            <input
                              type="text"
                              value={editingBanner.buttonUrl || ''}
                              onChange={(e) => setEditingBanner({ ...editingBanner, buttonUrl: e.target.value })}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                              placeholder="listing · product:id · about"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">Linked product</label>
                            <select
                              value={editingBanner.productId || ''}
                              onChange={(e) => {
                                const pid = e.target.value;
                                setEditingBanner({
                                  ...editingBanner,
                                  productId: pid || undefined,
                                  buttonUrl: pid ? `product:${pid}` : editingBanner.buttonUrl || 'listing',
                                });
                              }}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            >
                              <option value="">None</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">
                              Priority <span className="text-zinc-400 font-normal">lower = first</span>
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={editingBanner.sortOrder ?? 0}
                              onChange={(e) =>
                                setEditingBanner({ ...editingBanner, sortOrder: Math.max(0, Number(e.target.value) || 0) })
                              }
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            />
                          </div>
                        </div>
                        <label className="inline-flex items-center gap-2.5 cursor-pointer select-none pt-1">
                          <input
                            type="checkbox"
                            checked={editingBanner.openNewTab}
                            onChange={(e) => setEditingBanner({ ...editingBanner, openNewTab: e.target.checked })}
                            className="h-4 w-4 rounded border-zinc-300 text-emerald-800 focus:ring-emerald-700"
                          />
                          <span className="text-sm text-zinc-700">Open link in a new tab</span>
                        </label>
                      </section>

                      <section className="space-y-3">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Schedule</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">Start</label>
                            <input
                              type="date"
                              value={editingBanner.scheduleStart}
                              onChange={(e) => setEditingBanner({ ...editingBanner, scheduleStart: e.target.value })}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-zinc-700">End</label>
                            <input
                              type="date"
                              value={editingBanner.scheduleEnd}
                              onChange={(e) => setEditingBanner({ ...editingBanner, scheduleEnd: e.target.value })}
                              className="w-full bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                            />
                          </div>
                        </div>
                      </section>
                    </div>

                    {/* RIGHT — single image editor with tabs */}
                    <div className="px-5 sm:px-7 py-6 bg-zinc-50/80 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-zinc-900">Cover image</h4>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Exact sizes for web, tablet &amp; mobile — always use width × height in px
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const specs = getBannerPixelSpecs(editingBanner.type);
                        return (
                          <div className="rounded-xl border border-zinc-200 bg-white p-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {([
                              ['desktop', specs.desktop],
                              ['tablet', specs.tablet],
                              ['mobile', specs.mobile],
                            ] as const).map(([key, spec]) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setBannerImageTab(key)}
                                className={`text-left rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                                  bannerImageTab === key
                                    ? 'border-zinc-950 bg-zinc-950 text-white'
                                    : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-400'
                                }`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                  {spec.label}
                                </p>
                                <p className="text-[13px] font-bold tabular-nums mt-0.5">
                                  {formatBannerPx(spec)}
                                </p>
                                <p className={`text-[10px] mt-0.5 ${bannerImageTab === key ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                  Height {spec.height}px · Width {spec.width}px
                                </p>
                              </button>
                            ))}
                          </div>
                        );
                      })()}

                      <div className="inline-flex rounded-lg bg-white border border-zinc-200 p-1 gap-0.5">
                        {([
                          { key: 'desktop' as const, label: 'Desktop' },
                          { key: 'tablet' as const, label: 'Tablet' },
                          { key: 'mobile' as const, label: 'Mobile' },
                        ]).map((tab) => {
                          const hasImg =
                            tab.key === 'desktop'
                              ? !!editingBanner.desktopImage
                              : tab.key === 'tablet'
                                ? !!editingBanner.tabletImage
                                : !!editingBanner.mobileImage;
                          const spec = getBannerPixelSpecs(editingBanner.type)[tab.key];
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setBannerImageTab(tab.key)}
                              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                                bannerImageTab === tab.key
                                  ? 'bg-emerald-800 text-white'
                                  : 'text-zinc-600 hover:bg-zinc-100'
                              }`}
                            >
                              {tab.label}
                              {hasImg ? ' ·' : ''}
                              <span className={`ml-1 font-mono font-semibold ${bannerImageTab === tab.key ? 'text-emerald-100' : 'text-zinc-400'}`}>
                                {spec.height}px
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {(() => {
                        const specs = getBannerPixelSpecs(editingBanner.type);
                        const activeSpec = specs[bannerImageTab];
                        const slot =
                          bannerImageTab === 'desktop'
                            ? {
                                key: 'desktop' as const,
                                label: 'Desktop',
                                hint: `${activeSpec.label} cover · exact ${formatBannerPx(activeSpec)} (height ${activeSpec.height}px)`,
                                value: editingBanner.desktopImage,
                                onUrl: (v: string) =>
                                  setEditingBanner({
                                    ...editingBanner,
                                    desktopImage: v,
                                    image: v,
                                    tabletImage: editingBanner.tabletImage || v,
                                    mobileImage: editingBanner.mobileImage || v,
                                  }),
                                maxEdge: Math.max(activeSpec.width, activeSpec.height),
                                quality: 0.8,
                                maxBytes: 900_000,
                                canCopy: false,
                              }
                            : bannerImageTab === 'tablet'
                              ? {
                                  key: 'tablet' as const,
                                  label: 'Tablet',
                                  hint: `${activeSpec.label} cover · exact ${formatBannerPx(activeSpec)} (height ${activeSpec.height}px)`,
                                  value: editingBanner.tabletImage,
                                  onUrl: (v: string) => setEditingBanner({ ...editingBanner, tabletImage: v }),
                                  maxEdge: Math.max(activeSpec.width, activeSpec.height),
                                  quality: 0.78,
                                  maxBytes: 850_000,
                                  canCopy: true,
                                }
                              : {
                                  key: 'mobile' as const,
                                  label: 'Mobile',
                                  hint: `${activeSpec.label} cover · exact ${formatBannerPx(activeSpec)} (height ${activeSpec.height}px)`,
                                  value: editingBanner.mobileImage,
                                  onUrl: (v: string) => setEditingBanner({ ...editingBanner, mobileImage: v }),
                                  maxEdge: Math.max(activeSpec.width, activeSpec.height),
                                  quality: 0.78,
                                  maxBytes: 750_000,
                                  canCopy: true,
                                };

                        const preview =
                          slot.value &&
                          !String(slot.value).startsWith('data:') &&
                          (String(slot.value).startsWith('http') || String(slot.value).startsWith('/'))
                            ? slot.value
                            : '';

                        return (
                          <div className="space-y-3">
                            <div
                              className={`relative rounded-xl overflow-hidden border border-zinc-200 bg-zinc-200/60 shadow-inner ${activeSpec.aspectClass}`}
                            >
                              {preview ? (
                                <img
                                  src={preview}
                                  alt={`${slot.label} preview`}
                                  className="absolute inset-0 w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).style.opacity = '0';
                                  }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
                                  <Image size={32} strokeWidth={1.5} />
                                  <p className="text-xs font-medium">No image yet</p>
                                  <p className="text-[11px] font-mono font-semibold text-zinc-500">
                                    {formatBannerPx(activeSpec)}
                                  </p>
                                </div>
                              )}
                              {bannerUploading && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-sm font-bold text-emerald-900">
                                  Uploading…
                                </div>
                              )}
                              <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5 justify-between pointer-events-none">
                                <span className="inline-flex items-center rounded-md bg-black/75 text-white text-[11px] font-bold px-2 py-1 tabular-nums">
                                  {formatBannerPx(activeSpec)}
                                </span>
                                <span className="inline-flex items-center rounded-md bg-black/75 text-white text-[11px] font-semibold px-2 py-1">
                                  Height {activeSpec.height}px
                                </span>
                              </div>
                            </div>

                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 space-y-1">
                              <p className="text-[12px] font-bold text-emerald-950">{slot.hint}</p>
                              <p className="text-[11px] text-emerald-800 font-mono">
                                Width {activeSpec.width}px · Height {activeSpec.height}px · JPG/PNG/WebP
                              </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={slot.value || ''}
                                onChange={(e) => slot.onUrl(e.target.value)}
                                className="flex-1 min-w-0 bg-white border border-zinc-200 px-3 py-2.5 rounded-lg text-xs font-mono text-zinc-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                                placeholder="https://res.cloudinary.com/…"
                              />
                              <div className="flex gap-2 shrink-0">
                                {slot.canCopy && (
                                  <button
                                    type="button"
                                    onClick={() => slot.onUrl(editingBanner.desktopImage)}
                                    className="px-3 py-2.5 rounded-lg text-xs font-bold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 cursor-pointer"
                                  >
                                    Copy desktop
                                  </button>
                                )}
                                <label className="inline-flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer">
                                  <Upload size={14} />
                                  Upload
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={bannerUploading}
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      e.target.value = '';
                                      if (!file) return;
                                      if (!file.type.startsWith('image/')) {
                                        toast('Please upload an image file.', 'error');
                                        return;
                                      }
                                      if (file.size > 5 * 1024 * 1024) {
                                        toast('Image must be under 5MB.', 'error');
                                        return;
                                      }
                                      setBannerUploading(true);
                                      try {
                                        const url = await uploadStoreImage(file, 'banners', {
                                          maxEdge: slot.maxEdge,
                                          quality: slot.quality,
                                          maxBytes: slot.maxBytes,
                                        });
                                        slot.onUrl(url);
                                        toast(`${slot.label} image uploaded`, 'success');
                                      } catch (err) {
                                        toast(err instanceof Error ? err.message : 'Upload failed', 'error');
                                      } finally {
                                        setBannerUploading(false);
                                      }
                                    }}
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Mini status of all sizes */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {(
                                [
                                  ['desktop', editingBanner.desktopImage, specs.desktop],
                                  ['tablet', editingBanner.tabletImage, specs.tablet],
                                  ['mobile', editingBanner.mobileImage, specs.mobile],
                                ] as const
                              ).map(([key, src, spec]) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setBannerImageTab(key)}
                                  className={`rounded-lg border overflow-hidden text-left cursor-pointer transition-colors ${
                                    bannerImageTab === key
                                      ? 'border-emerald-700 ring-1 ring-emerald-700/30'
                                      : 'border-zinc-200 hover:border-zinc-300'
                                  }`}
                                >
                                  <div className={`bg-zinc-100 relative ${spec.aspectClass} max-h-16`}>
                                    {src && (src.startsWith('http') || src.startsWith('/')) ? (
                                      <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                                        <Image size={14} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="px-2 py-1.5 bg-white">
                                    <p className="text-[10px] font-bold text-zinc-700">{spec.label}</p>
                                    <p className="text-[10px] font-mono font-semibold text-zinc-950 tabular-nums">
                                      {formatBannerPx(spec)}
                                    </p>
                                    <p className="text-[9px] text-zinc-500">H {spec.height}px</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-zinc-100 bg-white shrink-0">
                  <p className="text-xs text-zinc-500 hidden sm:block">
                    Desktop cover required · sizes show exact width × height px (height always listed)
                  </p>
                  <div className="flex gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBanner(null);
                        setIsAddingBanner(false);
                        setBannerImageTab('desktop');
                      }}
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingBanner.desktopImage?.trim()) {
                          toast('Desktop image is required.', 'error');
                          setBannerImageTab('desktop');
                          return;
                        }
                        const normalized = normalizeBannerPayload(editingBanner);
                        const existing = appConfig.banners || [];
                        let updated: BannerConfig[];
                        if (isAddingBanner) {
                          updated = [...existing, normalized];
                        } else {
                          updated = existing.map((b) => (b.id === normalized.id ? normalized : b));
                        }
                        updateBannersConfig(updated, 'Banner saved for all visitors');
                        setEditingBanner(null);
                        setIsAddingBanner(false);
                        setBannerImageTab('desktop');
                        toast('Banner saved', 'success');
                      }}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm px-6 py-2.5 rounded-lg cursor-pointer flex items-center gap-2"
                    >
                      <Save size={16} />
                      Save banner
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODULES: leagues, clubs, national-teams */}
          {['leagues', 'clubs', 'national-teams'].includes(activeSidebarTab) && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4">
                <h3 className="text-base font-bold uppercase text-emerald-950">{activeSidebarTab.toUpperCase()} REGISTRY & DATABASE</h3>
                <p className="text-[10px] text-emerald-700 font-mono">Configure verified database catalog profiles, categories, and tags in real-time.</p>
              </div>

              {activeSidebarTab === 'leagues' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-black text-emerald-950 uppercase">Hot Deals / Flash Offer</h4>
                      <button
                        type="button"
                        onClick={toggleDailyDealVisibility}
                        className={`text-[9px] font-black uppercase px-3 py-1 rounded-full cursor-pointer ${
                          dailyDealVisible ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {dailyDealVisible ? 'Visible' : 'Hidden'}
                      </button>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-mono">
                      Manage multiple hot-deal products and fixed prices under{' '}
                      <span className="font-black">Homepage Sections</span>.
                    </p>
                    {flashDealItems.length > 0 ? (
                      <ul className="space-y-1">
                        {flashDealItems.map((deal) => {
                          const product = flashOfferProducts.find((p) => p.id === deal.productId);
                          return (
                            <li key={deal.productId} className="text-[10px] font-mono text-emerald-900">
                              {deal.isHotDeal ? '🔥 ' : ''}
                              {product?.name || deal.productId} — deal ৳
                              {Math.round(deal.dealPrice).toLocaleString()}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-[10px] font-mono text-rose-700">No hot deals configured yet.</p>
                    )}
                  </div>

                  <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-emerald-950 uppercase">Shop By Football League Logos</h4>
                      <span className="text-[10px] font-mono text-emerald-700">Inline marks always work • optional custom URL</span>
                    </div>
                    <div className="space-y-3">
                      {(appConfig.leagues && appConfig.leagues.length > 0 ? appConfig.leagues : DEFAULT_LEAGUES).map((league) => (
                        <div key={league.id} className="bg-white p-4 rounded-xl border border-emerald-100 space-y-3">
                          <div className="flex items-center gap-3">
                            <LeagueLogo league={league} className="h-12 w-12 shrink-0" />
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={league.name}
                                onChange={(e) => {
                                  const updated = (appConfig.leagues || DEFAULT_LEAGUES).map((l) =>
                                    l.id === league.id ? { ...l, name: e.target.value } : l
                                  );
                                  onUpdateConfig({ ...appConfig, leagues: updated });
                                }}
                                className="w-full bg-emerald-50/40 border border-emerald-100 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-950"
                              />
                              <input
                                type="url"
                                placeholder="Optional custom logo URL (falls back to built-in mark)"
                                value={league.logoUrl || ''}
                                onChange={(e) => {
                                  const updated = (appConfig.leagues || DEFAULT_LEAGUES).map((l) =>
                                    l.id === league.id ? { ...l, logoUrl: e.target.value || undefined } : l
                                  );
                                  onUpdateConfig({ ...appConfig, leagues: updated as LeagueConfigItem[] });
                                }}
                                className="w-full bg-emerald-50/40 border border-emerald-100 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-emerald-800"
                              />
                            </div>
                            <div className="flex flex-col gap-2 items-end">
                              <input
                                type="number"
                                value={league.count}
                                onChange={(e) => {
                                  const updated = (appConfig.leagues || DEFAULT_LEAGUES).map((l) =>
                                    l.id === league.id ? { ...l, count: Number(e.target.value) || 0 } : l
                                  );
                                  onUpdateConfig({ ...appConfig, leagues: updated });
                                }}
                                className="w-16 bg-emerald-50/40 border border-emerald-100 rounded-lg px-2 py-1 text-[10px] font-mono text-right"
                                title="Verified shirt count"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (appConfig.leagues || DEFAULT_LEAGUES).map((l) =>
                                    l.id === league.id
                                      ? { ...l, status: l.status === 'Active' ? 'Inactive' : 'Active' }
                                      : l
                                  ) as LeagueConfigItem[];
                                  onUpdateConfig({ ...appConfig, leagues: updated });
                                }}
                                className={`text-[9px] font-black uppercase px-2 py-1 rounded-full cursor-pointer ${
                                  league.status === 'Active' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {league.status}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onUpdateConfig({ ...appConfig, leagues: DEFAULT_LEAGUES })}
                      className="text-[10px] font-mono font-bold text-emerald-800 underline cursor-pointer"
                    >
                      Reset league logos to defaults
                    </button>
                  </div>
                </div>
              )}

              {activeSidebarTab !== 'leagues' && (
              <div className="bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100 space-y-4">
                <h4 className="text-xs font-bold text-emerald-950 uppercase">Registered Football Entities</h4>
                <div className="space-y-2">
                  {activeSidebarTab === 'clubs' && clubsList.map((item) => (
                    <div key={item.id} className="bg-white p-3 rounded-xl border border-emerald-100 flex justify-between items-center text-xs">
                      <span className="font-bold">{item.badge} {item.name}</span>
                      <span className="font-mono text-emerald-700 text-[10px]">Status: {item.status}</span>
                    </div>
                  ))}
                  {activeSidebarTab === 'national-teams' && (
                    <p className="text-[10px] text-emerald-700 font-mono py-4 text-center">
                      Manage homepage banners, products, and league logos from Banner Management / Product Management / Leagues tabs.
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>
          )}

          {/* MODULE: product-management */}
          {activeSidebarTab === 'product-management' && (
            <ProductManager
              products={products}
              setProducts={setProducts}
              appConfig={appConfig}
              onUpdateConfig={onUpdateConfig}
              formatPrice={formatPrice}
              onRequireStaffLogin={onRequireStaffLogin}
            />
          )}

          {activeSidebarTab === 'pos' && (
            <PosPanel
              products={products}
              setProducts={setProducts}
              orders={orders}
              setOrders={setOrders}
              customers={customers}
              setCustomers={setCustomers}
              formatPrice={formatPrice}
              staffName={staffName}
              shopName={appConfig?.logoText || 'Epic Vanskap'}
              shopAddress={appConfig?.footerLocations?.[0]?.address}
              shopPhone={appConfig?.footerLocations?.[0]?.phone}
            />
          )}

          {activeSidebarTab === 'sales' && (
            <SalesPanel
              orders={orders}
              setOrders={setOrders}
              formatPrice={formatPrice}
              staffName={staffName}
              shopName={appConfig?.logoText || 'Epic Vanskap'}
              shopAddress={appConfig?.footerLocations?.[0]?.address}
              shopPhone={appConfig?.footerLocations?.[0]?.phone}
            />
          )}

          {activeSidebarTab === 'expenses' && (
            <AccountsExpensesPanel formatPrice={formatPrice} initialTab="expenses" />
          )}

          {activeSidebarTab === 'accounts' && (
            <AccountsExpensesPanel formatPrice={formatPrice} initialTab="accounts" />
          )}

          {/* MODULE: customers */}
          {activeSidebarTab === 'customers' && (
            <CustomersPanel
              customers={customers}
              setCustomers={setCustomers}
              orders={orders}
              formatPrice={formatPrice}
            />
          )}

          {/* MODULE: orders (Order Management Hub) */}
          {activeSidebarTab === 'orders' && (
            <div className="space-y-6">
              {/* Header & Title */}
              <div className="border-b border-emerald-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase text-emerald-950 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-emerald-800" />
                    Order Management Command Center
                  </h3>
                  <p className="text-xs text-emerald-700 font-mono">
                    Full-lifecycle e-commerce order control: Statuses, Invoices, Customer details, Shipping Address, Tracking, Timelines & Admin Notes.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {!liveDb && (
                    <button
                      type="button"
                      onClick={() => handleAddSimulatedOrders(9)}
                      className="bg-emerald-950 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Plus size={14} />
                      <span>Load 9 Orders (All Statuses)</span>
                    </button>
                  )}
                  {liveDb && (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl">
                      Live Neon orders ({orders.length})
                    </span>
                  )}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowOrderNotifPanel((v) => !v)}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <Bell size={14} />
                      <span>Notifications</span>
                      {orderNotifications.filter((n) => !n.read).length > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                          {orderNotifications.filter((n) => !n.read).length}
                        </span>
                      )}
                    </button>
                    {showOrderNotifPanel && (
                      <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-emerald-100 rounded-2xl shadow-2xl z-40 p-3 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] font-black uppercase text-emerald-900">Order alerts</span>
                          <button
                            type="button"
                            className="text-[10px] text-emerald-700 underline"
                            onClick={() =>
                              setOrderNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
                            }
                          >
                            Mark all read
                          </button>
                        </div>
                        {orderNotifications.length === 0 ? (
                          <p className="text-[11px] text-emerald-700 font-mono py-4 text-center">No new order notifications yet.</p>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-1.5">
                            {orderNotifications.map((n) => (
                              <button
                                key={`${n.id}-${n.at}`}
                                type="button"
                                onClick={() => {
                                  setOrderNotifications((prev) =>
                                    prev.map((x) => (x.id === n.id && x.at === n.at ? { ...x, read: true } : x)),
                                  );
                                  setOrderSearchQuery(n.id);
                                  setShowOrderNotifPanel(false);
                                }}
                                className={`w-full text-left px-2.5 py-2 rounded-xl border text-[11px] cursor-pointer ${
                                  n.read ? 'bg-white border-emerald-50 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-950 font-semibold'
                                }`}
                              >
                                <span className="block">{n.message}</span>
                                <span className="text-[9px] font-mono opacity-70">{n.at}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <select
                    value={orderDownloadRange}
                    onChange={(e) => setOrderDownloadRange(e.target.value as typeof orderDownloadRange)}
                    className="bg-white border border-emerald-200 text-emerald-900 text-xs font-bold px-2 py-2 rounded-xl cursor-pointer"
                  >
                    <option value="all">All orders</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="date">Specific date</option>
                  </select>
                  {orderDownloadRange === 'date' && (
                    <input
                      type="date"
                      value={orderDownloadDate}
                      onChange={(e) => setOrderDownloadDate(e.target.value)}
                      className="bg-white border border-emerald-200 text-emerald-900 text-xs font-bold px-2 py-2 rounded-xl"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleExportCSVReport}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Download size={14} />
                    <span>Download order list</span>
                  </button>
                </div>
              </div>

              {/* Top Order KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">Total Orders</span>
                  <span className="text-xl font-black text-emerald-950 mt-1 block">{orders.length}</span>
                </div>
                <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-800 block">Pending Action</span>
                  <span className="text-xl font-black text-amber-950 mt-1 block">
                    {orders.filter((o) => ['Pending', 'Confirmed', 'Packed', 'Ready to Ship'].includes(o.status)).length}
                  </span>
                </div>
                <div className="bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100">
                  <span className="text-[10px] font-mono uppercase font-bold text-sky-800 block">Shipped & Transit</span>
                  <span className="text-xl font-black text-sky-950 mt-1 block">
                    {orders.filter((o) => o.status === 'Shipped').length}
                  </span>
                </div>
                <div className="bg-emerald-100/70 p-3.5 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-900 block">Delivered</span>
                  <span className="text-xl font-black text-emerald-950 mt-1 block">
                    {orders.filter((o) => o.status === 'Delivered').length}
                  </span>
                </div>
                <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100">
                  <span className="text-[10px] font-mono uppercase font-bold text-rose-800 block">Returned / Cancel</span>
                  <span className="text-xl font-black text-rose-950 mt-1 block">
                    {orders.filter((o) => ['Cancelled', 'Returned', 'Refund Request'].includes(o.status)).length}
                  </span>
                </div>
                <div className="bg-amber-100/50 p-3.5 rounded-2xl border border-amber-200">
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-900 block">Order Value Sum</span>
                  <span className="text-base font-black text-amber-950 mt-1 block truncate">
                    {formatPrice(orders.reduce((s, o) => s + o.total, 0))}
                  </span>
                </div>
              </div>

              {/* Status Filter Tabs (9 Statuses + All) */}
              <div className="space-y-3 bg-white p-4 rounded-3xl border border-emerald-100 shadow-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                  <span className="uppercase tracking-wider font-mono text-[10px]">Filter Order Status Pipeline:</span>
                  <span className="text-[10px] font-mono text-emerald-700">
                    Showing {orders.filter((o) => (orderFilterStatus === 'All' || o.status === orderFilterStatus) && (!orderSearchQuery || o.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) || (o.shippingAddress?.fullName || '').toLowerCase().includes(orderSearchQuery.toLowerCase()) || (o.shippingAddress?.phone || '').includes(orderSearchQuery))).length} of {orders.length} Total
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                  {[
                    'All', 'Pending', 'Confirmed', 'Packed', 
                    'Ready to Ship', 'Shipped', 'Delivered', 
                    'Cancelled', 'Returned', 'Refund Request'
                  ].map((status) => {
                    const count = status === 'All' 
                      ? orders.length 
                      : orders.filter((o) => o.status === status).length;
                    const isActive = orderFilterStatus === status;

                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setOrderFilterStatus(status)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                          isActive
                            ? 'bg-emerald-950 text-white border-emerald-950 shadow-sm'
                            : 'bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 border-emerald-100'
                        }`}
                      >
                        <span>{status}</span>
                        <span className={`px-2 py-0.2 text-[9px] font-mono font-black rounded-full ${
                          isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-200/60 text-emerald-900'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Bar */}
                <div className="relative w-full pt-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700" />
                  <input
                    type="text"
                    placeholder="Search by Order ID, Customer Name, Phone, Email, Tracking ID, Jersey item..."
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="w-full bg-emerald-50/30 border border-emerald-200 rounded-xl pl-9 pr-8 py-2 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-medium"
                  />
                  {orderSearchQuery && (
                    <button 
                      type="button" 
                      onClick={() => setOrderSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-950 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Order Management Main Table */}
              <div className="border border-emerald-100 rounded-2xl overflow-hidden overflow-x-auto shadow-xs bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-emerald-950 text-white text-[10px] font-mono uppercase tracking-wider">
                      <th className="py-3.5 px-4">Order ID</th>
                      <th className="py-3.5 px-4">Sale Date / Time</th>
                      <th className="py-3.5 px-4">Wait</th>
                      <th className="py-3.5 px-4">Customer & Address</th>
                      <th className="py-3.5 px-4">Items & Custom Print</th>
                      <th className="py-3.5 px-4">Carrier & Tracking</th>
                      <th className="py-3.5 px-4 text-center">Pipeline Status</th>
                      <th className="py-3.5 px-4 text-right">Invoice Sum</th>
                      <th className="py-3.5 px-4 text-center">Desk Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-50">
                    {orders.filter((o) => {
                      const matchesStatus = orderFilterStatus === 'All' || o.status === orderFilterStatus;
                      const q = orderSearchQuery.toLowerCase().trim();
                      const matchesSearch = !q || 
                        o.id.toLowerCase().includes(q) ||
                        (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
                        (o.shippingAddress?.phone || '').toLowerCase().includes(q) ||
                        (o.shippingAddress?.email || '').toLowerCase().includes(q) ||
                        (o.trackingNumber || '').toLowerCase().includes(q) ||
                        o.items?.some(i => (i.product?.name || '').toLowerCase().includes(q));
                      return matchesStatus && matchesSearch;
                    }).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-xs font-mono text-emerald-700 bg-emerald-50/20">
                          No orders matched current filter "{orderFilterStatus}". Click "Load 9 Orders" above to populate test data!
                        </td>
                      </tr>
                    ) : (
                      orders
                        .filter((o) => {
                          const matchesStatus = orderFilterStatus === 'All' || o.status === orderFilterStatus;
                          const q = orderSearchQuery.toLowerCase().trim();
                          const matchesSearch = !q || 
                            o.id.toLowerCase().includes(q) ||
                            (o.shippingAddress?.fullName || '').toLowerCase().includes(q) ||
                            (o.shippingAddress?.phone || '').toLowerCase().includes(q) ||
                            (o.shippingAddress?.email || '').toLowerCase().includes(q) ||
                            (o.trackingNumber || '').toLowerCase().includes(q) ||
                            o.items?.some(i => (i.product?.name || '').toLowerCase().includes(q));
                          return matchesStatus && matchesSearch;
                        })
                        .slice()
                        .sort((a, b) => {
                          const ta = parseOrderDate(a)?.getTime() || 0;
                          const tb = parseOrderDate(b)?.getTime() || 0;
                          return tb - ta;
                        })
                        .map((o) => (
                          <tr key={o.id} className="hover:bg-emerald-50/40 transition-colors">
                            {/* Order ID */}
                            <td className="py-3.5 px-4">
                              <span className="font-mono font-black text-emerald-950 block text-xs">{o.id}</span>
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[9px] font-mono text-emerald-900 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded font-extrabold uppercase">
                                  {o.paymentMethod || 'Cash on Delivery'}
                                </span>
                                {o.paymentStatus && (
                                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold uppercase ${
                                    o.paymentStatus === 'Paid' ? 'bg-emerald-800 text-white' : 'bg-amber-100 text-amber-900'
                                  }`}>
                                    {o.paymentStatus}
                                  </span>
                                )}
                                {(o.customerNotes?.includes('PRE-ORDER') ||
                                  o.items?.some((i) => i.product?.isPreOrder)) && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-extrabold uppercase bg-amber-500 text-white">
                                    Pre-Order
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Sale Date / Time — always shown */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-[13px] font-bold text-zinc-950 block">
                                {formatOrderClock(o)}
                              </span>
                              <span className="text-[10px] text-zinc-700 font-semibold block mt-0.5">
                                Online order
                              </span>
                            </td>

                            {/* Wait / Time Needed */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-black font-mono ${
                                  ['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                                    ? 'text-emerald-700'
                                    : 'text-amber-800'
                                }`}
                              >
                                <Clock size={12} />
                                {formatOrderWait(o)}
                              </span>
                              <span className="block text-[9px] text-emerald-700 font-mono mt-0.5">
                                {['Delivered', 'Cancelled', 'Returned'].includes(o.status)
                                  ? 'Closed'
                                  : 'Needs action'}
                              </span>
                            </td>

                            {/* Customer & Address */}
                            <td className="py-3.5 px-4 max-w-[200px]">
                              <span className="font-extrabold text-emerald-950 block text-xs">{o.shippingAddress?.fullName}</span>
                              <span className="text-[10px] font-mono text-emerald-700 block truncate">{o.shippingAddress?.addressLine1}, {o.shippingAddress?.city}</span>
                              <span className="text-[10px] text-emerald-900 font-mono block font-bold">{o.shippingAddress?.phone}</span>
                            </td>

                            {/* Purchased Items */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1 max-w-[220px]">
                                {o.items?.map((item, idx) => (
                                  <div key={idx} className="text-[11px] leading-tight border-b border-emerald-50/80 last:border-0 pb-1 last:pb-0">
                                    <span className="font-black text-emerald-950 block truncate">✓ {item.product?.name || 'Jersey Kit'}</span>
                                    <div className="text-[9px] text-emerald-700 font-mono flex items-center gap-1">
                                      <span>Size: <b>{item.selectedSize}</b></span>
                                      <span>• Qty: <b>{item.quantity}</b></span>
                                      {item.addBadge && <span className="text-amber-800 font-bold bg-amber-50 px-1 rounded">Badge</span>}
                                      {item.customPrint?.name && <span className="text-blue-800 font-bold bg-blue-50 px-1 rounded">Custom #{item.customPrint.number}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            {/* Tracking & Carrier */}
                            <td className="py-3.5 px-4 font-mono text-[10px]">
                              {o.trackingNumber ? (
                                <div>
                                  <span className="font-bold text-emerald-950 block">{o.carrier || 'Steadfast Courier'}</span>
                                  <span className="text-emerald-700 font-bold block">{o.trackingNumber}</span>
                                  {o.trackingUrl && (
                                    <a
                                      href={o.trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[9px] text-blue-700 hover:underline flex items-center gap-1 font-bold mt-0.5"
                                    >
                                      <span>Track Package</span>
                                      <ExternalLink size={9} />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-zinc-400 italic">No tracking set</span>
                              )}
                            </td>

                            {/* Status Quick Dropdown */}
                            <td className="py-3.5 px-4 text-center">
                              <select
                                value={o.status}
                                onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                                className={`text-[10px] font-mono font-black uppercase px-2.5 py-1 rounded-xl border cursor-pointer focus:outline-none ${
                                  o.status === 'Pending' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                                  o.status === 'Confirmed' ? 'bg-blue-100 text-blue-900 border-blue-300' :
                                  o.status === 'Packed' ? 'bg-indigo-100 text-indigo-900 border-indigo-300' :
                                  o.status === 'Ready to Ship' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                                  o.status === 'Shipped' ? 'bg-sky-100 text-sky-900 border-sky-300' :
                                  o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
                                  o.status === 'Cancelled' ? 'bg-rose-100 text-rose-900 border-rose-300' :
                                  o.status === 'Returned' ? 'bg-orange-100 text-orange-900 border-orange-300' :
                                  'bg-violet-100 text-violet-900 border-violet-300'
                                }`}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Packed">Packed</option>
                                <option value="Ready to Ship">Ready to Ship</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                                <option value="Cancelled">Cancelled</option>
                                <option value="Returned">Returned</option>
                                <option value="Refund Request">Refund Request</option>
                              </select>
                            </td>

                            {/* Total Price */}
                            <td className="py-3.5 px-4 text-right font-black text-emerald-950 font-mono text-xs">
                              {formatPrice(o.total)}
                            </td>

                            {/* Desk Actions */}
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenOrderModal(o)}
                                  className="bg-emerald-950 hover:bg-black text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                >
                                  <Eye size={12} />
                                  <span>Manage</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDownloadInvoiceForOrder(o)}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[10px] font-bold px-2 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                                >
                                  <Download size={12} />
                                  <span>Invoice</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Locations: multi-outlet cards (same data as storefront footer / homepage) */}
          {activeSidebarTab === 'locations' && (
            <div className="space-y-6">
              <div className="border-b border-emerald-100 pb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold uppercase text-emerald-950">Physical Outlet Cards</h3>
                  <p className="text-[10px] text-emerald-700 font-mono">
                    Add multiple outlets — shown on homepage store section, footer, and contact page for all visitors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const copy = [...(appConfig.footerLocations || [])];
                    copy.push({ city: `Outlet ${copy.length + 1}`, address: '', phone: '+880 ' });
                    onUpdateConfig({ ...appConfig, footerLocations: copy });
                    showSaveFeedback('Outlet card added — save brand settings to sync for all users');
                  }}
                  className="bg-emerald-800 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer"
                >
                  + Add Outlet
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(appConfig.footerLocations || []).map((loc, idx) => (
                  <div key={idx} className="bg-white border border-emerald-100 p-5 rounded-2xl space-y-3 shadow-sm relative">
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-black text-emerald-950 uppercase">{loc.city || `Outlet ${idx + 1}`}</h4>
                      {(appConfig.footerLocations || []).length > 1 && (
                        <button
                          type="button"
                          className="text-[10px] font-bold text-rose-600 cursor-pointer"
                          onClick={() => {
                            onUpdateConfig({
                              ...appConfig,
                              footerLocations: (appConfig.footerLocations || []).filter((_, i) => i !== idx),
                            });
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      className="w-full border border-emerald-100 rounded-xl px-3 py-2 text-xs"
                      value={loc.city}
                      onChange={(e) => {
                        const copy = [...(appConfig.footerLocations || [])];
                        copy[idx] = { ...copy[idx], city: e.target.value };
                        onUpdateConfig({ ...appConfig, footerLocations: copy });
                      }}
                      placeholder="Outlet name"
                    />
                    <textarea
                      className="w-full border border-emerald-100 rounded-xl px-3 py-2 text-xs"
                      rows={2}
                      value={loc.address}
                      onChange={(e) => {
                        const copy = [...(appConfig.footerLocations || [])];
                        copy[idx] = { ...copy[idx], address: e.target.value };
                        onUpdateConfig({ ...appConfig, footerLocations: copy });
                      }}
                      placeholder="Address"
                    />
                    <input
                      className="w-full border border-emerald-100 rounded-xl px-3 py-2 text-xs font-mono"
                      value={loc.phone}
                      onChange={(e) => {
                        const copy = [...(appConfig.footerLocations || [])];
                        copy[idx] = { ...copy[idx], phone: e.target.value };
                        onUpdateConfig({ ...appConfig, footerLocations: copy });
                      }}
                      placeholder="Phone / helpline"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 1: MANAGE ORDER DETAILS OVERLAY      */}
      {/* ========================================== */}
      {selectedOrderForModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-emerald-100 max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-6 relative animate-fadeIn">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-emerald-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-emerald-800 uppercase bg-emerald-50 px-2 py-0.5 rounded">ORDER DETAILS</span>
                  <span className="font-mono text-lg font-black text-emerald-950">{selectedOrderForModal.id}</span>
                  {(selectedOrderForModal.customerNotes?.includes('PRE-ORDER') ||
                    selectedOrderForModal.items?.some((i) => i.product?.isPreOrder)) && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded font-extrabold uppercase bg-amber-500 text-white">
                      Pre-Order
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-700 font-mono mt-0.5">
                  Placed on {formatOrderClock(selectedOrderForModal)} • Customer: <span className="font-bold text-emerald-950">{selectedOrderForModal.shippingAddress?.fullName}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceOrder(selectedOrderForModal);
                    setIsInvoiceModalOpen(true);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-200 cursor-pointer flex items-center gap-1"
                >
                  <Printer size={14} />
                  <span>Print Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOrderForModal(null)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 p-2 rounded-full cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Quick Status Pipeline Transition Buttons */}
            <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-2">
              <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 block">Fast Pipeline Status Transition:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Pending', 'Confirmed', 'Packed', 'Ready to Ship', 
                  'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refund Request'
                ].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleUpdateOrderStatus(selectedOrderForModal.id, st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedOrderForModal.status === st
                        ? 'bg-emerald-950 text-white border-emerald-950 shadow-xs'
                        : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    {selectedOrderForModal.status === st ? `✓ ${st}` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Grid: Customer Info & Shipping Address */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Profile Card */}
              <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 space-y-2">
                <h4 className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                  <UserCheck size={14} className="text-emerald-800" />
                  <span>Customer Information</span>
                </h4>
                <div className="text-xs space-y-1 font-mono">
                  <p><span className="text-emerald-700">Full Name:</span> <b className="text-emerald-950">{selectedOrderForModal.shippingAddress?.fullName}</b></p>
                  <p><span className="text-emerald-700">Phone Contact:</span> <b className="text-emerald-950">{selectedOrderForModal.shippingAddress?.phone}</b></p>
                  <p><span className="text-emerald-700">Email Address:</span> <b className="text-emerald-950">{selectedOrderForModal.shippingAddress?.email || 'customer@vault.bd'}</b></p>
                  <p><span className="text-emerald-700">Payment Mode:</span> <b className="text-emerald-950 uppercase">{selectedOrderForModal.paymentMethod}</b></p>
                  {selectedOrderForModal.bkashPaymentType && (
                    <p>
                      <span className="text-emerald-700">bKash Type:</span>{' '}
                      <b className={`font-mono ${selectedOrderForModal.bkashPaymentType === 'partial' ? 'text-amber-800' : 'text-[#E2136E]'}`}>
                        {selectedOrderForModal.bkashPaymentType === 'partial'
                          ? 'PARTIAL ADVANCE'
                          : 'FULL PAY'}
                      </b>
                    </p>
                  )}
                  {selectedOrderForModal.bkashPaidAmount != null && (
                    <p>
                      <span className="text-emerald-700">bKash Amount Now:</span>{' '}
                      <b className="text-[#E2136E] font-mono">
                        ৳{Math.round(selectedOrderForModal.bkashPaidAmount).toLocaleString()}
                      </b>
                      {selectedOrderForModal.bkashPaymentType === 'partial' && (
                        <span className="text-emerald-800">
                          {' '}
                          · due later ৳
                          {Math.round(
                            Math.max(
                              0,
                              (selectedOrderForModal.total || 0) -
                                (selectedOrderForModal.bkashPaidAmount || 0),
                            ),
                          ).toLocaleString()}
                        </span>
                      )}
                    </p>
                  )}
                  {selectedOrderForModal.bkashNumber && (
                    <p><span className="text-emerald-700">bKash From:</span> <b className="text-emerald-950 font-mono">{selectedOrderForModal.bkashNumber}</b></p>
                  )}
                  {selectedOrderForModal.bkashTransactionId && (
                    <p><span className="text-emerald-700">bKash TrxID:</span> <b className="text-[#E2136E] font-mono uppercase">{selectedOrderForModal.bkashTransactionId}</b></p>
                  )}
                </div>
              </div>

              {/* Shipping Address Card */}
              <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 space-y-2">
                <h4 className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                  <MapPin size={14} className="text-emerald-800" />
                  <span>Shipping Address & Region</span>
                </h4>
                <div className="text-xs space-y-1 font-mono">
                  <p><span className="text-emerald-700">Street Address:</span> <b className="text-emerald-950">{selectedOrderForModal.shippingAddress?.addressLine1}</b></p>
                  <p><span className="text-emerald-700">City / District:</span> <b className="text-emerald-950">{selectedOrderForModal.shippingAddress?.city}</b></p>
                  <p><span className="text-emerald-700">Postal Code:</span> <b className="text-emerald-950">{selectedOrderForModal.shippingAddress?.postalCode || '1212'}</b></p>
                  <p><span className="text-emerald-700">Delivery Zone:</span> <b className="text-emerald-950 uppercase">{selectedOrderForModal.deliveryRegion === 'inside' ? 'Inside Dhaka (৳70)' : 'Outside Dhaka Courier (৳130)'}</b></p>
                </div>
              </div>
            </div>

            {/* Purchased Items List */}
            <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-xs">
              <div className="bg-emerald-950 text-white text-xs font-black uppercase tracking-wider py-2.5 px-4 flex justify-between items-center">
                <span>Purchased Kit Items</span>
                <span>{selectedOrderForModal.items?.length || 0} Products</span>
              </div>
              <div className="p-4 divide-y divide-emerald-50">
                {selectedOrderForModal.items?.map((item, idx) => (
                  <div key={idx} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-50 rounded-xl overflow-hidden border border-emerald-100 flex items-center justify-center shrink-0">
                        {item.product?.image ? (
                          <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Shirt size={20} className="text-emerald-800" />
                        )}
                      </div>
                      <div>
                        <h5 className="font-extrabold text-xs text-emerald-950">{item.product?.name || 'Dhaka Retro Jersey'}</h5>
                        <div className="flex flex-wrap gap-2 text-[10px] text-emerald-800 font-mono mt-0.5">
                          <span>Size: <b>{item.selectedSize}</b></span>
                          <span>Qty: <b>{item.quantity}</b></span>
                          {item.addBadge && <span className="text-amber-800 font-bold bg-amber-50 px-1 rounded">✓ Badge</span>}
                          {item.customPrint?.name && (
                            <span className="text-blue-800 font-bold bg-blue-50 px-1 rounded">
                              Print: #{item.customPrint.number} {item.customPrint.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-black text-xs font-mono text-emerald-950">
                      {formatPrice((item.product?.price || 0) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Invoice Summary Footer */}
              <div className="bg-emerald-50/50 p-4 border-t border-emerald-100 flex flex-col sm:flex-row justify-between items-end gap-3 text-xs font-mono">
                <div className="text-[10px] text-emerald-700 space-y-0.5">
                  <p>Delivery: ৳{selectedOrderForModal.deliveryCharge || (selectedOrderForModal.deliveryRegion === 'inside' ? 70 : 130)}</p>
                  <p>Delivery Fee: ৳{selectedOrderForModal.deliveryCharge || (selectedOrderForModal.deliveryRegion === 'inside' ? 70 : 130)}</p>
                  {selectedOrderForModal.bkashPaymentType === 'partial' && (
                    <>
                      <p className="text-[#E2136E] font-black">
                        bKash advance: ৳{Math.round(selectedOrderForModal.bkashPaidAmount || 0).toLocaleString()}
                      </p>
                      <p className="text-amber-800 font-black">
                        Due on delivery: ৳
                        {Math.round(
                          Math.max(
                            0,
                            (selectedOrderForModal.total || 0) -
                              (selectedOrderForModal.bkashPaidAmount || 0),
                          ),
                        ).toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-emerald-800 block">
                    {selectedOrderForModal.bkashPaymentType === 'partial'
                      ? 'ORDER TOTAL'
                      : 'GRAND TOTAL INVOICE'}
                  </span>
                  <span className="text-lg font-black text-emerald-950">{formatPrice(selectedOrderForModal.total)}</span>
                  {selectedOrderForModal.bkashPaymentType === 'partial' && (
                    <span className="block text-[10px] font-black text-[#E2136E] mt-1">
                      Pay now ৳{Math.round(selectedOrderForModal.bkashPaidAmount || 0).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Logistics & Courier Tracking (Editable) */}
            <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 space-y-3">
              <h4 className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                <Truck size={14} className="text-emerald-800" />
                <span>Courier Logistics & Tracking Desk</span>
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-mono text-emerald-800 font-bold uppercase mb-1">Carrier Courier</label>
                  <select
                    value={editingCarrier}
                    onChange={(e) => setEditingCarrier(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-bold"
                  >
                    <option value="Steadfast Courier">Steadfast Courier</option>
                    <option value="RedX Logistics">RedX Logistics</option>
                    <option value="Pathao Courier">Pathao Courier</option>
                    <option value="Paperfly">Paperfly</option>
                    <option value="DHL Express">DHL Express</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-800 font-bold uppercase mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={editingTrackingNumber}
                    onChange={(e) => setEditingTrackingNumber(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-800 font-bold uppercase mb-1">Tracking URL</label>
                  <input
                    type="text"
                    value={editingTrackingUrl}
                    onChange={(e) => setEditingTrackingUrl(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-mono text-[10px]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-800 font-bold uppercase mb-1">Shipped Date</label>
                  <input
                    type="text"
                    value={editingShippedDate}
                    onChange={(e) => setEditingShippedDate(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-emerald-800 font-bold uppercase mb-1">Est. Delivery</label>
                  <input
                    type="text"
                    value={editingEstDelivery}
                    onChange={(e) => setEditingEstDelivery(e.target.value)}
                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-mono"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleSaveOrderLogistics(selectedOrderForModal.id)}
                    className="w-full bg-emerald-950 hover:bg-black text-white text-xs font-bold py-2 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1"
                  >
                    <Save size={12} />
                    <span>Save Tracking Info</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Timeline Audit Trail */}
            <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100 space-y-3">
              <h4 className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                <Clock size={14} className="text-emerald-800" />
                <span>Order Timeline & Lifecycle History</span>
              </h4>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {selectedOrderForModal.timeline?.map((evt) => (
                  <div key={evt.id} className="bg-white p-2.5 rounded-xl border border-emerald-100 text-xs flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-emerald-950 uppercase">{evt.status}</span>
                        <span className="text-[9px] text-emerald-700 font-mono">by {evt.updatedBy || 'System'}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">{evt.note}</p>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-600 whitespace-nowrap">{evt.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer Notes & Internal Staff Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Checkout Instructions */}
              <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-amber-900 block">Customer Checkout Instructions:</span>
                <p className="text-xs text-amber-950 font-mono italic">
                  "{selectedOrderForModal.customerNotes || 'No special delivery instructions provided during checkout.'}"
                </p>
              </div>

              {/* Internal Admin Notes */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-emerald-900 block">Internal Staff Secret Notes:</span>
                <textarea
                  rows={2}
                  value={editingInternalNotes}
                  onChange={(e) => setEditingInternalNotes(e.target.value)}
                  placeholder="Add internal notes for staff (e.g., Verified phone call, Collector preference)..."
                  className="w-full bg-white border border-emerald-200 rounded-xl p-2 text-xs text-emerald-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveInternalNotes(selectedOrderForModal.id)}
                  className="bg-emerald-950 hover:bg-black text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1"
                >
                  <Save size={10} />
                  <span>Save Internal Notes</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: OFFICIAL PRINTABLE INVOICE        */}
      {/* ========================================== */}
      {isInvoiceModalOpen && invoiceOrder && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-zinc-900 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-8 shadow-2xl space-y-6 relative border-4 border-emerald-900">
            
            {/* Modal Controls */}
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <span className="font-mono text-xs font-black uppercase text-emerald-900">
                Official Dhaka Jersey Vault Invoice
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>Print Official Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 p-2 rounded-full cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Invoice Header */}
            <div className="flex justify-between items-start border-b-2 border-emerald-900 pb-6">
              <div>
                <h2 className="text-xl font-black uppercase text-emerald-950 tracking-tight">DHAKA JERSEY VAULT</h2>
                <p className="text-xs text-zinc-600">Authentic Retro & Match-Issue Football Kits</p>
                <p className="text-[11px] text-zinc-500 font-mono mt-1">Bailey Road HQ, Dhaka-1217, Bangladesh</p>
                <p className="text-[11px] text-zinc-500 font-mono">Hotline: +880 1840-990700 | dhakajersey.bd</p>
              </div>

              <div className="text-right font-mono">
                <span className="bg-emerald-900 text-white text-[10px] font-bold px-2 py-1 rounded uppercase block mb-1">
                  INVOICE RECEIPT
                </span>
                <p className="text-sm font-black text-emerald-950">{invoiceOrder.id}</p>
                <p className="text-[11px] text-zinc-600">Date: {invoiceOrder.date}</p>
                <p className="text-[11px] text-zinc-600">Status: <b className="uppercase text-emerald-900">{invoiceOrder.status}</b></p>
              </div>
            </div>

            {/* Billed To Customer */}
            <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-2xl border border-zinc-200 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-zinc-500 font-bold block">CUSTOMER / BILLED TO:</span>
                <p className="font-extrabold text-zinc-900 text-sm mt-0.5">{invoiceOrder.shippingAddress?.fullName}</p>
                <p className="text-zinc-700">{invoiceOrder.shippingAddress?.addressLine1}</p>
                <p className="text-zinc-700">{invoiceOrder.shippingAddress?.city}, Bangladesh</p>
                <p className="text-zinc-700">Phone: {invoiceOrder.shippingAddress?.phone}</p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase text-zinc-500 font-bold block">LOGISTICS & DISPATCH:</span>
                <p className="font-bold text-zinc-900 mt-0.5">Carrier: {invoiceOrder.carrier || 'Steadfast Courier'}</p>
                <p className="text-zinc-700">Tracking #: {invoiceOrder.trackingNumber || 'PENDING'}</p>
                <p className="text-zinc-700">Payment: <b className="uppercase">{invoiceOrder.paymentMethod}</b></p>
                <p className="text-zinc-700">Payment Status: <b className="uppercase text-emerald-800">{invoiceOrder.paymentStatus || 'UNPAID'}</b></p>
              </div>
            </div>

            {/* Itemized Table */}
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-emerald-900 text-white text-[10px] uppercase">
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-center">Size</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 border-b border-zinc-200">
                {invoiceOrder.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3 px-3">
                      <span className="font-bold text-zinc-900 block">{item.product?.name || 'Jersey Kit'}</span>
                      {item.customPrint?.name && (
                        <span className="text-[10px] text-zinc-600 block">Custom Print: #{item.customPrint.number} {item.customPrint.name}</span>
                      )}
                      {item.addBadge && (
                        <span className="text-[10px] text-amber-800 font-bold block">+ Sleeve Honor Badge</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center font-bold">{item.selectedSize}</td>
                    <td className="py-3 px-3 text-center">{item.quantity}</td>
                    <td className="py-3 px-3 text-right">{formatPrice(item.product?.price || 0)}</td>
                    <td className="py-3 px-3 text-right font-bold">{formatPrice((item.product?.price || 0) * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Calculations */}
            <div className="flex justify-between items-start font-mono text-xs">
              <div className="max-w-xs space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">AUTHENTICITY GUARANTEE & STAMP</span>
                <p className="text-[10px] text-zinc-600 leading-normal">
                  All kits undergo 10-point archival inspection in Dhaka. 7-day hassle-free replacement policy applies for genuine issues.
                </p>
              </div>

              <div className="w-56 space-y-1 text-right border-t border-zinc-200 pt-2">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal:</span>
                  <span>{formatPrice(invoiceOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Delivery Charge:</span>
                  <span>৳{invoiceOrder.deliveryCharge || (invoiceOrder.deliveryRegion === 'inside' ? 70 : 130)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-emerald-950 border-t border-zinc-900 pt-1 mt-1">
                  <span>TOTAL DUE:</span>
                  <span>{formatPrice(invoiceOrder.total)}</span>
                </div>
              </div>
            </div>

            {/* Signature & Barcode footer */}
            <div className="border-t-2 border-dashed border-zinc-300 pt-6 flex justify-between items-center text-[10px] font-mono text-zinc-500">
              <div>
                <p className="font-bold text-zinc-800">Verified by Dispatch Officer</p>
                <p>Dhaka Jersey Vault Warehouse</p>
              </div>
              <div className="text-right">
                <span className="tracking-widest font-bold text-xs text-zinc-900 block">||| | |||| | |||||| | ||</span>
                <span>*{invoiceOrder.id}*</span>
              </div>
            </div>

          </div>
        </div>
      )}

        </div>
      </div>
    </section>
  );
};
