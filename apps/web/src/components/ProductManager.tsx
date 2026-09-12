import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Edit, Trash2, Copy, Upload, Download, 
  Search, Filter, Layers, Grid, FileText, Check, X, AlertTriangle, 
  Shirt, Tag, Trophy, Star, Sparkles, Image as ImageIcon, CheckCircle, 
  ChevronRight, ArrowUp, ArrowDown, FolderPlus, Eye, ShieldCheck, DollarSign,
  AlertCircle, History, Package, Flame, Flag, Zap, Shield, Activity, Award,
  Box, CornerDownRight, CheckSquare, RefreshCw, BadgeCheck
} from 'lucide-react';
import { Product, AppConfig, CategoryItem, StockLog, ProductBadgeOption } from '../types';
import {
  ensureCategoryForSection,
  ensureHomepageRowsForCategories,
  isProductRowSection,
  resolveSectionCategory,
} from '../lib/homepageSections';
import { canonicalTargetPageId, canonicalTargetPageName } from '../lib/storefrontPages';
import { api, getToken, isApiEnabled } from '../lib/apiClient';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';
import {
  DEFAULT_BADGE_LABEL,
  DEFAULT_BADGE_PRICE_BDT,
  DEFAULT_NAMESET_LABEL,
  DEFAULT_NAMESET_PRICE_BDT,
  createDefaultBadgeOptions,
  getProductBadgeOptions,
  normalizeBadgeOptionsList,
} from '../lib/productAddons';
import { uploadStoreImage } from '../lib/cloudinaryUpload';
import {
  getAllSizeCharts,
  getSizeChartById,
  imageUploadLimitForCategory,
  inferSizeChartId,
} from '../lib/sizeCharts';
import {
  calcDiscountAmount,
  calcDiscountPercent,
  calcSalePrice,
  type DiscountMode,
} from '../lib/productPricing';
import {
  DEFAULT_FALLBACK_SIZES,
  KIDS_PRODUCT_SIZES,
  STANDARD_PRODUCT_SIZES,
} from '../lib/productSizes';
import { confirmAsync, toast } from './UiFeedback';
import { ensureUniqueBarcode, nextSerialEan13, nextSkuSequence, normalizeBarcode } from '../lib/retailCodes';
import { BarcodeLabelPrint } from './admin/BarcodeLabelPrint';

/** Search keywords under product photos — admin can add up to this many. */
const MAX_PRODUCT_TAGS = 20;

function parseTagDraft(raw: string): string[] {
  return raw
    .split(/[;,\n]+/)
    .map((t) => t.trim().replace(/^#/, ''))
    .filter(Boolean);
}

function mergeTags(prev: string[], parts: string[], max = MAX_PRODUCT_TAGS): string[] {
  const next = [...prev];
  for (const part of parts) {
    if (next.length >= max) break;
    if (next.some((t) => t.toLowerCase() === part.toLowerCase())) continue;
    next.push(part);
  }
  return next.slice(0, max);
}

interface ProductManagerProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  appConfig: AppConfig;
  onUpdateConfig?: (newConfig: AppConfig) => void;
  setAppConfig?: React.Dispatch<React.SetStateAction<AppConfig>>;
  formatPrice: (amount: number) => string;
  onRequireStaffLogin?: () => void;
  /** Notifies parent when the add/edit product dialog is open (to keep it mounted / block nav). */
  onProductEditorOpenChange?: (open: boolean) => void;
}

// Preset Category Icons list
const CATEGORY_ICONS = [
  { id: 'Trophy', label: 'Trophy', icon: Trophy },
  { id: 'Shirt', label: 'Shirt', icon: Shirt },
  { id: 'Star', label: 'Star', icon: Star },
  { id: 'Flame', label: 'Flame', icon: Flame },
  { id: 'Flag', label: 'Flag', icon: Flag },
  { id: 'Zap', label: 'Zap', icon: Zap },
  { id: 'Package', label: 'Package', icon: Package },
  { id: 'Tag', label: 'Tag', icon: Tag },
  { id: 'Shield', label: 'Shield', icon: Shield },
  { id: 'Activity', label: 'Activity', icon: Activity },
  { id: 'Award', label: 'Award', icon: Award },
];

/** Empty-string friendly money field so users can clear and type freely (integers only). */
type MoneyValue = number | '';

const PRODUCT_BRANDS = [
  'Nike',
  'Adidas',
  'Puma',
  'Umbro',
  'New Balance',
  'Under Armour',
  'Kappa',
  'Castore',
  'Hummel',
  'Joma',
  'Macron',
  'Other',
] as const;

/** Parse money/qty drafts — integers only (no 1500.500). */
function parseMoneyDraft(raw: string, max?: number): MoneyValue {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  // Strip everything except digits (blocks fractions / decimals)
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return '';
  let next = Math.max(0, Math.floor(Number(digits)));
  if (!Number.isFinite(next)) return '';
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
}

function moneyNumber(v: MoneyValue): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

function MoneyField({
  label,
  value,
  onChange,
  onBlur,
  min = 0,
  max,
  required,
  hint,
  readOnly,
  className = '',
  placeholder = 'Type amount',
}: {
  label: string;
  value: MoneyValue;
  onChange: (next: MoneyValue) => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
  required?: boolean;
  hint?: string;
  readOnly?: boolean;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={className}>
      <label className="font-bold text-emerald-950 block mb-1 font-sans">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        required={required}
        readOnly={readOnly}
        value={value === '' ? '' : String(value)}
        onChange={(e) => onChange(parseMoneyDraft(e.target.value, max))}
        onBlur={onBlur}
        className="w-full min-w-0 bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-bold font-mono read-only:bg-emerald-100/60"
        placeholder={placeholder}
        aria-valuemin={min}
        aria-valuemax={max}
      />
      {hint ? <p className="text-[10px] text-emerald-700/70 mt-1">{hint}</p> : null}
    </div>
  );
}

export const ProductManager: React.FC<ProductManagerProps> = ({
  products,
  setProducts,
  appConfig,
  onUpdateConfig,
  setAppConfig,
  formatPrice,
  onRequireStaffLogin,
  onProductEditorOpenChange,
}) => {
  // Main Navigation Tabs
  const [activeTab, setActiveTab] = useState<'products' | 'inventory' | 'categories' | 'import-export'>('products');
  
  // Product Status Filter (Active | Draft only)
  const [productStatusFilter, setProductStatusFilter] = useState<'All' | 'Active' | 'Draft'>('All');
  
  // Inventory Sub-Filter State
  const [inventorySubTab, setInventorySubTab] = useState<'all' | 'low-stock' | 'out-of-stock' | 'clearance' | 'damaged' | 'history'>('all');

  // Search and Category/Page Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPage, setFilterPage] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');

  // Dynamically computed list of Storefront pages connected with appConfig
  const storefrontPages = useMemo(() => {
    const list: { id: string; name: string; pageNumber: number; slug: string }[] = [
      { id: 'page-1', name: 'Page 1 (First Page Storefront)', pageNumber: 1, slug: 'home' },
    ];

    const defaultPages = [
      { id: 'World Cup', name: 'World Cup Vault', pageNumber: 1, slug: 'world-cup' },
      { id: 'England', name: 'Bangladesh Classic', pageNumber: 1, slug: 'bangladesh' },
      { id: 'Legends', name: 'Retro Store', pageNumber: 2, slug: 'retro-store' },
      { id: 'Current Season', name: 'Current Season', pageNumber: 2, slug: 'current-season' },
      { id: 'Clearance', name: 'Clearance', pageNumber: 3, slug: 'clearance' },
      { id: 'Classic', name: 'Club Classic', pageNumber: 4, slug: 'classic' },
      { id: 'Accessories', name: 'Accessories', pageNumber: 3, slug: 'accessories' },
    ];

    const configPages = appConfig?.pages || [];
    
    defaultPages.forEach(dp => {
      const matched = configPages.find(p => p.id === dp.id || p.name.toLowerCase() === dp.name.toLowerCase());
      list.push({
        id: dp.id,
        name: matched ? matched.name : dp.name,
        pageNumber: dp.pageNumber,
        slug: dp.slug,
      });
    });

    configPages.forEach(cp => {
      if (!list.some(p => p.id === cp.id || p.name.toLowerCase() === cp.name.toLowerCase())) {
        list.push({
          id: cp.id,
          name: cp.name,
          pageNumber: list.length + 1,
          slug: cp.slug || cp.id.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        });
      }
    });

    return list;
  }, [appConfig?.pages]);

  // Default Categories Pre-populated with User Examples
  const defaultCategories: CategoryItem[] = [
    { id: 'cat-world-cup', name: 'World Cup', slug: 'world-cup', pageNumber: 1, rowOrder: 1, description: 'National team World Cup historic kits', icon: 'Trophy', status: 'Active', bannerImage: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200' },
    { id: 'cat-epl', name: 'Premier League', slug: 'premier-league', pageNumber: 1, rowOrder: 2, description: 'English Premier League iconic club shirts', icon: 'Shirt', status: 'Active', bannerImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&q=80&w=1200' },
    { id: 'cat-laliga', name: 'La Liga', slug: 'la-liga', pageNumber: 2, rowOrder: 1, description: 'Spanish La Liga football club jerseys', icon: 'Flag', status: 'Active' },
    { id: 'cat-seriea', name: 'Serie A', slug: 'serie-a', pageNumber: 2, rowOrder: 2, description: 'Italian Serie A classic vintage kits', icon: 'Shield', status: 'Active' },
    { id: 'cat-bundesliga', name: 'Bundesliga', slug: 'bundesliga', pageNumber: 2, rowOrder: 3, description: 'German Bundesliga authentic releases', icon: 'Award', status: 'Active' },
    { id: 'cat-ligue1', name: 'Ligue 1', slug: 'ligue-1', pageNumber: 3, rowOrder: 1, description: 'French Ligue 1 match issue jerseys', icon: 'Star', status: 'Active' },
    { id: 'cat-retro', name: 'Retro', slug: 'retro', pageNumber: 3, rowOrder: 2, description: 'Rare 80s, 90s & 2000s vintage reissues', icon: 'Flame', status: 'Active' },
    { id: 'cat-training', name: 'Training', slug: 'training', pageNumber: 3, rowOrder: 3, description: 'Pre-match warm up and drill wear', icon: 'Activity', status: 'Active' },
    { id: 'cat-jackets', name: 'Jackets', slug: 'jackets', parentId: 'cat-training', pageNumber: 3, rowOrder: 4, description: 'Anthem & track jackets (Nested under Training)', icon: 'Package', status: 'Active' },
    { id: 'cat-accessories', name: 'Accessories', slug: 'accessories', pageNumber: 4, rowOrder: 1, description: 'Caps, scarves & collectors items', icon: 'Tag', status: 'Active' },
    { id: 'cat-new-in', name: 'New In', slug: 'new-in', pageNumber: 1, rowOrder: 3, description: 'Freshly arrived stock drops & releases', icon: 'Zap', status: 'Active' },
    { id: 'cat-clearance', name: 'Clearance', slug: 'clearance', pageNumber: 4, rowOrder: 2, description: 'Special price clearance sale jerseys', icon: 'Tag', status: 'Active' },
    { id: 'cat-featured', name: 'Featured', slug: 'featured', pageNumber: 1, rowOrder: 5, description: 'Homepage featured classics row', icon: 'Star', status: 'Active' },
    { id: 'cat-current-season', name: 'Current Season', slug: 'current-season', pageNumber: 1, rowOrder: 6, description: 'Homepage current season stock row', icon: 'Shirt', status: 'Active' },
    { id: 'cat-best-sellers', name: 'Best Sellers', slug: 'best-sellers', pageNumber: 1, rowOrder: 7, description: 'Homepage best sellers row', icon: 'Flame', status: 'Active' },
    { id: 'cat-limited-edition', name: 'Limited Edition', slug: 'limited-edition', pageNumber: 1, rowOrder: 4, description: 'Numbered limited run anniversary shirts', icon: 'Star', status: 'Active' },
    { id: 'cat-player-edition', name: 'Player Edition', slug: 'player-edition', pageNumber: 2, rowOrder: 4, description: 'Authentic slim-fit match issue quality', icon: 'Zap', status: 'Active' },
    { id: 'cat-fan-edition', name: 'Fan Edition', slug: 'fan-edition', pageNumber: 2, rowOrder: 5, description: 'Comfortable stadium fan-fit replicas', icon: 'Shirt', status: 'Active' },
    { id: 'cat-kids', name: 'Kids', slug: 'kids', pageNumber: 2, rowOrder: 6, description: 'Kids & junior football kits (ages 1–14)', icon: 'Shirt', status: 'Active' },
    { id: 'cat-customised-kit', name: 'Customised Kit', slug: 'customised-kit', pageNumber: 2, rowOrder: 7, description: 'Custom printed / customised kit jerseys', icon: 'Sparkles', status: 'Active' },
    { id: 'cat-thai-premium', name: 'Thai Premium', slug: 'thai-premium', pageNumber: 3, rowOrder: 5, description: 'High quality Thai 1:1 master grade jerseys', icon: 'Award', status: 'Active' },
    { id: 'cat-trouser', name: 'Trouser', slug: 'trouser', pageNumber: 4, rowOrder: 3, description: 'Match and training trousers', icon: 'Package', status: 'Active' },
    { id: 'cat-polo', name: 'Polo T-Shirt', slug: 'polo-t-shirt', pageNumber: 4, rowOrder: 4, description: 'Club and national team polo shirts', icon: 'Shirt', status: 'Active' },
    { id: 'cat-football', name: 'Football', slug: 'football', pageNumber: 4, rowOrder: 5, description: 'Match and training footballs', icon: 'Globe', status: 'Active' },
    { id: 'cat-shorts', name: 'Shorts', slug: 'shorts', pageNumber: 4, rowOrder: 6, description: 'Kit shorts and training shorts', icon: 'Tag', status: 'Active' },
    { id: 'cat-boots', name: 'Boots', slug: 'boots', pageNumber: 4, rowOrder: 7, description: 'Football boots and studs', icon: 'Zap', status: 'Active' },
    { id: 'cat-jacket', name: 'Jacket', slug: 'jacket', pageNumber: 5, rowOrder: 1, description: 'Pre-order jackets & anthems', icon: 'Package', status: 'Active' },
    { id: 'cat-track-suit', name: 'Track Suit', slug: 'track-suit', pageNumber: 5, rowOrder: 2, description: 'Pre-order track suits', icon: 'Activity', status: 'Active' },
    { id: 'cat-badminton', name: 'Badminton Racket', slug: 'badminton-racket', pageNumber: 5, rowOrder: 3, description: 'Pre-order badminton rackets', icon: 'Award', status: 'Active' },
  ];

  // Configured Categories List
  const categoryItems: CategoryItem[] = useMemo(() => {
    if (appConfig?.categoryItems && appConfig.categoryItems.length > 0) {
      return appConfig.categoryItems;
    }
    return defaultCategories;
  }, [appConfig?.categoryItems]);

  const homepageCategoryNames = useMemo(() => {
    const sections = appConfig?.homepageSections || [];
    const names = new Set<string>();
    sections.filter(isProductRowSection).forEach((s) => {
      const cat = resolveSectionCategory(s);
      if (cat) names.add(cat);
    });
    return [...names];
  }, [appConfig?.homepageSections]);

  const productCategoryOptions = useMemo(() => {
    const names = new Map<string, string>();
    categoryItems.forEach((c) => names.set(c.name.toLowerCase(), c.name));
    homepageCategoryNames.forEach((n) => names.set(n.toLowerCase(), n));
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [categoryItems, homepageCategoryNames]);

  // Stock Audit Logs
  const stockLogs: StockLog[] = useMemo(() => {
    if (appConfig?.stockLogs && appConfig.stockLogs.length > 0) {
      return appConfig.stockLogs;
    }
    return [
      { id: 'log-1', productId: 'p1', productName: 'England 1998 Home Kit', sku: 'JAB-ENG98-001', previousStock: 5, newStock: 12, change: 7, reason: 'Supplier Receiving', timestamp: '2026-07-22 14:30', user: 'Admin' },
      { id: 'log-2', productId: 'p2', productName: 'Barcelona 2008/09 UCL Final', sku: 'JAB-BAR08-002', previousStock: 3, newStock: 2, change: -1, reason: 'Sale', timestamp: '2026-07-23 09:15', user: 'System' },
      { id: 'log-3', productId: 'p3', productName: 'AC Milan 2006/07 Kaká #22', sku: 'JAB-ACM06-003', previousStock: 2, newStock: 0, change: -2, reason: 'Damaged Write-off', timestamp: '2026-07-23 11:00', user: 'Admin' },
    ];
  }, [appConfig?.stockLogs]);

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Lock page scroll while product modal is open — Escape does NOT close (must Cancel / Save)
  useEffect(() => {
    onProductEditorOpenChange?.(isProductModalOpen);
    if (!isProductModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [isProductModalOpen, onProductEditorOpenChange]);

  // Clear lock flag if ProductManager unmounts while the dialog was open
  useEffect(() => {
    return () => onProductEditorOpenChange?.(false);
  }, [onProductEditorOpenChange]);

  // Quick Stock Adjustment Modal State
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockChangeAmount, setStockChangeAmount] = useState<number>(0);
  const [stockReason, setStockReason] = useState<StockLog['reason']>('Manual Adjustment');

  // Category Form State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catParentId, setCatParentId] = useState<string | 'none'>('none');
  const [catPageNum, setCatPageNum] = useState<number>(1);
  const [catRowOrder, setCatRowOrder] = useState<number>(1);
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState('Shirt');
  const [catBannerImage, setCatBannerImage] = useState('');
  const [catStatus, setCatStatus] = useState<'Active' | 'Inactive'>('Active');

  // Add New Page Quick Modal States
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState(false);
  const [newPageNameInput, setNewPageNameInput] = useState('');
  const [newPageSlugInput, setNewPageSlugInput] = useState('');
  const [newPageIconInput, setNewPageIconInput] = useState('Shirt');
  const [newPageShowInMenu, setNewPageShowInMenu] = useState(true);

  // Full Product Form States
  const [pName, setPName] = useState('');
  const [pSlug, setPSlug] = useState('');
  const [pShortDesc, setPShortDesc] = useState('');
  const [pLongDesc, setPLongDesc] = useState('');
  const [pFeatures, setPFeatures] = useState('');
  const [pTags, setPTags] = useState<string[]>([]);
  const [pTagDraft, setPTagDraft] = useState('');
  const [pMaterial, setPMaterial] = useState('100% Recycled Polyester Mesh');
  const [pSeason, setPSeason] = useState('2025/2026');
  const [pYear, setPYear] = useState<number>(2026);
  const [pLeague, setPLeague] = useState('');
  const [pClub, setPClub] = useState('');
  const [pNationalTeam, setPNationalTeam] = useState('');
  const [pPlayerName, setPPlayerName] = useState('');
  const [pPlayerNum, setPPlayerNum] = useState<number | ''>('');
  const [pBrand, setPBrand] = useState('');
  const [pBrandCustom, setPBrandCustom] = useState('');
  const [pGender, setPGender] = useState<string>('Men');
  const [pCondition, setPCondition] = useState<string>('Mint');
  const [pConditionDetail, setPConditionDetail] = useState('');
  const [pSizeChartIds, setPSizeChartIds] = useState<string[]>([]);
  const availableSizeCharts = useMemo(
    () => getAllSizeCharts(appConfig?.customSizeCharts),
    [appConfig?.customSizeCharts],
  );
  const STANDARD_SIZES = useMemo(() => {
    const primaryId = pSizeChartIds[0];
    const chart = getSizeChartById(primaryId, appConfig?.customSizeCharts);
    if (chart?.sizeOptions?.length) return chart.sizeOptions;
    if (primaryId === 'kids') return [...KIDS_PRODUCT_SIZES];
    // Merge size options from all selected charts
    const merged = new Set<string>();
    for (const id of pSizeChartIds) {
      const c = getSizeChartById(id, appConfig?.customSizeCharts);
      c?.sizeOptions?.forEach((s) => merged.add(s));
    }
    if (merged.size) return Array.from(merged);
    return [...STANDARD_PRODUCT_SIZES];
  }, [pSizeChartIds, appConfig?.customSizeCharts]);
  /** Size qty drafts — empty until typed (integers only). */
  type SizeQty = number | '';
  const emptySizeStocks = (): Record<string, SizeQty> =>
    Object.fromEntries(['S', 'M', 'L', 'XL', '2XL'].map((sz) => [sz, '']));
  const [pSizeStocks, setPSizeStocks] = useState<Record<string, SizeQty>>(emptySizeStocks);
  const [pCustomSize, setPCustomSize] = useState('');
  const [pColor, setPColor] = useState('Red/White');
  const [pSku, setPSku] = useState('');
  const [pBarcode, setPBarcode] = useState('');
  const [pSkuMode, setPSkuMode] = useState<'auto' | 'manual'>('auto');
  const [pBarcodeMode, setPBarcodeMode] = useState<'auto' | 'manual'>('auto');
  const [labelPrint, setLabelPrint] = useState<{ barcode: string; sellPrice: number; name: string } | null>(null);
  const [pCostPrice, setPCostPrice] = useState<MoneyValue>('');
  const [pOriginalPrice, setPOriginalPrice] = useState<MoneyValue>('');
  const [pDiscountMode, setPDiscountMode] = useState<DiscountMode>('percent');
  const [pDiscountAmount, setPDiscountAmount] = useState<MoneyValue>('');
  const [pDiscountPercent, setPDiscountPercent] = useState<MoneyValue>('');
  const [pFinalDraft, setPFinalDraft] = useState<MoneyValue | null>(null);
  const originalNum = moneyNumber(pOriginalPrice);
  const discountAmountNum = moneyNumber(pDiscountAmount);
  const discountPercentNum = moneyNumber(pDiscountPercent);
  const pFinalPrice = calcSalePrice(originalNum, pDiscountMode, discountAmountNum, discountPercentNum);
  const pHasDiscount = pFinalPrice < originalNum && originalNum > 0;
  const pStock = Object.values(pSizeStocks).reduce<number>((sum, n) => sum + moneyNumber(n as MoneyValue), 0);
  const pSizes = Object.keys(pSizeStocks);
  const resolvedBrand = pBrand === 'Other' ? pBrandCustom.trim() : pBrand;
  const [pLowStockThreshold, setPLowStockThreshold] = useState<number>(3);
  const [pIsClearance, setPIsClearance] = useState<boolean>(false);
  const [pIsDamaged, setPIsDamaged] = useState<boolean>(false);
  const [pIsPreOrder, setPIsPreOrder] = useState<boolean>(false);
  const [pPreOrderEta, setPPreOrderEta] = useState<string>('');
  const [pDamagedQty, setPDamagedQty] = useState<number>(0);
  const [pPrintAvailable, setPPrintAvailable] = useState<boolean>(true);
  const [pBadgeAvailable, setPBadgeAvailable] = useState<boolean>(true);
  const [pNamesetPriceBdt, setPNamesetPriceBdt] = useState<number>(DEFAULT_NAMESET_PRICE_BDT);
  const [pNamesetLabel, setPNamesetLabel] = useState<string>(DEFAULT_NAMESET_LABEL);
  const [pBadgeOptions, setPBadgeOptions] = useState<ProductBadgeOption[]>(createDefaultBadgeOptions());
  const [pDimensions, setPDimensions] = useState('30 x 20 x 3 cm / 250g');
  const [pTargetPage, setPTargetPage] = useState<string>('World Cup Vault');
  const [pPageNumber, setPPageNumber] = useState<number>(1);
  const [pCategoryRow, setPCategoryRow] = useState<number>(1);
  const [pCategories, setPCategories] = useState<string[]>([]);
  const pCategory = pCategories[0] || '';
  const pSizeChartId = pSizeChartIds[0] || '';

  const toggleCategory = (name: string) => {
    setPCategories((prev) => {
      const has = prev.includes(name);
      const next = has ? prev.filter((c) => c !== name) : [...prev, name];
      setPSizeChartIds((charts) => {
        const chartIds = new Set(charts);
        if (!has) {
          const inferred = inferSizeChartId(name);
          if (inferred) chartIds.add(inferred);
          const catItem = categoryItems.find((c) => c.name === name);
          if (catItem?.sizeChartId) chartIds.add(catItem.sizeChartId);
        }
        return Array.from(chartIds);
      });
      return next;
    });
  };

  const toggleSizeChart = (id: string) => {
    setPSizeChartIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const [pMainImage, setPMainImage] = useState<string>('');
  const [pGallery, setPGallery] = useState<string[]>([]);
  const [pGalleryInput, setPGalleryInput] = useState<string>('');
  const [pStatus, setPStatus] = useState<'Active' | 'Draft'>('Active');
  const pendingSaveStatusRef = useRef<'Active' | 'Draft' | null>(null);
  /** Up to 6 product images: slot 1 is main card image */
  const [pImageSlots, setPImageSlots] = useState<string[]>(['', '', '', '', '', '']);
  const [galleryViewer, setGalleryViewer] = useState<{ product: Product; index: number } | null>(null);

  const updateConfig = (newConfig: AppConfig) => {
    if (onUpdateConfig) {
      onUpdateConfig(newConfig);
    } else if (setAppConfig) {
      setAppConfig(newConfig);
    }
  };

  // Create new custom storefront page & save to config
  const handleCreateNewPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageNameInput.trim()) return;

    const pageName = newPageNameInput.trim();
    const cleanSlug = (newPageSlugInput.trim() || pageName).toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const newCustomPage = {
      id: pageName,
      name: pageName,
      slug: cleanSlug,
      isCustom: true,
      visible: true,
      sections: [...(appConfig?.homepageSections || [])],
    };

    const updatedPages = [...(appConfig?.pages || []), newCustomPage];
    let updatedMenuItems = [...(appConfig?.menuItems || [])];

    if (newPageShowInMenu) {
      updatedMenuItems.push({
        id: `nav-${Date.now()}`,
        name: pageName,
        placement: 'Main Menu',
        order: updatedMenuItems.length + 1,
        url: pageName,
        status: 'Active',
        icon: newPageIconInput || 'Shirt',
      });
    }

    updateConfig({
      ...appConfig,
      pages: updatedPages,
      menuItems: updatedMenuItems,
    });

    setPTargetPage(pageName);
    setIsAddPageModalOpen(false);
    setNewPageNameInput('');
    setNewPageSlugInput('');
  };

  // Reset Product Form
  const resetProductForm = () => {
    setEditingProduct(null);
    setPName('');
    setPSlug('');
    setPShortDesc('');
    setPLongDesc('');
    setPFeatures('Official Patches, Sublimated Sponsor, Vintage Collar');
    setPTags([]);
    setPTagDraft('');
    setPMaterial('100% Recycled Polyester Mesh');
    setPSeason('2025/2026');
    setPYear(2026);
    setPLeague('Premier League');
    setPClub('Manchester United');
    setPNationalTeam('');
    setPPlayerName('');
    setPPlayerNum('');
    setPBrand('');
    setPBrandCustom('');
    setPGender('Men');
    setPCondition('Mint');
    setPConditionDetail('Original tags attached. Deadstock pristine condition.');
    setPSizeStocks(emptySizeStocks());
    setPCustomSize('');
    setPColor('Red/White');
    setPSku(nextSkuSequence(products.map((p) => p.sku), 'EV'));
    setPBarcode(nextSerialEan13(products.map((p) => p.barcode)));
    setPSkuMode('auto');
    setPBarcodeMode('auto');
    setPCostPrice('');
    setPOriginalPrice('');
    setPDiscountMode('percent');
    setPDiscountAmount('');
    setPDiscountPercent('');
    setPFinalDraft(null);
    setPLowStockThreshold(3);
    setPIsClearance(false);
    setPIsDamaged(false);
    setPIsPreOrder(false);
    setPPreOrderEta('');
    setPDamagedQty(0);
    setPPrintAvailable(true);
    setPBadgeAvailable(true);
    setPNamesetPriceBdt(DEFAULT_NAMESET_PRICE_BDT);
    setPNamesetLabel(DEFAULT_NAMESET_LABEL);
    setPBadgeOptions(createDefaultBadgeOptions());
    setPDimensions('30 x 20 x 3 cm / 250g');
    setPTargetPage('World Cup Vault');
    setPPageNumber(1);
    setPCategoryRow(1);
    setPCategories([]);
    setPSizeChartIds([]);
    setPMainImage('');
    setPGallery([]);
    setPGalleryInput('');
    setPImageSlots(['', '', '', '', '', '']);
    setPStatus('Active');
  };

  const closeProductModal = async () => {
    if (isSavingProduct) return;
    const ok = await confirmAsync({
      title: 'Leave without saving?',
      message:
        'Your product form will close and unsaved changes will be lost. Stay on this form until Save & Publish if you want to keep editing.',
      confirmText: 'Close form',
      cancelText: 'Keep editing',
      danger: true,
    });
    if (!ok) return;
    setIsProductModalOpen(false);
    resetProductForm();
  };

  const applyFinalSellingPrice = (next: MoneyValue) => {
    const original = originalNum;
    if (next === '') {
      setPDiscountMode('percent');
      setPDiscountAmount('');
      setPDiscountPercent('');
      return;
    }
    const sale = Math.max(0, Math.floor(next));
    setPDiscountMode('amount');
    if (original <= 0) {
      setPOriginalPrice(sale);
      setPDiscountAmount('');
      setPDiscountPercent('');
      return;
    }
    if (sale >= original) {
      setPDiscountAmount('');
      setPDiscountPercent('');
      return;
    }
    setPDiscountAmount(original - sale);
    setPDiscountPercent(calcDiscountPercent(original, sale));
  };

  // Populate Product Form for Edit
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setPName(product.name || '');
    setPSlug(product.slug || '');
    setPShortDesc(product.shortDescription || '');
    setPLongDesc(product.longDescription || product.description || '');
    setPFeatures(Array.isArray(product.features) ? product.features.join(', ') : (product.features || ''));
    setPTags(Array.isArray(product.tags) ? product.tags.slice(0, MAX_PRODUCT_TAGS) : []);
    setPTagDraft('');
    setPMaterial(product.material || product.specification?.material || '100% Polyester');
    setPSeason(product.season || '');
    setPYear(product.year || 2026);
    setPLeague(product.league || '');
    setPClub(product.club || '');
    setPNationalTeam(product.nationalTeam || product.country || '');
    setPPlayerName(product.player?.name || '');
    setPPlayerNum(product.player?.number || '');
    {
      const brand = (product.brand || '').trim();
      if (brand && (PRODUCT_BRANDS as readonly string[]).includes(brand)) {
        setPBrand(brand);
        setPBrandCustom('');
      } else if (brand) {
        setPBrand('Other');
        setPBrandCustom(brand);
      } else {
        setPBrand('');
        setPBrandCustom('');
      }
    }
    setPGender(product.gender || 'Men');
    setPCondition(product.condition || 'Mint');
    setPConditionDetail(product.conditionDetail || '');
    if (product.sizeStocks && Object.keys(product.sizeStocks).length) {
      const next: Record<string, SizeQty> = {};
      for (const [k, v] of Object.entries(product.sizeStocks)) {
        next[k] = Math.max(0, Math.floor(Number(v) || 0));
      }
      setPSizeStocks(next);
    } else {
      const sizes = product.sizes?.length ? product.sizes : [...DEFAULT_FALLBACK_SIZES];
      const total = Math.max(0, Number(product.stock) || 0);
      const next: Record<string, SizeQty> = {};
      sizes.forEach((sz, i) => {
        next[sz] = i === 0 ? total : 0;
      });
      setPSizeStocks(next);
    }
    setPCustomSize('');
    setPColor(product.color || '');
    setPSku(product.sku || '');
    const existingBarcode = normalizeBarcode(product.barcode || '');
    if (existingBarcode) {
      setPBarcode(existingBarcode);
      setPBarcodeMode('auto');
    } else {
      setPBarcode(
        nextSerialEan13(
          products.map((p) => p.barcode),
          product.barcode,
        ),
      );
      setPBarcodeMode('auto');
    }
    setPSkuMode('manual');
    setPCostPrice(product.costPrice != null ? Math.floor(Number(product.costPrice)) : '');
    const sale = Math.floor(Number(product.sellingPrice || product.price) || 0);
    const original =
      product.originalPrice && product.originalPrice > sale
        ? Math.floor(Number(product.originalPrice))
        : sale;
    const amount =
      product.discount && product.discount > 0
        ? Math.floor(Number(product.discount))
        : calcDiscountAmount(original, sale);
    const percent = calcDiscountPercent(original, sale);
    const cleanPercent =
      percent > 0 && calcSalePrice(original, 'percent', 0, percent) === sale;
    setPOriginalPrice(original || '');
    setPDiscountMode(cleanPercent ? 'percent' : amount > 0 ? 'amount' : 'percent');
    setPDiscountAmount(amount > 0 ? amount : '');
    setPDiscountPercent(percent > 0 ? percent : '');
    setPFinalDraft(null);
    setPLowStockThreshold(product.lowStockThreshold || 3);
    setPIsClearance(product.isClearance || false);
    setPIsDamaged(product.isDamaged || false);
    setPIsPreOrder(product.isPreOrder || false);
    setPPreOrderEta(product.preOrderEta || '');
    setPDamagedQty(product.damagedQty || 0);
    setPPrintAvailable(product.printAvailable !== false);
    setPBadgeAvailable(product.badgeAvailable !== false);
    setPNamesetPriceBdt(product.namesetPriceBdt ?? DEFAULT_NAMESET_PRICE_BDT);
    setPNamesetLabel(product.namesetLabel || DEFAULT_NAMESET_LABEL);
    setPBadgeOptions(getProductBadgeOptions(product));
    setPDimensions(product.dimensions || '30 x 20 x 3 cm / 250g');
    const rawTarget =
      product.targetPage ||
      product.pageName ||
      (product.pageNumber === 1 ? 'Page 1 (First Page Storefront)' : product.category || 'World Cup');
    const matchedTarget = storefrontPages.find(
      (p) =>
        p.id === rawTarget ||
        p.name === rawTarget ||
        p.id.toLowerCase() === String(rawTarget).toLowerCase() ||
        p.name.toLowerCase() === String(rawTarget).toLowerCase(),
    );
    setPTargetPage(matchedTarget ? matchedTarget.id : rawTarget);
    setPPageNumber(product.pageNumber || matchedTarget?.pageNumber || 1);
    setPCategoryRow(product.categoryRow || 1);
    {
      const cats =
        product.categories?.length
          ? product.categories
          : product.category
            ? [product.category]
            : [];
      setPCategories(cats);
    }
    {
      const charts =
        product.sizeChartIds?.length
          ? product.sizeChartIds
          : product.sizeChartId
            ? product.sizeChartId.split(',').map((s) => s.trim()).filter(Boolean)
            : [];
      setPSizeChartIds(
        charts.length
          ? charts
          : (() => {
              const inferred = inferSizeChartId(product.category);
              return inferred ? [inferred] : [];
            })(),
      );
    }
    setPMainImage(product.uploadedImage || product.image || '');
    const gallerySrc = product.gallery?.length
      ? product.gallery
      : product.images?.length
        ? product.images
        : [product.uploadedImage || product.image || ''];
    setPGallery(gallerySrc);
    setPGalleryInput('');
    setPImageSlots([
      gallerySrc[0] || product.uploadedImage || product.image || '',
      gallerySrc[1] || '',
      gallerySrc[2] || '',
      gallerySrc[3] || '',
      gallerySrc[4] || '',
      gallerySrc[5] || '',
    ]);
    setPStatus(product.status === 'Draft' ? 'Draft' : 'Active');
    setIsProductModalOpen(true);
  };

  const handleImageSlotUpload = async (slotIndex: number, file: File | null) => {
    if (!file) return;
    if (slotIndex < 0 || slotIndex > 5) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, WEBP).');
      return;
    }
    const limit = imageUploadLimitForCategory(pCategory);
    if (file.size > limit) {
      alert(
        `Image is too large for ${pCategory || 'this category'} (max ${(limit / (1024 * 1024)).toFixed(0)}MB). Try a smaller file.`,
      );
      return;
    }
    try {
      const url = await uploadStoreImage(file, 'products', {
        maxEdge: 1400,
        quality: 0.78,
        maxBytes: 850_000,
      });
      setPImageSlots((prev) => {
        const next = [...prev];
        while (next.length < 6) next.push('');
        next[slotIndex] = url;
        return next.slice(0, 6);
      });
      if (slotIndex === 0) setPMainImage(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not upload image to Cloudinary.');
    }
  };

  const clearImageSlot = (slotIndex: number) => {
    if (slotIndex < 0 || slotIndex > 5) return;
    setPImageSlots((prev) => {
      const next = [...prev];
      while (next.length < 6) next.push('');
      next[slotIndex] = '';
      return next.slice(0, 6);
    });
    if (slotIndex === 0) setPMainImage('');
  };

  const getProductGallery = (product: Product): string[] => {
    const list = [
      ...(product.gallery || []),
      ...(product.images || []),
      product.uploadedImage,
      product.image,
    ].filter((src): src is string => Boolean(src));
    const unique = Array.from(new Set(list));
    return unique.slice(0, 6);
  };

  // Submit Product Form (Add / Edit)
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProduct) return;
    if (!pName || !resolvedBrand) {
      toast('Please fill in required fields (Name & Brand).', 'error');
      return;
    }
    if (pCategories.length === 0) {
      toast('Select at least one category.', 'error');
      return;
    }
    if (pSizes.length === 0) {
      toast('Enable at least one size and set how many are available.', 'error');
      return;
    }
    if (originalNum <= 0 && moneyNumber(pFinalDraft ?? pFinalPrice) <= 0) {
      toast('Please enter a price (integers only, no decimals).', 'error');
      return;
    }

    setIsSavingProduct(true);
    try {
    const saveStatus = pendingSaveStatusRef.current ?? pStatus;
    pendingSaveStatusRef.current = null;
    const calculatedPrice = pFinalPrice > 0 ? pFinalPrice : originalNum > 0 ? originalNum : 0;
    if (calculatedPrice <= 0) {
      toast('Please enter Original Price or Final Selling Price.', 'error');
      setIsSavingProduct(false);
      return;
    }
    const discountAmount = pHasDiscount ? calcDiscountAmount(originalNum || calculatedPrice, calculatedPrice) : 0;
    const sizeStocksNumeric: Record<string, number> = {};
    for (const [sz, qty] of Object.entries(pSizeStocks)) {
      sizeStocksNumeric[sz] = moneyNumber(qty as MoneyValue);
    }
    const uniqueSuffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 900 + 100)}`;
    const baseSlug = pName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jersey';
    const finalSlug = editingProduct?.slug || `${baseSlug}-${uniqueSuffix}`;
    const resolvedSku =
      pSkuMode === 'manual' && pSku.trim()
        ? pSku.trim()
        : editingProduct?.sku || nextSkuSequence(products.map((p) => p.sku), 'EV');
    const resolvedBarcode = ensureUniqueBarcode(
      pBarcodeMode === 'manual' ? pBarcode : pBarcode || undefined,
      products.map((p) => p.barcode),
      editingProduct?.barcode,
    );
    const featuresArr = pFeatures ? pFeatures.split(',').map(f => f.trim()).filter(Boolean) : [];
    const tagsArr = pTags.map((t) => t.trim()).filter(Boolean).slice(0, MAX_PRODUCT_TAGS);
    const longDesc = pLongDesc.trim();
    const selectedPageObj = storefrontPages.find(
      (p) => p.id === pTargetPage || p.name === pTargetPage,
    );
    const resolvedPageNum = selectedPageObj ? selectedPageObj.pageNumber : (Number(pPageNumber) || 1);
    const resolvedTargetId = canonicalTargetPageId(
      selectedPageObj ? selectedPageObj.id : pTargetPage,
    );
    const resolvedTargetName = canonicalTargetPageName(
      selectedPageObj ? selectedPageObj.name : pTargetPage,
    );

    const filledImages = pImageSlots.map((s) => s.trim()).filter(Boolean);
    const primaryImage = filledImages[0] || pMainImage || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=800';
    const galleryImages = (filledImages.length > 0 ? filledImages : [primaryImage]).slice(0, 6);

    const globalPatches = normalizeBadgeOptionsList(
      appConfig.tournamentPatches?.length ? appConfig.tournamentPatches : createDefaultBadgeOptions(),
    );
    const normalizedBadgeOptions = (pBadgeAvailable ? globalPatches : [])
      .map((badge, index) => ({
        id: badge.id || `patch-${index + 1}`,
        label: badge.label.trim(),
        priceBdt: Math.max(0, Math.round(Number(badge.priceBdt) || 0)),
        ...(badge.image?.trim() ? { image: badge.image.trim() } : {}),
      }))
      .filter((badge) => badge.label);
    const primaryBadge = normalizedBadgeOptions[0];

    const updatedProduct: Product = {
      id: editingProduct ? editingProduct.id : `shirt-${Date.now()}`,
      name: pName,
      slug: finalSlug,
      shortDescription: pShortDesc || longDesc.slice(0, 160),
      longDescription: longDesc,
      description: longDesc || pShortDesc || `${resolvedBrand} ${pName} - ${pSeason}`,
      features: featuresArr,
      tags: tagsArr,
      material: pMaterial,
      season: pSeason,
      year: Number(pYear) || 2026,
      league: pLeague,
      club: pClub,
      country: pNationalTeam,
      nationalTeam: pNationalTeam,
      player: pPlayerName ? { name: pPlayerName, number: Number(pPlayerNum) || 10 } : undefined,
      brand: resolvedBrand,
      gender: pGender,
      condition: pCondition as any,
      conditionDetail: pConditionDetail,
      sizes: pSizes,
      sizeStocks: sizeStocksNumeric,
      color: pColor,
      sku: resolvedSku,
      barcode: resolvedBarcode,
      costPrice: moneyNumber(pCostPrice),
      sellingPrice: calculatedPrice,
      price: calculatedPrice,
      originalPrice: pHasDiscount ? originalNum : null,
      discount: pHasDiscount ? discountAmount : null,
      stock: pStock,
      lowStockThreshold: Number(pLowStockThreshold) || 3,
      isClearance: pIsClearance,
      isDamaged: pIsDamaged,
      isPreOrder: pIsPreOrder,
      preOrderEta: pIsPreOrder ? (pPreOrderEta.trim() || undefined) : undefined,
      damagedQty: Number(pDamagedQty) || 0,
      dimensions: pDimensions,
      category: pCategory || pCategories[0] || 'General',
      categories: pCategories.length ? pCategories : pCategory ? [pCategory] : [],
      sizeChartId: pSizeChartIds[0] || inferSizeChartId(pCategory) || undefined,
      sizeChartIds: pSizeChartIds,
      targetPage: resolvedTargetId,
      pageName: resolvedTargetName,
      pageNumber: resolvedPageNum,
      categoryRow: Number(pCategoryRow) || 1,
      image: primaryImage,
      images: galleryImages,
      gallery: galleryImages,
      uploadedImage: primaryImage.startsWith('data:') ? primaryImage : (editingProduct?.uploadedImage && primaryImage === editingProduct.uploadedImage ? editingProduct.uploadedImage : undefined),
      rating: editingProduct?.rating || 4.9,
      reviewsCount: editingProduct?.reviewsCount || 12,
      badgeAvailable: pBadgeAvailable,
      printAvailable: pPrintAvailable,
      namesetPriceBdt: Math.max(0, Math.round(Number(pNamesetPriceBdt) || 0)),
      badgePriceBdt: primaryBadge?.priceBdt ?? DEFAULT_BADGE_PRICE_BDT,
      namesetLabel: pNamesetLabel.trim() || DEFAULT_NAMESET_LABEL,
      badgeLabel: DEFAULT_BADGE_LABEL,
      badgeOptions: normalizedBadgeOptions,
      specification: {
        material: pMaterial,
        madeIn: 'Bangladesh',
        fit: 'Athlete Aero Standard Fit',
      },
      status: saveStatus,
      isArchived: false,
      isTrashed: false,
    };

    if (isApiEnabled() && !getToken()) {
      if (onRequireStaffLogin) {
        onRequireStaffLogin();
      } else {
        alert('Sign in as staff is required to save products to the database.');
      }
      return;
    }

    if (isApiEnabled() && getToken()) {
      try {
        const payload = {
          name: updatedProduct.name,
          slug: updatedProduct.slug,
          sku: updatedProduct.sku,
          barcode: updatedProduct.barcode || null,
          price: updatedProduct.price,
          originalPrice: updatedProduct.originalPrice,
          costPrice: updatedProduct.costPrice,
          sellingPrice: updatedProduct.sellingPrice,
          discount: updatedProduct.discount,
          description: updatedProduct.description,
          shortDescription: updatedProduct.shortDescription,
          longDescription: updatedProduct.longDescription,
          features: updatedProduct.features,
          tags: updatedProduct.tags || [],
          image: updatedProduct.image,
          images: updatedProduct.images || updatedProduct.gallery || [updatedProduct.image],
          brand: updatedProduct.brand,
          season: updatedProduct.season,
          year: updatedProduct.year,
          condition: String(updatedProduct.condition),
          conditionDetail: updatedProduct.conditionDetail || '',
          color: updatedProduct.color || 'Multi',
          sizes: updatedProduct.sizes,
          sizeStocks: updatedProduct.sizeStocks,
          stock: updatedProduct.stock,
          gender: updatedProduct.gender,
          country: updatedProduct.country,
          nationalTeam: updatedProduct.nationalTeam,
          player: updatedProduct.player,
          isClearance: updatedProduct.isClearance,
          isPreOrder: updatedProduct.isPreOrder,
          preOrderEta: updatedProduct.preOrderEta,
          status: updatedProduct.status,
          material: updatedProduct.material,
          lowStockThreshold: updatedProduct.lowStockThreshold,
          category: updatedProduct.category,
          categories: updatedProduct.categories,
          targetPage: updatedProduct.targetPage,
          pageName: updatedProduct.pageName,
          pageNumber: updatedProduct.pageNumber,
          categoryRow: updatedProduct.categoryRow,
          sizeChartId: updatedProduct.sizeChartId,
          sizeChartIds: updatedProduct.sizeChartIds,
          badgeAvailable: updatedProduct.badgeAvailable,
          printAvailable: updatedProduct.printAvailable,
          namesetPriceBdt: updatedProduct.namesetPriceBdt,
          badgePriceBdt: updatedProduct.badgePriceBdt,
          namesetLabel: updatedProduct.namesetLabel,
          badgeLabel: updatedProduct.badgeLabel,
          badgeOptions: updatedProduct.badgeOptions,
        };
        if (editingProduct) {
          const saved = await api.updateProduct(editingProduct.id, payload);
          Object.assign(updatedProduct, saved, {
            category: updatedProduct.category || saved.category,
            targetPage: updatedProduct.targetPage || saved.targetPage,
            pageName: updatedProduct.pageName || saved.pageName,
            pageNumber: updatedProduct.pageNumber ?? saved.pageNumber,
            categoryRow: updatedProduct.categoryRow ?? saved.categoryRow,
            sizeChartId: updatedProduct.sizeChartId || saved.sizeChartId,
            sizeChartIds: updatedProduct.sizeChartIds || saved.sizeChartIds,
            categories: updatedProduct.categories || saved.categories,
            sizes: updatedProduct.sizes?.length ? updatedProduct.sizes : saved.sizes,
            sizeStocks: updatedProduct.sizeStocks || saved.sizeStocks,
            stock: updatedProduct.stock ?? saved.stock,
          });
        } else {
          const saved = await api.createProduct(payload);
          Object.assign(updatedProduct, saved, {
            category: updatedProduct.category || saved.category,
            targetPage: updatedProduct.targetPage || saved.targetPage,
            pageName: updatedProduct.pageName || saved.pageName,
            pageNumber: updatedProduct.pageNumber ?? saved.pageNumber,
            categoryRow: updatedProduct.categoryRow ?? saved.categoryRow,
            sizeChartId: updatedProduct.sizeChartId || saved.sizeChartId,
            sizeChartIds: updatedProduct.sizeChartIds || saved.sizeChartIds,
            categories: updatedProduct.categories || saved.categories,
            sizes: updatedProduct.sizes?.length ? updatedProduct.sizes : saved.sizes,
            sizeStocks: updatedProduct.sizeStocks || saved.sizeStocks,
            stock: updatedProduct.stock ?? saved.stock,
          });
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to save product to database', 'error');
        return;
      }
    }

    if (editingProduct) {
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updatedProduct : p)));
    } else {
      setProducts((prev) => {
        const withoutDup = prev.filter((p) => p.id !== updatedProduct.id && p.sku !== updatedProduct.sku);
        return [updatedProduct, ...withoutDup];
      });
    }

    // Ensure homepage landing section exists for this category (min 4 products, all visitors)
    if (appConfig && updatedProduct.category) {
      const withCat = ensureCategoryForSection(appConfig.categoryItems, updatedProduct.category);
      const sections = ensureHomepageRowsForCategories(appConfig.homepageSections || [], [
        updatedProduct.category,
        'Retro',
        'Kids',
        'Customised Kit',
        'Featured',
        'Player Edition',
        'Fan Edition',
        'Current Season',
        'Clearance',
        'Best Sellers',
        'New In',
      ]);
      updateConfig({
        ...appConfig,
        categoryItems: withCat,
        homepageSections: sections,
      });
      if (isApiEnabled() && getToken()) {
        void api.saveHomepageSections(sections, withCat).catch(() => undefined);
      }
    }

    setIsProductModalOpen(false);
    resetProductForm();
    // Ensure the new/edited product is visible in the current list filters
    setProductStatusFilter(saveStatus);
    setFilterPage('All');
    setFilterCategory('All');
    setSearchTerm('');
    toast(editingProduct ? 'Product updated' : 'Product saved', 'success');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Duplicate Product
  const handleDuplicateProduct = (product: Product) => {
    const clone: Product = {
      ...product,
      id: `${product.id}-copy-${Date.now()}`,
      name: `${product.name} (Copy)`,
      sku: `${product.sku}-COPY`,
      slug: `${product.slug}-copy`,
      status: 'Active',
      isArchived: false,
      isTrashed: false,
    };
    setProducts(prev => [clone, ...prev]);
    alert(`Duplicated "${product.name}" successfully!`);
  };

  // Move to Draft / Publish (Active)
  const handleToggleDraft = async (product: Product) => {
    const isDraft = product.status === 'Draft';
    const newStatus: 'Active' | 'Draft' = isDraft ? 'Active' : 'Draft';
    if (isApiEnabled() && getToken()) {
      try {
        await api.updateProduct(product.id, { status: newStatus, isArchived: false });
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to update product', 'error');
        return;
      }
    }
    setProducts(prev => prev.map(p => p.id === product.id ? {
      ...p,
      status: newStatus,
      isArchived: false,
      isTrashed: false,
    } : p));
    toast(newStatus === 'Draft' ? 'Moved to drafts' : 'Published as active', 'success');
  };

  // Delete Product — permanent, no trash bin
  const handleDeleteProduct = async (product: Product) => {
    const ok = await confirmAsync({
      title: 'Delete product',
      message: `Permanently delete "${product.name}"? This cannot be undone.`,
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    if (isApiEnabled() && getToken()) {
      try {
        await api.deleteProduct(product.id);
      } catch (err) {
        // Still remove from UI if server says missing (seed-only / already deleted)
        const msg = err instanceof Error ? err.message : String(err);
        if (!/not found|404|P2025/i.test(msg)) {
          toast(msg || 'Failed to delete product', 'error');
          return;
        }
      }
    }
    setProducts(prev => prev.filter(p => p.id !== product.id));
    toast('Product deleted', 'success');
  };

  // Stock Adjustment Handler — updates Neon stock when API connected
  const handleConfirmStockAdjust = async () => {
    if (!stockModalProduct || stockChangeAmount === 0) return;

    const prevStock = stockModalProduct.stock;
    const newStock = Math.max(0, prevStock + stockChangeAmount);

    if (isApiEnabled() && getToken()) {
      try {
        await api.updateProduct(stockModalProduct.id, { stock: newStock });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update stock');
        return;
      }
    }

    // Update Product Stock
    setProducts(prev => prev.map(p => p.id === stockModalProduct.id ? { ...p, stock: newStock } : p));

    // Append Stock Log entry
    const newLog: StockLog = {
      id: `log-${Date.now()}`,
      productId: stockModalProduct.id,
      productName: stockModalProduct.name,
      sku: stockModalProduct.sku,
      previousStock: prevStock,
      newStock: newStock,
      change: stockChangeAmount,
      reason: stockReason,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      user: 'Admin Backend'
    };

    updateConfig({
      ...appConfig,
      stockLogs: [newLog, ...stockLogs]
    });

    setIsStockModalOpen(false);
    setStockModalProduct(null);
    setStockChangeAmount(0);
  };

  // Category Save Handler
  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const newCat: CategoryItem = {
      id: editingCategory ? editingCategory.id : `cat-${Date.now()}`,
      name: catName.trim(),
      slug: catSlug.trim() ? catSlug.trim() : catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      parentId: catParentId === 'none' ? null : catParentId,
      pageNumber: Number(catPageNum) || 1,
      rowOrder: Number(catRowOrder) || 1,
      description: catDesc,
      icon: catIcon,
      bannerImage: catBannerImage,
      status: catStatus,
    };

    let updatedCats: CategoryItem[];
    if (editingCategory) {
      updatedCats = categoryItems.map(c => c.id === editingCategory.id ? newCat : c);
    } else {
      updatedCats = [...categoryItems, newCat];
    }

    updateConfig({ ...appConfig, categoryItems: updatedCats });
    if (!editingCategory) {
      setPCategories((prev) =>
        prev.includes(catName.trim()) ? prev : [...prev, catName.trim()],
      );
    }
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setCatName('');
    setCatSlug('');
    setCatParentId('none');
    setCatDesc('');
    setCatBannerImage('');
  };

  // Delete Category
  const handleDeleteCategory = async (catId: string) => {
    const ok = await confirmAsync({
      title: 'Delete category',
      message: 'Are you sure you want to delete this category?',
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    const updated = categoryItems.filter(c => c.id !== catId);
    updateConfig({ ...appConfig, categoryItems: updated });
  };

  const handleMoveCategoryRow = (catId: string, direction: 'up' | 'down') => {
    const updated = categoryItems.map(c => {
      if (c.id === catId) {
        const nextRow = direction === 'up' ? Math.max(1, c.rowOrder - 1) : c.rowOrder + 1;
        return { ...c, rowOrder: nextRow };
      }
      return c;
    });
    updateConfig({ ...appConfig, categoryItems: updated });
  };

  // Bulk Export JSON / CSV (Excel-compatible)
  const csvEscape = (value: unknown): string => {
    const raw = value == null ? '' : String(value);
    const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (/[",\n]/.test(normalized)) {
      return `"${normalized.replace(/"/g, '""')}"`;
    }
    return normalized;
  };

  const handleExportData = (type: 'json' | 'csv') => {
    if (type === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(products, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `epic_vanskap_products_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      return;
    }

    // Microsoft Excel CSV: UTF-8 BOM + CRLF + quoted fields
    const headers = [
      'ID',
      'Product Name',
      'SKU',
      'Barcode',
      'Brand',
      'Season',
      'Year',
      'Category',
      'Categories',
      'Target Page',
      'Page Name',
      'Page Number',
      'Row Order',
      'Cost Price (BDT)',
      'Original Price (BDT)',
      'Sale Price (BDT)',
      'Discount (BDT)',
      'Current Stock',
      'Alert Threshold',
      'Sizes',
      'Size Stocks',
      'Stock Status',
      'Clearance',
      'Damaged',
      'Damaged Qty',
      'Pre-Order',
      'Pre-Order ETA',
      'Warehouse',
      'Bin Code',
      'Gender',
      'Condition',
      'Color',
      'League',
      'Club',
      'National Team',
      'Tags',
      'Status',
      'Featured',
      'Best Seller',
      'Short Description',
      'Long Description',
    ];

    const rows = products.map((p) => {
      const sizeStocks =
        p.sizeStocks && typeof p.sizeStocks === 'object'
          ? Object.entries(p.sizeStocks)
              .map(([sz, qty]) => `${sz}:${qty}`)
              .join('; ')
          : '';
      const stockQty = Number(p.stock) || 0;
      const threshold = Number(p.lowStockThreshold) || 0;
      let stockStatus = 'In Stock';
      if (stockQty <= 0) stockStatus = 'Out of Stock';
      else if (threshold > 0 && stockQty <= threshold) stockStatus = 'Low Stock';

      return [
        p.id,
        p.name || '',
        p.sku || '',
        p.barcode || '',
        p.brand || '',
        p.season || '',
        p.year ?? '',
        p.category || '',
        Array.isArray(p.categories) ? p.categories.join('; ') : '',
        p.targetPage || '',
        p.pageName || '',
        p.pageNumber ?? '',
        p.categoryRow ?? '',
        p.costPrice ?? '',
        p.originalPrice ?? '',
        p.price ?? '',
        p.discount ?? '',
        stockQty,
        threshold,
        Array.isArray(p.sizes) ? p.sizes.join('; ') : '',
        sizeStocks,
        stockStatus,
        p.isClearance ? 'Yes' : 'No',
        p.isDamaged ? 'Yes' : 'No',
        p.damagedQty ?? 0,
        p.isPreOrder ? 'Yes' : 'No',
        p.preOrderEta || '',
        p.warehouse || '',
        p.binCode || '',
        p.gender || '',
        p.condition || '',
        p.color || '',
        p.league || '',
        p.club || '',
        p.nationalTeam || p.country || '',
        Array.isArray(p.tags) ? p.tags.join('; ') : '',
        p.status || 'Active',
        p.isFeatured ? 'Yes' : 'No',
        p.isBestSeller ? 'Yes' : 'No',
        p.shortDescription || '',
        p.longDescription || p.description || '',
      ].map(csvEscape);
    });

    const csvBody = [headers.map(csvEscape).join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    // BOM helps Excel on Windows detect UTF-8
    const blob = new Blob(['\uFEFF' + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = `epic_vanskap_inventory_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  // Bulk Import
  const handleProcessImport = () => {
    try {
      if (!importText.trim()) return;
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed)) {
        setProducts(prev => [...parsed, ...prev]);
        setImportStatus(`Successfully imported ${parsed.length} products!`);
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportText('');
          setImportStatus(null);
        }, 1200);
      } else {
        setImportStatus('Invalid JSON format. Must be an array of product objects.');
      }
    } catch (err: any) {
      setImportStatus(`Parse error: ${err.message}`);
    }
  };

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Status Filter (Active | Draft | All)
      if (p.status === 'Trashed' || p.isTrashed) return false;
      if (p.isArchived || p.status === 'Archived') return false;
      if (productStatusFilter !== 'All') {
        const status = p.status === 'Draft' ? 'Draft' : 'Active';
        if (status !== productStatusFilter) return false;
      }

      // Page Filter
      if (filterPage !== 'All') {
        const filterLower = String(filterPage).toLowerCase().trim();
        const pageMatches =
          p.targetPage?.toLowerCase().trim() === filterLower ||
          p.pageName?.toLowerCase().trim() === filterLower ||
          p.category?.toLowerCase().trim() === filterLower ||
          (p.pageNumber && String(p.pageNumber) === filterLower) ||
          (filterLower === '1' && (p.pageNumber === 1 || !p.pageNumber));
        if (!pageMatches) return false;
      }

      // Category Filter
      if (filterCategory !== 'All' && p.category?.toLowerCase() !== filterCategory.toLowerCase()) return false;

      // Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesSku = p.sku?.toLowerCase().includes(q);
        const matchesBarcode = p.barcode?.toLowerCase().includes(q);
        const matchesBrand = p.brand.toLowerCase().includes(q);
        const matchesCategory = p.category?.toLowerCase().includes(q);
        const matchesPlayer = p.player?.name.toLowerCase().includes(q);
        return matchesName || matchesSku || matchesBarcode || matchesBrand || matchesCategory || matchesPlayer;
      }

      return true;
    });
  }, [products, productStatusFilter, filterPage, filterCategory, searchTerm]);

  // Inventory Filtered Products
  const inventoryProducts = useMemo(() => {
    return products.filter(p => {
      const isNotTrashed = !p.isTrashed && p.status !== 'Trashed';
      if (!isNotTrashed) return false;

      if (inventorySubTab === 'low-stock') {
        const threshold = p.lowStockThreshold || 3;
        return p.stock > 0 && p.stock <= threshold;
      }
      if (inventorySubTab === 'out-of-stock') {
        return p.stock === 0;
      }
      if (inventorySubTab === 'clearance') {
        return p.isClearance || (p.discount && p.discount > 0);
      }
      if (inventorySubTab === 'damaged') {
        return p.isDamaged || (p.damagedQty && p.damagedQty > 0);
      }
      return true;
    });
  }, [products, inventorySubTab]);

  // Inventory Metrics
  const totalStockUnits = products.reduce((acc, p) => acc + (p.stock || 0), 0);
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= (p.lowStockThreshold || 3) && !p.isTrashed).length;
  const outOfStockCount = products.filter(p => p.stock === 0 && !p.isTrashed).length;
  const clearanceCount = products.filter(p => (p.isClearance || (p.discount && p.discount > 0)) && !p.isTrashed).length;
  const damagedCount = products.filter(p => (p.isDamaged || (p.damagedQty && p.damagedQty > 0)) && !p.isTrashed).length;

  // Statistics
  const activeCount = products.filter(p => (!p.status || p.status === 'Active') && !p.isArchived && p.status !== 'Archived' && !p.isTrashed).length;
  const draftCount = products.filter(p => p.status === 'Draft' && !p.isTrashed).length;

  return (
    <div className="space-y-6">
      
      {/* Header Deck */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-100 pb-4">
        <div>
          <h3 className="text-base font-bold uppercase text-emerald-950 flex items-center gap-2">
            <Shirt className="text-emerald-800" size={18} />
            PRODUCT & CATALOGUE MANAGEMENT
          </h3>
          <p className="text-[11px] text-emerald-700 font-mono">
            Full control over products, stock alerts, damaged/clearance items, stock history, nested categories, and page row placement.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetProductForm();
              setIsProductModalOpen(true);
            }}
            className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Product</span>
          </button>
          
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload size={14} />
            <span>Bulk Import</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportData('csv')}
            className="bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50 text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Export all inventory data as Excel CSV"
          >
            <Download size={14} />
            <span>Bulk Export</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-emerald-200 gap-4 text-xs font-bold overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'products' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-emerald-600 hover:text-emerald-900'
          }`}
        >
          <Grid size={15} />
          <span>Product Catalog ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-emerald-600 hover:text-emerald-900'
          }`}
        >
          <Box size={15} />
          <span>Inventory Management</span>
          {lowStockCount + outOfStockCount > 0 && (
            <span className="bg-rose-600 text-white font-mono text-[9px] px-1.5 py-0.2 rounded-full">
              {lowStockCount + outOfStockCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'categories' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-emerald-600 hover:text-emerald-900'
          }`}
        >
          <Layers size={15} />
          <span>Categories & Nested Rows ({categoryItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('import-export')}
          className={`pb-2.5 px-1 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'import-export' ? 'border-emerald-800 text-emerald-900' : 'border-transparent text-emerald-600 hover:text-emerald-900'
          }`}
        >
          <FileText size={15} />
          <span>Data Import / Export</span>
        </button>
      </div>

      {/* TAB 1: PRODUCT CATALOG MANAGER */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          
          {/* Status Sub-Filters & Quick Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProductStatusFilter('All')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  productStatusFilter === 'All' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-white text-emerald-900 border hover:bg-emerald-100'
                }`}
              >
                All ({activeCount + draftCount})
              </button>
              <button
                type="button"
                onClick={() => setProductStatusFilter('Active')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  productStatusFilter === 'Active' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-white text-emerald-900 border hover:bg-emerald-100'
                }`}
              >
                Active ({activeCount})
              </button>

              <button
                type="button"
                onClick={() => setProductStatusFilter('Draft')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  productStatusFilter === 'Draft' ? 'bg-emerald-800 text-white shadow-sm' : 'bg-white text-emerald-900 border hover:bg-emerald-100'
                }`}
              >
                Drafts ({draftCount})
              </button>
            </div>

            {/* Page & Category Filter Pickers */}
            <div className="flex items-center gap-2 text-xs">
              <label className="font-bold text-emerald-950 flex items-center gap-1">
                <span>Page:</span>
                <select
                  value={filterPage}
                  onChange={(e) => setFilterPage(e.target.value)}
                  className="bg-white border border-emerald-200 rounded-lg px-2 py-1 font-semibold text-xs text-emerald-950 outline-none max-w-[200px] truncate"
                >
                  <option value="All">All Connected Pages</option>
                  {storefrontPages.map(pg => (
                    <option key={pg.id} value={pg.name}>{pg.name}</option>
                  ))}
                </select>
              </label>

              <label className="font-bold text-emerald-950 flex items-center gap-1">
                <span>Category:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-white border border-emerald-200 rounded-lg px-2 py-1 font-semibold text-xs text-emerald-950 outline-none"
                >
                  <option value="All">All Categories</option>
                  {categoryItems.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
            <input
              type="text"
              placeholder="Search by Product Name, SKU, Brand, League, Player Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-emerald-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-emerald-950 font-medium placeholder-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          {/* Product Table Grid */}
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-50/80 border-b border-emerald-100 text-emerald-900 font-bold uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">Product / Thumbnail</th>
                    <th className="p-3">Page & Category Row</th>
                    <th className="p-3">Brand & Season</th>
                    <th className="p-3">SKU / Code</th>
                    <th className="p-3">Barcode</th>
                    <th className="p-3">Cost vs Selling Price</th>
                    <th className="p-3">Stock & Tags</th>
                    <th className="p-3 text-right min-w-[11rem]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100/80">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-emerald-50/30 transition-colors">
                        {/* Thumbnail & Name */}
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              title="View product images"
                              onClick={() => setGalleryViewer({ product: prod, index: 0 })}
                              className="relative w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
                            >
                              {isRenderableImageSrc(prod.uploadedImage || prod.image) ? (
                                <img src={prod.uploadedImage || prod.image} alt={prod.name} className="w-full h-full object-cover" />
                              ) : (
                                <JerseyRenderer productId={prod.id} imageKey={prod.image} uploadedImage={prod.uploadedImage} />
                              )}
                              <span className="absolute bottom-0 right-0 bg-emerald-900 text-white font-mono text-[8px] font-bold px-1 rounded-tl flex items-center gap-0.5">
                                <Eye size={8} /> {Math.max(1, getProductGallery(prod).length)}
                              </span>
                            </button>
                            <div>
                              <p className="font-bold text-emerald-950 max-w-[220px] truncate">{prod.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded">
                                  {prod.condition || 'Mint'}
                                </span>
                                {prod.gender && (
                                  <span className="bg-gray-100 text-gray-800 text-[9px] font-mono px-1.5 py-0.2 rounded">
                                    {prod.gender}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setGalleryViewer({ product: prod, index: 0 })}
                                  className="text-[9px] font-bold text-emerald-700 hover:text-emerald-950 underline cursor-pointer"
                                >
                                  View images
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Page & Category Row */}
                        <td className="p-3 font-mono text-[11px]">
                          <div className="space-y-0.5">
                            <span className="font-bold text-emerald-950 bg-emerald-100/80 px-2 py-0.5 rounded text-[10px] inline-block border border-emerald-200">
                              {prod.targetPage || prod.pageName || `Page ${prod.pageNumber || 1}`}
                            </span>
                            <p className="text-[10px] text-emerald-700 font-sans font-semibold mt-0.5">
                              {prod.category || 'World Cup'} • Row {prod.categoryRow || 1}
                            </p>
                          </div>
                        </td>

                        {/* Brand & Season */}
                        <td className="p-3 font-medium">
                          <p className="font-bold text-emerald-950">{prod.brand}</p>
                          <p className="text-[10px] text-emerald-700">{prod.season} ({prod.year})</p>
                        </td>

                        {/* SKU */}
                        <td className="p-3 font-mono text-[10px] font-bold text-emerald-800">
                          {prod.sku || 'N/A'}
                        </td>
                        <td className="p-3">
                          {prod.barcode ? (
                            <span className="inline-block bg-zinc-950 text-white text-[10px] font-mono font-bold px-2 py-1 rounded-full">
                              {prod.barcode}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-400">—</span>
                          )}
                        </td>

                        {/* Pricing */}
                        <td className="p-3">
                          <div className="space-y-0.5 font-mono text-[11px]">
                            <p className="font-bold text-emerald-950">{formatPrice(prod.price)}</p>
                            {prod.originalPrice != null && prod.originalPrice > prod.price && (
                              <p className="text-[10px] text-rose-700 font-mono">
                                <span className="line-through opacity-60">{formatPrice(prod.originalPrice)}</span>
                                {' '}
                                {Math.round(((prod.originalPrice - prod.price) / prod.originalPrice) * 100)}% OFF
                              </p>
                            )}
                            {prod.costPrice ? (
                              <p className="text-[10px] text-emerald-600">Cost: {formatPrice(prod.costPrice)}</p>
                            ) : null}
                          </div>
                        </td>

                        {/* Stock & Tags */}
                        <td className="p-3">
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] inline-block ${
                              prod.stock > (prod.lowStockThreshold || 3) ? 'bg-emerald-100 text-emerald-900' :
                              prod.stock > 0 ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900'
                            }`}>
                              {prod.stock > 0 ? `${prod.stock} in stock` : 'Out of Stock'}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {prod.isClearance && (
                                <span className="bg-purple-100 text-purple-900 text-[8px] font-bold px-1 rounded">Clearance</span>
                              )}
                              {prod.isPreOrder && (
                                <span className="bg-amber-100 text-amber-900 text-[8px] font-bold px-1 rounded">Pre-Order</span>
                              )}
                              {prod.isDamaged && (
                                <span className="bg-rose-100 text-rose-900 text-[8px] font-bold px-1 rounded">Damaged ({prod.damagedQty || 1})</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Action Buttons */}
                        <td className="p-3 text-right min-w-[11rem]">
                          <div className="flex items-center justify-end gap-2 flex-nowrap">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(prod)}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 hover:border-emerald-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                              title="Edit Product"
                              aria-label="Edit Product"
                            >
                              <Edit size={16} strokeWidth={2.25} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setLabelPrint({
                                  barcode: prod.barcode || '',
                                  sellPrice: prod.sellingPrice || prod.price,
                                  name: prod.name,
                                });
                              }}
                              className="inline-flex items-center justify-center px-2 h-9 rounded-lg border-2 border-zinc-800 bg-white text-zinc-900 text-[10px] font-bold uppercase shadow-sm hover:bg-zinc-50 transition-all cursor-pointer"
                              title="Print barcode label"
                            >
                              Barcode
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDuplicateProduct(prod)}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 border-emerald-600 bg-white text-emerald-800 shadow-sm hover:bg-emerald-50 hover:border-emerald-700 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                              title="Duplicate Product"
                              aria-label="Duplicate Product"
                            >
                              <Copy size={16} strokeWidth={2.25} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleDraft(prod)}
                              className="inline-flex items-center justify-center px-2 h-9 rounded-lg border-2 border-zinc-800 bg-white text-zinc-900 text-[10px] font-bold uppercase shadow-sm hover:bg-zinc-50 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-1"
                              title={prod.status === 'Draft' ? 'Publish as Active' : 'Move to Draft'}
                              aria-label={prod.status === 'Draft' ? 'Publish as Active' : 'Move to Draft'}
                            >
                              {prod.status === 'Draft' ? 'Publish' : 'Draft'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(prod)}
                              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 border-rose-700 bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:border-rose-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
                              title="Delete Product"
                              aria-label="Delete Product"
                            >
                              <Trash2 size={16} strokeWidth={2.25} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-emerald-600 font-medium">
                        No products found in this category or search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          
          {/* Inventory Metrics Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white border border-emerald-100 p-4 rounded-2xl shadow-sm space-y-1">
              <p className="text-[10px] font-mono text-emerald-700 font-bold uppercase">Total In-Stock Units</p>
              <p className="text-xl font-extrabold text-emerald-950 font-mono">{totalStockUnits}</p>
            </div>

            <div className="bg-amber-50/50 border border-amber-200 p-4 rounded-2xl shadow-sm space-y-1">
              <p className="text-[10px] font-mono text-amber-800 font-bold uppercase flex items-center gap-1">
                <AlertTriangle size={12} /> Low Stock Alert
              </p>
              <p className="text-xl font-extrabold text-amber-950 font-mono">{lowStockCount} items</p>
            </div>

            <div className="bg-rose-50/50 border border-rose-200 p-4 rounded-2xl shadow-sm space-y-1">
              <p className="text-[10px] font-mono text-rose-800 font-bold uppercase flex items-center gap-1">
                <AlertCircle size={12} /> Out of Stock
              </p>
              <p className="text-xl font-extrabold text-rose-950 font-mono">{outOfStockCount} items</p>
            </div>

            <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-2xl shadow-sm space-y-1">
              <p className="text-[10px] font-mono text-purple-800 font-bold uppercase flex items-center gap-1">
                <Tag size={12} /> Clearance Stock
              </p>
              <p className="text-xl font-extrabold text-purple-950 font-mono">{clearanceCount} items</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl shadow-sm space-y-1">
              <p className="text-[10px] font-mono text-gray-800 font-bold uppercase flex items-center gap-1">
                <ShieldCheck size={12} /> Damaged / Write-off
              </p>
              <p className="text-xl font-extrabold text-gray-950 font-mono">{damagedCount} items</p>
            </div>
          </div>

          {/* Sub-Tabs for Inventory Filters */}
          <div className="flex border-b border-emerald-100 gap-2 text-xs font-bold overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setInventorySubTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                inventorySubTab === 'all' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
              }`}
            >
              Current Stock ({products.length})
            </button>

            <button
              type="button"
              onClick={() => setInventorySubTab('low-stock')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                inventorySubTab === 'low-stock' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Low Stock Alerts ({lowStockCount})
            </button>

            <button
              type="button"
              onClick={() => setInventorySubTab('out-of-stock')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                inventorySubTab === 'out-of-stock' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              Out of Stock ({outOfStockCount})
            </button>

            <button
              type="button"
              onClick={() => setInventorySubTab('clearance')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                inventorySubTab === 'clearance' ? 'bg-purple-800 text-white' : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              Clearance Products ({clearanceCount})
            </button>

            <button
              type="button"
              onClick={() => setInventorySubTab('damaged')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                inventorySubTab === 'damaged' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              Damaged / Write-off ({damagedCount})
            </button>

            <button
              type="button"
              onClick={() => setInventorySubTab('history')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                inventorySubTab === 'history' ? 'bg-emerald-950 text-white' : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              <History size={13} />
              <span>Stock History Log ({stockLogs.length})</span>
            </button>
          </div>

          {/* INVENTORY TABLE OR STOCK HISTORY LOG TABLE */}
          {inventorySubTab !== 'history' ? (
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-50/80 border-b border-emerald-100 text-emerald-900 font-bold uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">Current Stock</th>
                      <th className="p-3">Alert Threshold</th>
                      <th className="p-3">Clearance / Damaged Status</th>
                      <th className="p-3 text-right">Quick Stock Adjustment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100/80">
                    {inventoryProducts.length > 0 ? (
                      inventoryProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {isRenderableImageSrc(p.uploadedImage || p.image) ? (
                                <img src={p.uploadedImage || p.image} alt={p.name} className="w-10 h-10 object-cover rounded-lg border border-emerald-100" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg border border-emerald-100 bg-emerald-50 overflow-hidden">
                                  <JerseyRenderer productId={p.id} imageKey={p.image} uploadedImage={p.uploadedImage} />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-emerald-950">{p.name}</p>
                                <p className="text-[10px] text-emerald-700">{p.brand} • {p.category}</p>
                              </div>
                            </div>
                          </td>

                          <td className="p-3 font-mono text-emerald-800 font-bold">
                            {p.sku}
                          </td>

                          <td className="p-3 font-mono font-extrabold text-sm">
                            <span className={`px-2.5 py-1 rounded-lg ${
                              p.stock > (p.lowStockThreshold || 3) ? 'bg-emerald-100 text-emerald-950' :
                              p.stock > 0 ? 'bg-amber-100 text-amber-950' : 'bg-rose-100 text-rose-950'
                            }`}>
                              {p.stock} units
                            </span>
                          </td>

                          <td className="p-3 font-mono text-emerald-700">
                            ≤ {p.lowStockThreshold || 3} units
                          </td>

                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              {p.isClearance ? (
                                <span className="bg-purple-100 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  Clearance Sale
                                </span>
                              ) : <span className="text-[10px] text-emerald-600 font-mono">Standard Stock</span>}
                              {p.isDamaged && (
                                <span className="bg-rose-100 text-rose-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  Damaged Qty: {p.damagedQty || 1}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setStockModalProduct(p);
                                setStockChangeAmount(1);
                                setStockReason('Supplier Receiving');
                                setIsStockModalOpen(true);
                              }}
                              className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <RefreshCw size={13} />
                              <span>Adjust Stock</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-emerald-600 font-medium">
                          No inventory items match this stock status filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* STOCK HISTORY AUDIT LOG TABLE */
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden space-y-3 p-4">
              <div className="flex justify-between items-center border-b border-emerald-100 pb-2">
                <h4 className="font-bold text-xs text-emerald-950 uppercase flex items-center gap-1.5">
                  <History size={15} className="text-emerald-800" />
                  CHRONOLOGICAL STOCK MOVEMENT AUDIT TRAIL
                </h4>
                <span className="text-[10px] font-mono text-emerald-700">Auto-recorded restocks & deductions</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-emerald-50/80 text-emerald-900 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Product Name</th>
                      <th className="p-2.5">SKU</th>
                      <th className="p-2.5">Previous Qty</th>
                      <th className="p-2.5">Adjustment</th>
                      <th className="p-2.5">New Qty</th>
                      <th className="p-2.5">Reason</th>
                      <th className="p-2.5">Updated By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100">
                    {stockLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-emerald-50/40">
                        <td className="p-2.5 text-emerald-800">{log.timestamp}</td>
                        <td className="p-2.5 font-bold font-sans text-emerald-950">{log.productName}</td>
                        <td className="p-2.5 text-emerald-700">{log.sku}</td>
                        <td className="p-2.5 text-gray-600">{log.previousStock}</td>
                        <td className="p-2.5 font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            log.change > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                          }`}>
                            {log.change > 0 ? `+${log.change}` : log.change}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-emerald-950">{log.newStock}</td>
                        <td className="p-2.5 font-sans font-semibold text-emerald-900">{log.reason}</td>
                        <td className="p-2.5 text-emerald-700">{log.user || 'System'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CATEGORIES & NESTED ROWS */}
      {activeTab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h4 className="font-bold text-emerald-950 uppercase text-xs">PAGE, CATEGORY & NESTED SUB-CATEGORY MANAGEMENT</h4>
              <p className="text-[10px] text-emerald-700 font-mono">
                Create parent/child nested categories with icons, banner graphics, page assignments, and row sequence order.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirmAsync({
                    title: 'Load preset categories',
                    message:
                      'Load all preset categories (leagues, Retro, Player Edition, Fan Edition, Jacket, Track Suit, Badminton Racket, Trouser, Polo, Football, Shorts, Boots, and more)?',
                    confirmText: 'Load presets',
                  });
                  if (!ok) return;
                  updateConfig({ ...appConfig, categoryItems: defaultCategories });
                  toast('Loaded all 15 preset categories', 'success');
                }}
                className="bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border border-emerald-300 text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                title="Load all 15 preset example categories"
              >
                <RefreshCw size={14} />
                <span>Load 15 Preset Categories</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setCatName('');
                  setCatSlug('');
                  setCatParentId('none');
                  setCatPageNum(1);
                  setCatRowOrder(1);
                  setCatDesc('');
                  setCatBannerImage('');
                  setIsCategoryModalOpen(true);
                }}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus size={15} />
                <span>Create Category</span>
              </button>
            </div>
          </div>

          {/* Group Categories by Connected Front Page */}
          {storefrontPages.map((page) => {
            const pageCats = categoryItems
              .filter(c => c.pageNumber === page.pageNumber || c.pageName === page.name || c.targetPage === page.name)
              .sort((a, b) => a.rowOrder - b.rowOrder);

            if (pageCats.length === 0 && page.pageNumber > 4) return null;

            return (
              <div key={page.id} className="bg-white rounded-2xl border border-emerald-100 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-800 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded uppercase">
                      PAGE {page.pageNumber}
                    </span>
                    <h5 className="font-bold text-xs text-emerald-950 uppercase">
                      {page.name}
                    </h5>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700">
                    {pageCats.length} Categories in Rows
                  </span>
                </div>

                <div className="space-y-3">
                  {pageCats.length > 0 ? (
                    pageCats.map((cat) => {
                      const prodsInCat = products.filter(p => p.category?.toLowerCase() === cat.name.toLowerCase());
                      const isChild = !!cat.parentId;
                      const parentCat = categoryItems.find(c => c.id === cat.parentId);
                      const IconComponent = CATEGORY_ICONS.find(i => i.id === cat.icon)?.icon || Shirt;

                      return (
                        <div 
                          key={cat.id} 
                          className={`border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                            isChild ? 'bg-emerald-50/20 border-emerald-200 ml-6 md:ml-10 border-l-4 border-l-emerald-600' : 'bg-white border-emerald-100'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-emerald-100 text-emerald-800 font-mono text-xs font-black rounded-lg">
                              ROW {cat.rowOrder}
                            </span>

                            <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center flex-shrink-0">
                              <IconComponent size={18} />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                {isChild && <CornerDownRight size={14} className="text-emerald-600" />}
                                <p className="font-bold text-xs text-emerald-950">{cat.name}</p>
                                {isChild && parentCat && (
                                  <span className="bg-emerald-100 text-emerald-900 text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold">
                                    Subcategory of {parentCat.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-emerald-700">{cat.description || 'No description provided'}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block">
                                  {prodsInCat.length} Linked Shirts
                                </span>
                                {cat.bannerImage && (
                                  <span className="text-[9px] font-mono text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 inline-block">
                                    ✓ Custom Banner Uploaded
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleMoveCategoryRow(cat.id, 'up')}
                              className="p-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 rounded-lg cursor-pointer"
                              title="Move Row Up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveCategoryRow(cat.id, 'down')}
                              className="p-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 rounded-lg cursor-pointer"
                              title="Move Row Down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategory(cat);
                                setCatName(cat.name);
                                setCatSlug(cat.slug);
                                setCatParentId(cat.parentId || 'none');
                                setCatPageNum(cat.pageNumber);
                                setCatRowOrder(cat.rowOrder);
                                setCatDesc(cat.description || '');
                                setCatIcon(cat.icon || 'Shirt');
                                setCatBannerImage(cat.bannerImage || '');
                                setCatStatus(cat.status || 'Active');
                                setIsCategoryModalOpen(true);
                              }}
                              className="p-1.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 cursor-pointer"
                              title="Edit Category"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg cursor-pointer"
                              title="Delete Category"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-emerald-500 font-medium py-3 italic text-center">
                      No categories assigned to {page.name} yet. Click "Create Category" to add one.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: IMPORT / EXPORT DATA */}
      {activeTab === 'import-export' && (
        <div className="bg-white rounded-2xl border border-emerald-100 p-6 space-y-6">
          <div>
            <h4 className="font-bold text-xs text-emerald-950 uppercase">PRODUCT BULK EXPORT & BACKUP TOOLS</h4>
            <p className="text-[10px] text-emerald-700 font-mono">
              Export entire catalog state or restore products from external CSV / JSON files.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 space-y-3">
              <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                <Download size={16} className="text-emerald-800" />
                Download Catalog JSON
              </h5>
              <p className="text-[11px] text-emerald-700">Full backup including images, gallery, specifications, and row ordering.</p>
              <button
                type="button"
                onClick={() => handleExportData('json')}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Download JSON Backup
              </button>
            </div>

            <div className="bg-emerald-50/40 p-5 rounded-xl border border-emerald-100 space-y-3">
              <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-2">
                <Download size={16} className="text-emerald-800" />
                Download Catalog CSV
              </h5>
              <p className="text-[11px] text-emerald-700">Spreadsheet-friendly format for Microsoft Excel or Google Sheets.</p>
              <button
                type="button"
                onClick={() => handleExportData('csv')}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                Download CSV Spreadsheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT PRODUCT — stays open until Cancel or Save (no backdrop / Escape close) */}
      {isProductModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-emerald-950/70 backdrop-blur-sm p-0 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={editingProduct ? 'Edit product' : 'Add product'}
          >
            <div
              className="bg-white sm:rounded-2xl w-full max-w-5xl max-h-[96vh] sm:max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-emerald-100 animate-fadeIn"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div className="flex items-start justify-between gap-3 px-5 sm:px-7 py-4 border-b border-emerald-100 bg-white shrink-0">
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold uppercase text-emerald-950 flex items-center gap-2 tracking-tight">
                    <Shirt size={18} className="text-emerald-800 shrink-0" />
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-mono mt-0.5 truncate">
                    {editingProduct
                      ? `Editing · ${editingProduct.name}`
                      : 'Fill in details, images, pricing & page placement'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void closeProductModal();
                  }}
                  disabled={isSavingProduct}
                  className="p-2 hover:bg-emerald-50 text-emerald-800 rounded-xl transition-colors cursor-pointer shrink-0 disabled:opacity-50 relative z-10"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
                <form
                  id="product-manager-form"
                  onSubmit={handleProductSubmit}
                  onKeyDown={(e) => {
                    // Prevent Enter in inputs from submitting / closing mid-edit
                    if (e.key !== 'Enter') return;
                    const tag = (e.target as HTMLElement)?.tagName;
                    if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
                    e.preventDefault();
                  }}
                  className="space-y-6 text-emerald-950"
                >
              {/* SECTION 1: BASIC INFORMATION */}
              <div className="space-y-4">
                <h5 className="text-xs font-mono font-bold uppercase text-emerald-800 border-b border-emerald-100 pb-1">
                  1. Basic Product Identity
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="md:col-span-2">
                    <label className="font-bold text-emerald-950 block mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. England 1998 World Cup Home Shirt"
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-medium"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Brand *</label>
                    <select
                      required
                      value={pBrand}
                      onChange={(e) => {
                        setPBrand(e.target.value);
                        if (e.target.value !== 'Other') setPBrandCustom('');
                      }}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-medium"
                    >
                      <option value="" disabled>
                        Select brand
                      </option>
                      {PRODUCT_BRANDS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                    {pBrand === 'Other' && (
                      <input
                        type="text"
                        required
                        placeholder="Type brand name"
                        value={pBrandCustom}
                        onChange={(e) => setPBrandCustom(e.target.value)}
                        className="w-full mt-2 bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2"
                      />
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Season</label>
                    <input
                      type="text"
                      placeholder="e.g. 1998/99 or 2025/26"
                      value={pSeason}
                      onChange={(e) => setPSeason(e.target.value)}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Gender</label>
                    <select
                      value={pGender}
                      onChange={(e) => setPGender(e.target.value)}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-medium"
                    >
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                      <option value="Unisex">Unisex</option>
                      <option value="Kids">Kids</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 text-xs">
                  <div className="rounded-xl border border-emerald-200 bg-white/80 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-emerald-950 block">Long Description</label>
                      <span className="font-mono text-[10px] text-emerald-700">
                        {pLongDesc.length.toLocaleString()} chars · shown on product page
                      </span>
                    </div>
                    <textarea
                      rows={10}
                      placeholder="Full product story, authenticity notes, fit details — this text is shown in full on the product details page…"
                      value={pLongDesc}
                      onChange={(e) => setPLongDesc(e.target.value)}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2.5 resize-y min-h-[180px] text-sm leading-relaxed text-emerald-950"
                    />
                    <p className="text-[10px] text-emerald-700 font-mono mt-1">
                      No character limit. Customers see the complete description next to the buy panel.
                    </p>
                  </div>
                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Key Features (Comma Separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Official Patches, Vintage Collar, Sublimated Sponsor"
                      value={pFeatures}
                      onChange={(e) => setPFeatures(e.target.value)}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: PAGE ASSIGNMENT, CATEGORY & ROW POSITION */}
              <div className="space-y-4">
                <h5 className="text-xs font-mono font-bold uppercase text-emerald-800 border-b border-emerald-100 pb-1">
                  2. Page Assignment, Category & Row Position
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-emerald-950 block">Target Page *</label>
                      <button
                        type="button"
                        onClick={() => setIsAddPageModalOpen(true)}
                        className="text-[10px] font-mono font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add New Page
                      </button>
                    </div>
                    <select
                      value={
                        storefrontPages.find((p) => p.id === pTargetPage || p.name === pTargetPage)
                          ?.id || pTargetPage
                      }
                      onChange={(e) => {
                        if (e.target.value === 'ADD_NEW') {
                          setIsAddPageModalOpen(true);
                        } else {
                          setPTargetPage(e.target.value);
                          const matchedPg = storefrontPages.find(
                            (p) => p.id === e.target.value || p.name === e.target.value,
                          );
                          if (matchedPg) setPPageNumber(matchedPg.pageNumber);
                        }
                      }}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-bold text-emerald-950"
                    >
                      {storefrontPages.map((pg) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.name}
                        </option>
                      ))}
                      <option value="ADD_NEW" className="font-bold text-emerald-800">+ Add New Page...</option>
                    </select>
                    <p className="text-[10px] text-emerald-700 font-mono mt-1">
                      Nav destination (e.g. Retro Store). Products appear when shoppers open that menu.
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-emerald-950 block">Categories * (multi-select)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setCatName('');
                          setIsCategoryModalOpen(true);
                        }}
                        className="text-[10px] font-mono font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={12} /> Add New Category
                      </button>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-mono mb-1.5">
                      Select multiple — e.g. Arsenal can be Fan Edition + Player Edition + Premier League. Edition categories auto-add matching size charts.
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-50/30 p-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {productCategoryOptions.map((name) => {
                        const checked = pCategories.includes(name);
                        return (
                          <label
                            key={name}
                            className={`flex items-center gap-1.5 text-[10px] font-bold font-mono px-2 py-1.5 rounded-lg cursor-pointer border ${
                              checked
                                ? 'bg-emerald-800 text-white border-emerald-800'
                                : 'bg-white text-emerald-900 border-emerald-100 hover:border-emerald-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggleCategory(name)}
                            />
                            <span className="truncate">{name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {pCategories.length > 0 && (
                      <p className="text-[9px] font-mono text-emerald-600 mt-1">
                        Selected: {pCategories.join(' · ')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Size / Measurement Charts (multi)</label>
                    <p className="text-[10px] text-emerald-700 font-mono mb-1.5">
                      Same jersey can show Fan + Player charts. Manage custom formats under Inventory.
                    </p>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-50/30 p-2 space-y-1">
                      {availableSizeCharts.map((chart) => {
                        const checked = pSizeChartIds.includes(chart.id);
                        return (
                          <label
                            key={chart.id}
                            className={`flex items-center gap-2 text-[10px] font-bold font-mono px-2 py-1.5 rounded-lg cursor-pointer border ${
                              checked
                                ? 'bg-emerald-800 text-white border-emerald-800'
                                : 'bg-white text-emerald-900 border-emerald-100 hover:border-emerald-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggleSizeChart(chart.id)}
                            />
                            <span>{chart.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    {pSizeChartIds.includes('kids') && (
                      <p className="text-[9px] text-amber-700 mt-1 font-mono">Kids chart selected — sizes use kit numbers.</p>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Row Order Position</label>
                    <input
                      type="number"
                      min={1}
                      value={pCategoryRow}
                      onChange={(e) => setPCategoryRow(Number(e.target.value))}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>

                  <div className="md:col-span-3 rounded-xl border border-emerald-200 bg-white/80 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-emerald-950 block">
                        Tags (max {MAX_PRODUCT_TAGS} · search keywords)
                      </label>
                      <span
                        className={`font-mono text-[10px] ${
                          pTags.length >= MAX_PRODUCT_TAGS ? 'text-rose-600 font-bold' : 'text-emerald-700'
                        }`}
                      >
                        {pTags.length}/{MAX_PRODUCT_TAGS}
                      </span>
                    </div>
                    <div className="flex gap-2 items-stretch">
                      <textarea
                        rows={3}
                        value={pTagDraft}
                        placeholder={`Type or paste up to ${MAX_PRODUCT_TAGS} tags — separate with comma or semicolon\ne.g. AC Milan; Kaka; Ronaldo; Neymar; Puma`}
                        disabled={pTags.length >= MAX_PRODUCT_TAGS}
                        onChange={(e) => setPTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' || e.shiftKey) return;
                          e.preventDefault();
                          const parts = parseTagDraft(pTagDraft);
                          if (!parts.length || pTags.length >= MAX_PRODUCT_TAGS) return;
                          setPTags((prev) => mergeTags(prev, parts));
                          setPTagDraft('');
                        }}
                        className="flex-1 bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 disabled:opacity-50 text-sm resize-y min-h-[4.5rem]"
                      />
                      <button
                        type="button"
                        disabled={pTags.length >= MAX_PRODUCT_TAGS || !pTagDraft.trim()}
                        onClick={() => {
                          const parts = parseTagDraft(pTagDraft);
                          if (!parts.length || pTags.length >= MAX_PRODUCT_TAGS) return;
                          setPTags((prev) => mergeTags(prev, parts));
                          setPTagDraft('');
                        }}
                        className="shrink-0 self-stretch px-3 py-2 rounded-xl bg-emerald-900 text-white font-bold text-[10px] uppercase disabled:opacity-40 cursor-pointer"
                      >
                        Add Tag
                      </button>
                    </div>
                    {pTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {pTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setPTags((prev) => prev.filter((t) => t !== tag))}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-950 text-[10px] font-bold uppercase tracking-wide border border-emerald-200 hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                            title="Remove tag"
                          >
                            {tag}
                            <span className="text-emerald-700/70">×</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-emerald-700 font-mono mt-1">
                      Write up to {MAX_PRODUCT_TAGS} tags. They appear below product photos and help customers find this jersey by name in search. Press Enter or Add Tag (Shift+Enter for new line).
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: PRODUCT IMAGES (6 uploads) */}
              <div className="space-y-4">
                <h5 className="text-xs font-mono font-bold uppercase text-emerald-800 border-b border-emerald-100 pb-1">
                  3. Product Images — Upload 6 Pictures (Mobile or PC)
                </h5>
                <p className="text-[10px] text-emerald-700 font-mono">
                  Upload from phone camera/gallery or desktop files. Slot 1 is the main card image. You can add up to 6 photos; click any product thumbnail later to view them all.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[0, 1, 2, 3, 4, 5].map((slot) => (
                    <div key={slot} className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-emerald-900 font-mono">
                          {slot === 0 ? 'Image 1 · Main' : `Image ${slot + 1}`}
                        </span>
                        {pImageSlots[slot] && (
                          <button
                            type="button"
                            onClick={() => clearImageSlot(slot)}
                            className="text-[9px] font-bold text-rose-700 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <label className="relative block aspect-square rounded-xl overflow-hidden border-2 border-dashed border-emerald-300 bg-white cursor-pointer hover:border-emerald-500 transition-colors group">
                        {pImageSlots[slot] ? (
                          <img src={pImageSlots[slot]} alt={`Slot ${slot + 1}`} className="w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-emerald-700 px-3 text-center">
                            <Upload size={22} className="text-emerald-600" />
                            <span className="text-[10px] font-bold uppercase tracking-wide">Tap to upload</span>
                            <span className="text-[9px] font-mono opacity-70">JPG / PNG / WEBP</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture={undefined}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => handleImageSlotUpload(slot, e.target.files?.[0] || null)}
                        />
                        {pImageSlots[slot] && (
                          <div className="absolute inset-0 bg-emerald-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[10px] font-black uppercase">Replace</span>
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4: INVENTORY, PRICING & STOCK ALERTS */}
              <div className="space-y-4">
                <h5 className="text-xs font-mono font-bold uppercase text-emerald-800 border-b border-emerald-100 pb-1">
                  4. Inventory, Pricing & Stock Alerts
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2 border border-emerald-100 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <label className="font-bold text-emerald-950">SKU</label>
                      <div className="flex rounded-lg border border-emerald-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setPSkuMode('auto');
                            setPSku(nextSkuSequence(products.map((p) => p.sku), 'EV'));
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase ${pSkuMode === 'auto' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-700'}`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setPSkuMode('manual')}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase ${pSkuMode === 'manual' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-700'}`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                    <input
                      value={pSku}
                      onChange={(e) => {
                        setPSkuMode('manual');
                        setPSku(e.target.value);
                      }}
                      readOnly={pSkuMode === 'auto'}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono font-bold"
                      placeholder="EV-000001"
                    />
                  </div>
                  <div className="space-y-2 border border-emerald-100 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="font-bold text-emerald-950">Barcode</label>
                      <div className="flex rounded-lg border border-emerald-200 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setPBarcodeMode('auto');
                            setPBarcode(
                              nextSerialEan13(
                                products.map((p) => p.barcode),
                                editingProduct?.barcode,
                              ),
                            );
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer ${pBarcodeMode === 'auto' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-700'}`}
                        >
                          Auto
                        </button>
                        <button
                          type="button"
                          onClick={() => setPBarcodeMode('manual')}
                          className={`px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer ${pBarcodeMode === 'manual' ? 'bg-zinc-950 text-white' : 'bg-white text-zinc-700'}`}
                        >
                          Manual
                        </button>
                      </div>
                    </div>
                    <input
                      value={pBarcode}
                      onChange={(e) => {
                        setPBarcodeMode('manual');
                        setPBarcode(e.target.value);
                      }}
                      readOnly={pBarcodeMode === 'auto'}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono font-bold"
                      placeholder="Auto serial EAN-13"
                    />
                    <p className="text-[10px] text-emerald-700 font-mono">
                      Auto assigns a unique serial barcode for every product (never reused).
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <MoneyField
                    label="Original Price (MRP)"
                    value={pOriginalPrice}
                    onChange={setPOriginalPrice}
                    required
                    placeholder="e.g. 1150"
                    hint="Integers only — no decimals"
                  />

                  <MoneyField
                    label="Cost Price"
                    value={pCostPrice}
                    onChange={setPCostPrice}
                    placeholder="e.g. 800"
                  />

                  <div className="col-span-2 md:col-span-2 space-y-2">
                    <label className="font-bold text-emerald-950 block mb-1 font-sans">Discount</label>
                    <div className="flex rounded-xl border border-emerald-200 overflow-hidden mb-2">
                      <button
                        type="button"
                        onClick={() => setPDiscountMode('percent')}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                          pDiscountMode === 'percent' ? 'bg-emerald-800 text-white' : 'bg-white text-emerald-800'
                        }`}
                      >
                        Percent (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPDiscountMode('amount')}
                        className={`flex-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                          pDiscountMode === 'amount' ? 'bg-emerald-800 text-white' : 'bg-white text-emerald-800'
                        }`}
                      >
                        Amount (৳)
                      </button>
                    </div>
                    {pDiscountMode === 'percent' ? (
                      <MoneyField
                        label="Discount percent"
                        value={pDiscountPercent}
                        onChange={setPDiscountPercent}
                        max={100}
                        placeholder="e.g. 10"
                        hint="Example: 10% of ৳1150 → ৳1035"
                        className="[&>label]:sr-only"
                      />
                    ) : (
                      <MoneyField
                        label="Discount amount"
                        value={pDiscountAmount}
                        onChange={setPDiscountAmount}
                        max={originalNum > 0 ? originalNum : undefined}
                        placeholder="e.g. 115"
                        className="[&>label]:sr-only"
                      />
                    )}
                  </div>

                  <MoneyField
                    label="Final Selling Price"
                    value={pFinalDraft !== null ? pFinalDraft : originalNum > 0 || discountPercentNum > 0 || discountAmountNum > 0 ? pFinalPrice : ''}
                    onChange={(next) => {
                      setPFinalDraft(next);
                      if (next !== '') applyFinalSellingPrice(next);
                    }}
                    onBlur={() => {
                      if (pFinalDraft === '') applyFinalSellingPrice('');
                      setPFinalDraft(null);
                    }}
                    placeholder="Auto or type"
                    hint={
                      pHasDiscount
                        ? `Auto: ${originalNum.toLocaleString()} − ${
                            pDiscountMode === 'percent'
                              ? `${discountPercentNum}%`
                              : `৳${discountAmountNum.toLocaleString()}`
                          } = ৳${pFinalPrice.toLocaleString()}`
                        : 'Type MRP + % discount, or set final price directly. Integers only.'
                    }
                  />

                  <div>
                    <label className="font-bold text-emerald-950 block mb-1 font-sans">Total Stock</label>
                    <div className="w-full bg-emerald-100/60 border border-emerald-200 rounded-xl px-3 py-2 font-bold font-mono">
                      {pStock}
                    </div>
                    <p className="text-[10px] text-emerald-700/70 mt-1">Sum of size quantities below</p>
                  </div>
                </div>

                {pHasDiscount && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2 text-[11px] font-mono text-rose-800">
                    Storefront preview:{' '}
                    <span className="line-through opacity-70">৳{originalNum.toLocaleString()}</span>
                    {' → '}
                    <span className="font-black">৳{pFinalPrice.toLocaleString()}</span>
                    {' '}
                    <span className="font-black">
                      ({calcDiscountPercent(originalNum, pFinalPrice)}% OFF)
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="font-bold text-emerald-950 block text-xs">Size availability (qty per size)</label>
                  <p className="text-[10px] text-emerald-800/70">
                    Enable sizes and type stock qty (integers only). Leave blank until you enter a number — no prefilled values.
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {STANDARD_SIZES.map((sz) => {
                      const enabled = Object.prototype.hasOwnProperty.call(pSizeStocks, sz);
                      return (
                        <div
                          key={sz}
                          className={`rounded-xl border p-2 ${enabled ? 'border-emerald-300 bg-emerald-50/50' : 'border-emerald-100 bg-white/40 opacity-70'}`}
                        >
                          <label className="flex items-center gap-1.5 text-[10px] font-bold font-mono mb-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => {
                                setPSizeStocks((prev) => {
                                  const next = { ...prev };
                                  if (e.target.checked) next[sz] = '';
                                  else delete next[sz];
                                  return next;
                                });
                              }}
                              className="w-3.5 h-3.5"
                            />
                            {sz}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={!enabled}
                            value={enabled ? (pSizeStocks[sz] === '' || pSizeStocks[sz] == null ? '' : String(pSizeStocks[sz])) : ''}
                            onChange={(e) => {
                              const n = parseMoneyDraft(e.target.value);
                              setPSizeStocks((prev) => ({ ...prev, [sz]: n }));
                            }}
                            className="w-full bg-white border border-emerald-200 rounded-lg px-2 py-1 font-mono text-xs font-bold disabled:bg-zinc-100"
                            placeholder="Qty"
                          />
                        </div>
                      );
                    })}
                  </div>
                  {Object.keys(pSizeStocks)
                    .filter((sz) => !STANDARD_SIZES.includes(sz))
                    .map((sz) => (
                      <div key={sz} className="flex items-center gap-2 max-w-xs">
                        <span className="text-xs font-mono font-bold w-12">{sz}</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={pSizeStocks[sz] === '' || pSizeStocks[sz] == null ? '' : String(pSizeStocks[sz])}
                          onChange={(e) => {
                            const n = parseMoneyDraft(e.target.value);
                            setPSizeStocks((prev) => ({ ...prev, [sz]: n }));
                          }}
                          className="flex-1 bg-white border border-emerald-200 rounded-lg px-2 py-1 font-mono text-xs font-bold"
                          placeholder="Qty"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPSizeStocks((prev) => {
                              const next = { ...prev };
                              delete next[sz];
                              return next;
                            })
                          }
                          className="text-[10px] font-bold text-rose-600 uppercase"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  <div className="flex items-center gap-2 max-w-sm pt-1">
                    <input
                      type="text"
                      value={pCustomSize}
                      onChange={(e) => setPCustomSize(e.target.value.toUpperCase())}
                      placeholder="Custom size (e.g. 2XL)"
                      className="flex-1 bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const sz = pCustomSize.trim().toUpperCase();
                        if (!sz) return;
                        setPSizeStocks((prev) => ({ ...prev, [sz]: prev[sz] ?? '' }));
                        setPCustomSize('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-800 text-white text-[10px] font-bold uppercase"
                    >
                      Add size
                    </button>
                  </div>
                </div>

                <div className="border border-emerald-100 rounded-2xl p-5 space-y-4 bg-emerald-50/30">
                  <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-800 flex items-center gap-2">
                    <BadgeCheck size={14} /> Customization Add-ons (BDT)
                  </h5>
                  <p className="text-[10px] text-emerald-700">
                    Set per-product custom font and tournament patch options. Customers can select multiple patches.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-3 p-4 bg-white border border-emerald-100 rounded-xl">
                      <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pPrintAvailable}
                          onChange={(e) => setPPrintAvailable(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        Enable custom font (name + number)
                      </label>
                      <div>
                        <label className="font-bold text-emerald-950 block mb-1 text-[10px] uppercase tracking-wide">
                          Font price (৳ BDT)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={pNamesetPriceBdt}
                          onChange={(e) => setPNamesetPriceBdt(Math.max(0, Number(e.target.value) || 0))}
                          disabled={!pPrintAvailable}
                          className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono text-xs disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="font-bold text-emerald-950 block mb-1 text-[10px] uppercase tracking-wide">
                          Font label (storefront)
                        </label>
                        <input
                          type="text"
                          value={pNamesetLabel}
                          onChange={(e) => setPNamesetLabel(e.target.value)}
                          disabled={!pPrintAvailable}
                          placeholder="Custom Font"
                          className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 text-xs disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 p-4 bg-white border border-emerald-100 rounded-xl md:col-span-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-emerald-950 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pBadgeAvailable}
                          onChange={(e) => setPBadgeAvailable(e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded"
                        />
                        Enable Tournament Patch on this product
                      </label>
                      <p className="text-[10px] text-emerald-700 leading-relaxed">
                        Patch options (image, name, price) are managed globally under{' '}
                        <strong>Inventory → Tournament Patch catalog</strong>. This product will offer those patches
                        when enabled — customers can select multiple.
                      </p>
                      {(appConfig.tournamentPatches?.length
                        ? appConfig.tournamentPatches
                        : pBadgeOptions
                      ).length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {(appConfig.tournamentPatches?.length
                            ? appConfig.tournamentPatches
                            : pBadgeOptions
                          ).map((patch) => (
                            <span
                              key={patch.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 px-2 py-1.5 text-[10px] font-semibold text-emerald-900"
                            >
                              {patch.image ? (
                                <img src={patch.image} alt="" className="h-6 w-6 rounded object-cover" />
                              ) : (
                                <ImageIcon size={12} className="text-emerald-500" />
                              )}
                              {patch.label || 'Untitled'} · ৳{Number(patch.priceBdt) || 0}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-emerald-950 block mb-1">Low Stock Alert Threshold</label>
                    <input
                      type="number"
                      value={pLowStockThreshold}
                      onChange={(e) => setPLowStockThreshold(Number(e.target.value))}
                      className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="clearanceCheck"
                      checked={pIsClearance}
                      onChange={(e) => setPIsClearance(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <label htmlFor="clearanceCheck" className="font-bold text-emerald-950 cursor-pointer">
                      Tag as Clearance Product
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="preOrderCheck"
                      checked={pIsPreOrder}
                      onChange={(e) => setPIsPreOrder(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <label htmlFor="preOrderCheck" className="font-bold text-emerald-950 cursor-pointer">
                      Enable Pre-Order
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="damagedCheck"
                      checked={pIsDamaged}
                      onChange={(e) => setPIsDamaged(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded"
                    />
                    <label htmlFor="damagedCheck" className="font-bold text-emerald-950 cursor-pointer">
                      Tag as Damaged Stock
                    </label>
                  </div>
                </div>

                {pIsPreOrder && (
                  <div className="mt-3">
                    <label className="font-bold text-emerald-950 block mb-1 text-xs">Pre-Order ETA (optional)</label>
                    <input
                      type="text"
                      value={pPreOrderEta}
                      onChange={(e) => setPPreOrderEta(e.target.value)}
                      placeholder="e.g. Ships in 2–3 weeks"
                      className="w-full max-w-md bg-amber-50/40 border border-amber-200 rounded-xl px-3 py-2 font-mono text-xs"
                    />
                  </div>
                )}
              </div>
                </form>
              </div>

              {/* Sticky footer — outside scroll so Save/Cancel always visible */}
              <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-4 border-t border-emerald-100 bg-white shrink-0">
                <p className="text-[11px] text-emerald-600 font-mono hidden sm:block">
                  Required fields marked with *
                </p>
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void closeProductModal();
                    }}
                    disabled={isSavingProduct}
                    className="px-5 py-2.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingProduct}
                    onClick={() => {
                      pendingSaveStatusRef.current = 'Draft';
                      setPStatus('Draft');
                      const form = document.getElementById('product-manager-form') as HTMLFormElement | null;
                      form?.requestSubmit();
                    }}
                    className="px-5 py-2.5 text-xs font-bold text-zinc-950 bg-white border border-zinc-300 hover:bg-zinc-50 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="submit"
                    form="product-manager-form"
                    disabled={isSavingProduct}
                    onClick={() => {
                      pendingSaveStatusRef.current = 'Active';
                      setPStatus('Active');
                    }}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl shadow-md cursor-pointer disabled:opacity-70 disabled:cursor-wait min-w-[8.5rem]"
                  >
                    {isSavingProduct
                      ? 'Saving…'
                      : 'Save & Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* MODAL: CREATE / EDIT CATEGORY — above product modal (z-200) */}
      {isCategoryModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
        <div className="fixed inset-0 bg-emerald-950/70 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-3xl max-w-lg w-full border border-emerald-100 shadow-2xl p-6 space-y-5 text-emerald-950"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h4 className="text-xs font-extrabold uppercase text-emerald-950 flex items-center gap-2">
                <FolderPlus size={16} className="text-emerald-800" />
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h4>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 hover:bg-emerald-50 text-emerald-800 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-emerald-950 block mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. World Cup or Jackets"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-emerald-950 block mb-1">Nested Parent Category</label>
                  <select
                    value={catParentId}
                    onChange={(e) => setCatParentId(e.target.value)}
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2"
                  >
                    <option value="none">None (Top Level Category)</option>
                    {categoryItems.filter(c => c.id !== editingCategory?.id).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-emerald-950 block mb-1">Category Icon</label>
                  <select
                    value={catIcon}
                    onChange={(e) => setCatIcon(e.target.value)}
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2"
                  >
                    {CATEGORY_ICONS.map(i => (
                      <option key={i.id} value={i.id}>{i.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-emerald-950 block mb-1">Target Page Assignment *</label>
                  <select
                    value={catPageNum}
                    onChange={(e) => setCatPageNum(Number(e.target.value))}
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-bold"
                  >
                    {storefrontPages.map((pg) => (
                      <option key={pg.id} value={pg.pageNumber}>
                        {pg.name} (Page {pg.pageNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-emerald-950 block mb-1">Row Sequence Order</label>
                  <input
                    type="number"
                    value={catRowOrder}
                    onChange={(e) => setCatRowOrder(Number(e.target.value))}
                    className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-emerald-950 block mb-1">Category Banner Image</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://res.cloudinary.com/..."
                    value={catBannerImage}
                    onChange={(e) => setCatBannerImage(e.target.value)}
                    className="flex-1 bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono text-[11px]"
                  />
                  <label className="bg-emerald-800 text-white font-extrabold text-[10px] px-3 py-2 rounded-xl cursor-pointer hover:bg-emerald-900 flex items-center">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadStoreImage(file, 'categories', {
                            maxEdge: 1600,
                            quality: 0.8,
                            maxBytes: 900_000,
                          });
                          setCatBannerImage(url);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Failed to upload category banner');
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-emerald-950 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Category description..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl cursor-pointer"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {/* MODAL: QUICK STOCK ADJUSTMENT */}
      {isStockModalOpen && stockModalProduct && (
        <div className="fixed inset-0 bg-emerald-950/70 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-emerald-100 shadow-2xl p-6 space-y-4 text-emerald-950">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h4 className="text-xs font-extrabold uppercase text-emerald-950 flex items-center gap-2">
                <Box size={16} className="text-emerald-800" />
                Quick Stock Adjustment
              </h4>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="p-1 hover:bg-emerald-50 text-emerald-800 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-emerald-50/60 p-3 rounded-xl">
                <p className="font-bold text-emerald-950">{stockModalProduct.name}</p>
                <p className="text-[10px] text-emerald-700 font-mono">SKU: {stockModalProduct.sku} • Current Stock: {stockModalProduct.stock}</p>
              </div>

              <div>
                <label className="font-bold block mb-1">Adjustment Quantity (+ / -)</label>
                <input
                  type="number"
                  value={stockChangeAmount}
                  onChange={(e) => setStockChangeAmount(Number(e.target.value))}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-mono font-bold text-sm"
                />
                <p className="text-[10px] text-emerald-600 mt-1 font-mono">
                  New calculated stock: <strong className="text-emerald-950">{Math.max(0, stockModalProduct.stock + stockChangeAmount)}</strong>
                </p>
              </div>

              <div>
                <label className="font-bold block mb-1">Reason for Adjustment</label>
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value as any)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl px-3 py-2 font-semibold"
                >
                  <option value="Supplier Receiving">Supplier Receiving (Restock)</option>
                  <option value="Initial Restock">Initial Restock</option>
                  <option value="Manual Adjustment">Manual Adjustment</option>
                  <option value="Damaged Write-off">Damaged Write-off</option>
                  <option value="Sale">Sale / Order Fulfilled</option>
                  <option value="Customer Return">Customer Return</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStockAdjust}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl cursor-pointer"
                >
                  Confirm Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK IMPORT */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-emerald-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-emerald-100 shadow-2xl p-6 space-y-4 text-emerald-950">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <h4 className="text-xs font-extrabold uppercase text-emerald-950 flex items-center gap-2">
                <Upload size={16} className="text-emerald-800" />
                Bulk Import Products (JSON)
              </h4>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 hover:bg-emerald-50 text-emerald-800 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-emerald-700">Paste your JSON array of product objects below to import in bulk:</p>
              <textarea
                rows={8}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[ { "name": "Shirt", "price": 1850, "sku": "JAB-001", "brand": "Nike", "category": "World Cup", "stock": 10 } ]'
                className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 font-mono text-[11px]"
              />

              {importStatus && (
                <p className={`p-2 rounded-lg font-bold text-[11px] ${
                  importStatus.includes('Successfully') ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                }`}>
                  {importStatus}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessImport}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded-xl cursor-pointer"
                >
                  Import Products
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW PAGE QUICK MODAL */}
      {isAddPageModalOpen && (
        <div className="fixed inset-0 bg-emerald-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[999] animate-fadeIn">
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-2xl w-full max-w-md p-6 space-y-5 text-emerald-950">
            <div className="flex justify-between items-center border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <FolderPlus size={18} />
                </div>
                <div>
                  <h4 className="font-black uppercase text-sm text-emerald-950">Add New Storefront Page</h4>
                  <p className="text-[10px] text-emerald-700 font-mono">Connect products directly to new front page sections</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPageModalOpen(false)}
                className="p-1.5 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-50 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewPage} className="space-y-4 text-xs">
              <div>
                <label className="font-bold block mb-1 text-emerald-950">Page Title / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Champions League Vault"
                  value={newPageNameInput}
                  onChange={(e) => {
                    setNewPageNameInput(e.target.value);
                    if (!newPageSlugInput) {
                      setNewPageSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                    }
                  }}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 font-semibold text-emerald-950"
                />
              </div>

              <div>
                <label className="font-bold block mb-1 text-emerald-950">URL Slug / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. champions-league"
                  value={newPageSlugInput}
                  onChange={(e) => setNewPageSlugInput(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 font-mono text-emerald-950"
                />
              </div>

              <div>
                <label className="font-bold block mb-1 text-emerald-950">Header Icon</label>
                <select
                  value={newPageIconInput}
                  onChange={(e) => setNewPageIconInput(e.target.value)}
                  className="w-full bg-emerald-50/40 border border-emerald-200 rounded-xl p-3 font-semibold"
                >
                  {CATEGORY_ICONS.map((i) => (
                    <option key={i.id} value={i.id}>{i.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="showInMenu"
                  checked={newPageShowInMenu}
                  onChange={(e) => setNewPageShowInMenu(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 accent-emerald-600 rounded"
                />
                <label htmlFor="showInMenu" className="font-bold text-emerald-900 cursor-pointer">
                  Publish to Main Storefront Navigation Bar
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setIsAddPageModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-800 font-bold hover:bg-emerald-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold uppercase tracking-wider cursor-pointer"
                >
                  Save & Connect Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT IMAGE GALLERY VIEWER (up to 6 images) */}
      {galleryViewer && (() => {
        const imgs = getProductGallery(galleryViewer.product);
        const safeImgs = imgs.length > 0 ? imgs : [galleryViewer.product.image];
        const idx = galleryViewer.index % safeImgs.length;
        return (
          <div className="fixed inset-0 z-[60] bg-emerald-950/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-emerald-100 shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-100">
                <div>
                  <h4 className="text-sm font-black uppercase text-emerald-950">{galleryViewer.product.name}</h4>
                  <p className="text-[10px] font-mono text-emerald-700">Image {idx + 1} of {safeImgs.length}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGalleryViewer(null)}
                  className="p-2 rounded-xl hover:bg-emerald-50 text-emerald-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="relative bg-emerald-50/50 aspect-square flex items-center justify-center">
                <img src={safeImgs[idx]} alt="" className="max-w-full max-h-full object-contain" />
                {safeImgs.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryViewer((g) =>
                          g ? { ...g, index: (g.index - 1 + safeImgs.length) % safeImgs.length } : g
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 border border-emerald-100 p-2 rounded-full cursor-pointer shadow"
                    >
                      <ChevronRight size={16} className="rotate-180 text-emerald-900" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setGalleryViewer((g) =>
                          g ? { ...g, index: (g.index + 1) % safeImgs.length } : g
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 border border-emerald-100 p-2 rounded-full cursor-pointer shadow"
                    >
                      <ChevronRight size={16} className="text-emerald-900" />
                    </button>
                  </>
                )}
              </div>
              <div className="p-4 flex gap-2 justify-center">
                {safeImgs.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setGalleryViewer((g) => (g ? { ...g, index: i } : g))}
                    className={`h-14 w-14 rounded-xl overflow-hidden border-2 cursor-pointer ${
                      i === idx ? 'border-emerald-700' : 'border-emerald-100'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <BarcodeLabelPrint
        open={!!labelPrint}
        onClose={() => setLabelPrint(null)}
        items={
          labelPrint
            ? [
                {
                  shopName: appConfig?.logoText || 'Epic Vanskap',
                  barcode: labelPrint.barcode,
                  sellPriceLabel: formatPrice(labelPrint.sellPrice),
                  productName: labelPrint.name,
                  location: 'Dhaka',
                },
              ]
            : []
        }
      />

    </div>
  );
};
