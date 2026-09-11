export interface ProductBadgeOption {
  id: string;
  label: string;
  priceBdt: number;
  /** Optional short thumbnail shown on storefront patch picker */
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number | null;
  costPrice?: number;
  sellingPrice?: number;
  discount?: number | null;
  image: string;
  images: string[];
  gallery?: string[];
  club?: string;
  country?: string;
  nationalTeam?: string;
  league?: string;
  brand: string;
  season: string;
  year: number;
  gender?: 'Men' | 'Women' | 'Unisex' | 'Kids' | string;
  condition: 'Mint' | 'Excellent' | 'Very Good' | 'Good' | 'Fair' | string;
  conditionDetail: string;
  player?: {
    name: string;
    number: number;
  };
  color: string;
  sizes: string[];
  /** Per-size stock counts, e.g. { S: 2, M: 5, XL: 0 } */
  sizeStocks?: Record<string, number>;
  sku: string;
  /** Retail barcode (EAN-13 / CODE128). Manual or auto-generated. */
  barcode?: string;
  badgeAvailable: boolean;
  printAvailable: boolean;
  /** BDT add-on price for custom font (name + number) printing */
  namesetPriceBdt?: number;
  /** BDT add-on price for tournament patches (legacy single price) */
  badgePriceBdt?: number;
  /** Storefront label for custom font option */
  namesetLabel?: string;
  /** Storefront tag for patch option — legacy single patch */
  badgeLabel?: string;
  /** Multiple tournament patch options (label + BDT price + optional image each) */
  badgeOptions?: ProductBadgeOption[];
  rating: number;
  reviewsCount: number;
  description: string;
  shortDescription?: string;
  longDescription?: string;
  features?: string[];
  /** Search keywords shown below product photos (max 8) */
  tags?: string[];
  material?: string;
  dimensions?: string;
  specification: {
    material: string;
    madeIn: string;
    fit: string;
    sponsor?: string;
  };
  category: string;
  categoryId?: string;
  /** Multi-select storefront categories (e.g. Fan Edition + Premier League) */
  categories?: string[];
  /** Explicit size chart id: player-edition | retro | fan-edition | custom | kids */
  sizeChartId?: string;
  /** Multiple measurement charts for the same jersey */
  sizeChartIds?: string[];
  pageNumber?: number;
  targetPage?: string;
  pageName?: string;
  categoryRow?: number;
  stock: number;
  lowStockThreshold?: number;
  warehouse?: string;
  binCode?: string;
  isClearance?: boolean;
  isDamaged?: boolean;
  damagedQty?: number;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  /** When true, product can be ordered even if out of stock */
  isPreOrder?: boolean;
  /** Estimated arrival note shown on storefront / checkout */
  preOrderEta?: string;
  uploadedImage?: string; // Base64 data URL uploaded manually
  status?: 'Active' | 'Draft' | 'Archived' | 'Trashed';
  isArchived?: boolean;
  isTrashed?: boolean;
}

export interface StockLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  previousStock: number;
  newStock: number;
  change: number;
  reason: 'Initial Restock' | 'Sale' | 'Damaged Write-off' | 'Manual Adjustment' | 'Supplier Receiving' | 'Customer Return';
  timestamp: string;
  user?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null; // For Nested Categories
  pageNumber: number; // 1 = 1st Page, 2 = 2nd Page, 3 = 3rd Page, etc.
  targetPage?: string;
  pageName?: string;
  rowOrder: number;   // Row arrangement index
  description?: string;
  image?: string;
  bannerImage?: string;
  icon?: string;
  status: 'Active' | 'Inactive';
  /** Default size / measurement chart linked to this category */
  sizeChartId?: string;
}

export type UserRole = 
  | 'Super Admin'
  | 'Admin'
  | 'Inventory Manager'
  | 'Order Manager'
  | 'Customer Support'
  | 'Content Manager'
  | 'Seller'
  | 'Customer';

export interface AccessPermissionFlags {
  can_edit_stock: boolean;
  can_delete_orders: boolean;
  can_manage_products: boolean;
  can_process_refunds: boolean;
  can_edit_prices: boolean;
  can_manage_content: boolean;
  can_manage_users: boolean;
  can_manage_seller_desk: boolean;
  can_export_reports: boolean;
  can_edit_coupons: boolean;
  can_manage_system_settings: boolean;
  can_manage_orders?: boolean;
  can_manage_reviews?: boolean;
}

export interface StaffRoleDefinition {
  id: UserRole;
  name: string;
  description: string;
  badgeColor: string;
  allowedTabs: string[];
  defaultPermissions: string[];
  defaultFlags: AccessPermissionFlags;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  password?: string;
  simulatedIp?: string;
  location?: string;
  phone?: string;
  status?: 'Active' | 'Inactive' | 'Suspended';
  department?: string;
  permissions?: string[];
  accessFlags?: Partial<AccessPermissionFlags>;
  assignedBy?: string;
  createdAt?: string;
  lastLogin?: string;
  avatar?: string;
}

export interface CartItem {
  product: Product;
  selectedSize: string;
  customPrint?: {
    name: string;
    number: number;
  };
  /** True when shopper enabled custom nameset printing (forces full bKash payment) */
  namesetEnabled?: boolean;
  /** Selected tournament badge option ids */
  selectedBadges?: string[];
  /** Custom text typed for each selected badge id */
  badgeTexts?: Record<string, string>;
  addBadge?: boolean;
  quantity: number;
}

/** Admin-fixed flash / hot deal slot on the homepage deck */
export interface DailyDealItem {
  productId: string;
  /** Fixed price shown to shoppers and charged at checkout (BDT) */
  dealPrice: number;
  /** Strikethrough “was” price; defaults to catalog price when omitted */
  compareAtPrice?: number | null;
  /** Highlight as HOT DEAL on the storefront */
  isHotDeal?: boolean;
  /** Scarcity copy override (“Only N items left…”) */
  stockLeft?: number | null;
  /** Progress bar 0–100 */
  claimedPercent?: number | null;
  sortOrder?: number;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  image: string;
  date: string;
  author: string;
  readTime: string;
}

export interface OrderTimelineEvent {
  id: string;
  status: string;
  timestamp: string;
  note?: string;
  updatedBy?: string;
}

export interface Order {
  id: string;
  date: string;
  createdAt?: string;
  deliveryRegion?: 'inside' | 'outside';
  deliveryCharge?: number;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: 'Pending' | 'Confirmed' | 'Packed' | 'Ready to Ship' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned' | 'Refund Request' | 'Processing' | string;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  shippedDate?: string;
  estimatedDelivery?: string;
  customerNotes?: string;
  internalNotes?: string;
  timeline?: OrderTimelineEvent[];
  shippingAddress: {
    fullName: string;
    email?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  paymentMethod: string;
  paymentStatus?: 'Paid' | 'Unpaid' | 'Refunded' | 'Partially Refunded';
  /** Customer wallet number used for manual bKash Send Money */
  bkashNumber?: string;
  /** bKash TrxID for admin verification */
  bkashTransactionId?: string;
  /** full = paid order total via bKash; partial = advance now, rest COD */
  bkashPaymentType?: 'full' | 'partial';
  /** Amount customer sent / must send via bKash now (BDT) */
  bkashPaidAmount?: number;
}

export interface SellerRequest {
  id: string;
  shirtName: string;
  brand: string;
  season: string;
  condition: string;
  expectedPrice: number;
  images: string[];
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
}

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  primaryColor: string;
  productId: string;
  customImage?: string;
}

export interface PageSection {
  id: string;
  name: string;
  visible: boolean;
  bgColor: string;
  padding: string; // py-4, py-8, py-12, py-16
  margin: string;  // my-0, my-4, my-8, my-12
  image?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  buttonUrl?: string;
  animation?: 'none' | 'fadeIn' | 'slideUp' | 'bounce' | 'pulse';
  status?: 'active' | 'draft' | 'inactive';
  /** product-row sections show a grid filtered by productCategory or selectedProductIds */
  sectionType?: 'product-row' | 'content' | 'special';
  productCategory?: string;
  maxProducts?: number;
  /** When set, these product IDs are shown (manual pick from stock) */
  selectedProductIds?: string[];
  productSelectionMode?: 'manual' | 'category';
}

export interface CustomPage {
  id: string;
  name: string;
  slug: string;
  isCustom: boolean;
  visible: boolean;
  sections: PageSection[];
}

export type BannerType =
  | 'Hero Slider'
  | 'Category Banner'
  | 'Collection Banner'
  | 'League Banner'
  | 'Popup Banner'
  | 'Offer Banner'
  | 'Newsletter Banner'
  | 'Footer Banner'
  | 'Blog Banner'
  | 'Mobile Banner';

export interface BannerConfig {
  id: string;
  name?: string;
  type: BannerType;
  desktopImage: string;
  tabletImage: string;
  mobileImage: string;
  image?: string; // fallback alias
  title?: string;
  subtitle?: string;
  description?: string;
  cta?: string; // CTA Button label
  ctaText?: string; // fallback alias for backwards compatibility
  /** In-app target: listing | product:<id> | category:<name> | page key | https://... */
  buttonUrl?: string;
  /** Optional product id — CTA opens PDP when set */
  productId?: string;
  openNewTab: boolean;
  scheduleStart: string;
  scheduleEnd: string;
  status: 'Active' | 'Inactive' | 'Draft' | 'active' | 'inactive' | 'draft';
  /** Lower number = shown first in hero slider */
  sortOrder?: number;
}

export type MenuPlacement = 'Main Menu' | 'Mega Menu' | 'Footer Menu';

export interface MenuItem {
  id: string;
  name: string; // Menu Name
  placement: MenuPlacement; // Main Menu, Mega Menu, Footer Menu
  parentId?: string | null; // Parent item ID for nested submenus or mega menu columns
  icon?: string; // Icon name e.g. 'Shirt', 'Trophy', 'Star', 'Flame', etc.
  order: number; // Display order
  url: string; // Redirect target URL or page key
  status: 'Active' | 'Inactive' | 'active' | 'inactive';
  badgeText?: string; // Optional badge label like 'HOT', 'NEW'
  description?: string; // Optional text for mega menu cards
  openNewTab?: boolean;
}

export type LeagueMark =
  | 'premier'
  | 'laliga'
  | 'seriea'
  | 'bundesliga'
  | 'ligue1'
  | 'mls'
  | 'worldcup'
  | 'bangladesh';

export interface LeagueConfigItem {
  id: string;
  name: string;
  categoryId: string;
  count: number;
  mark: LeagueMark;
  /** Optional — falls back to name/categoryId for storefront search */
  searchQuery?: string;
  logoUrl?: string;
  status: 'Active' | 'Inactive';
}

export interface AppConfig {
  logoText: string;
  logoSubtext: string;
  theme: 'classic' | 'crimson' | 'royal' | 'bengal';
  footerAbout: string;
  footerLocations: { city: string; address: string; phone: string }[];
  footerCopyright: string;
  currencySymbol: string;
  currencyCode: string;
  exchangeRate: number;
  timerTeam1?: string;
  timerTeam1Emoji?: string;
  timerTeam2?: string;
  timerTeam2Emoji?: string;
  timerLabel?: string;
  timerTargetHours?: number;
  timerEnabled?: boolean;
  dailyDealProductId?: string;
  /** Global Flash Offer deck on homepage — stored in DB for all visitors */
  dailyDealEnabled?: boolean;
  /** Admin-curated hot / flash deal products with fixed prices */
  dailyDealItems?: DailyDealItem[];
  /** ISO timestamp when the flash offer countdown ends */
  dailyDealEndsAt?: string | null;
  /** Merchant personal bKash for manual Send Money checkout */
  bkashPersonalNumber?: string;
  bkashEnabled?: boolean;
  /** full | partial = force one mode; both = customer picks at checkout */
  bkashPaymentMode?: 'full' | 'partial' | 'both';
  /** Partial advance per jersey (৳300 × qty). 1→300, 2→600, 3→900… */
  bkashPartialAmountBdt?: number;
  pages?: CustomPage[];
  homepageSections?: PageSection[];
  banners?: BannerConfig[];
  menuItems?: MenuItem[];
  categoryItems?: CategoryItem[];
  /** Global Tournament Patch options (image + name + price) for all jerseys */
  tournamentPatches?: ProductBadgeOption[];
  /** Custom size / measurement charts managed in Inventory */
  customSizeCharts?: Array<{
    id: string;
    label: string;
    title: string;
    note: string;
    sizeOptions: string[];
    columns: Array<{ key: 'size' | 'age' | 'chest' | 'length'; label: string }>;
    rows: Array<{ size: string; chest: string | number; length: string | number; age?: string }>;
  }>;
  leagues?: LeagueConfigItem[];
  stockLogs?: StockLog[];
}
