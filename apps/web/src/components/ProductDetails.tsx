import React, { useState } from 'react';
import { Heart, Share2, Star, CheckCircle, ShieldAlert, BadgeCheck, ShoppingCart, ArrowLeft, ArrowRight, ShieldCheck, Zap, Ruler } from 'lucide-react';
import { Product, CartItem } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';
import { getProductSizes, getSizeStock, isSizeAvailable } from '../lib/productSizes';
import { getProductDiscountPercent, hasProductDiscount } from '../lib/productPricing';
import { resolveSizeChart } from '../lib/sizeCharts';
import {
  DEFAULT_BADGE_PRICE_BDT,
  getNamesetLabel,
  getNamesetPriceBdt,
  getProductBadgeOptions,
} from '../lib/productAddons';
import { toast } from './UiFeedback';

interface ProductDetailsProps {
  product: Product;
  onBackToCatalog: () => void;
  onAddToCart: (item: CartItem) => void;
  onOrderNow: (item: CartItem) => void;
  onAddToWishlist: (product: Product) => void;
  isWishlisted: boolean;
  relatedProducts: Product[];
  onSelectProduct: (product: Product) => void;
  formatPrice: (amount: number) => string;
}

export const ProductDetails: React.FC<ProductDetailsProps> = ({
  product,
  onBackToCatalog,
  onAddToCart,
  onOrderNow,
  onAddToWishlist,
  isWishlisted,
  relatedProducts,
  onSelectProduct,
  formatPrice,
}) => {
  const sizes = getProductSizes(product);
  const sizeChart = resolveSizeChart(product.category, product.sizeChartId);
  const [selectedSize, setSelectedSize] = useState(() => {
    const firstAvailable = sizes.find((s) => isSizeAvailable(product, s));
    return firstAvailable || sizes[0] || 'M';
  });
  const sizeStock = getSizeStock(product, selectedSize);
  const [enableNameset, setEnableNameset] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customNumber, setCustomNumber] = useState<number | ''>('');
  // Auto flip SVG jersey to back when nameset is being customized (no inspect UI)
  const isBackView = enableNameset && (!!customName || customNumber !== '');
  const [badgeEnabled, setBadgeEnabled] = useState<Record<string, boolean>>({
    'badge-1': false,
    'badge-2': false,
  });
  const [badgeTexts, setBadgeTexts] = useState<Record<string, string>>({
    'badge-1': '',
    'badge-2': '',
  });
  const [copiedLink, setCopiedLink] = useState(false);
  const [addedConfirm, setAddedConfirm] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const galleryImages = Array.from(
    new Set(
      [...(product.gallery || []), ...(product.images || []), product.uploadedImage, product.image].filter(
        (src): src is string => isRenderableImageSrc(src)
      )
    )
  ).slice(0, 3);

  const safeGalleryIndex = galleryImages.length
    ? Math.min(galleryIndex, galleryImages.length - 1)
    : 0;
  const mainImageSrc =
    galleryImages[safeGalleryIndex] ||
    (isRenderableImageSrc(product.uploadedImage) ? product.uploadedImage : undefined) ||
    (isRenderableImageSrc(product.image) ? product.image : undefined);
  const showPhoto = isRenderableImageSrc(mainImageSrc);

  // Compute actual price based on customized selections
  const basePrice = product.price;
  const namesetPrice = getNamesetPriceBdt(product);
  const namesetLabel = getNamesetLabel(product);
  const badgeOptions = getProductBadgeOptions(product);
  /** Nameset is available on all products unless explicitly disabled */
  const namesetAvailable = product.printAvailable !== false;
  const customizationCost = enableNameset && namesetAvailable ? namesetPrice : 0;
  const activeBadgeIds = badgeOptions
    .map((b) => b.id)
    .filter((id) => badgeEnabled[id]);
  const badgeCost = activeBadgeIds.length * DEFAULT_BADGE_PRICE_BDT;
  const finalPrice = basePrice + customizationCost + badgeCost;

  const handleBadgeToggle = (badgeId: string, checked: boolean) => {
    setBadgeEnabled((prev) => ({ ...prev, [badgeId]: checked }));
    if (!checked) {
      setBadgeTexts((prev) => ({ ...prev, [badgeId]: '' }));
    }
  };

  const handleBadgeTextChange = (badgeId: string, value: string) => {
    if (!badgeEnabled[badgeId]) return;
    setBadgeTexts((prev) => ({ ...prev, [badgeId]: value.toUpperCase() }));
  };

  const handleNamesetToggle = (checked: boolean) => {
    setEnableNameset(checked);
    if (!checked) {
      setCustomName('');
      setCustomNumber('');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const buildCartItem = (): CartItem => ({
    product: {
      ...product,
      price: finalPrice,
    },
    selectedSize,
    namesetEnabled: Boolean(enableNameset && namesetAvailable),
    customPrint:
      enableNameset && namesetAvailable
        ? {
            name: customName.toUpperCase(),
            number: customNumber === '' ? 0 : Number(customNumber),
          }
        : undefined,
    selectedBadges: activeBadgeIds.length ? [...activeBadgeIds] : undefined,
    badgeTexts: activeBadgeIds.length
      ? Object.fromEntries(
          activeBadgeIds.map((id) => [id, (badgeTexts[id] || '').trim()] as const),
        )
      : undefined,
    addBadge: activeBadgeIds.length > 0,
    quantity: 1,
  });

  const handleAddToCartSubmit = () => {
    if (sizeStock <= 0 && !product.isPreOrder) {
      toast(`Size ${selectedSize} is currently out of stock.`, 'error');
      return;
    }
    onAddToCart(buildCartItem());
    setAddedConfirm(true);
    setTimeout(() => setAddedConfirm(false), 2500);
  };

  const handleOrderNowSubmit = () => {
    if (sizeStock <= 0 && !product.isPreOrder) {
      toast(`Size ${selectedSize} is currently out of stock.`, 'error');
      return;
    }
    onOrderNow(buildCartItem());
  };

  return (
    <section className="bg-white text-emerald-950 py-10 px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      {/* Back button */}
      <button
        onClick={onBackToCatalog}
        className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-emerald-700 hover:text-emerald-950 uppercase mb-8 cursor-pointer transition-colors"
      >
        <ArrowLeft size={14} /> Back to Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full min-w-0">
        
        {/* Left Column: Interactive 360 SVG Jersey Showcase & View Rotator */}
        <div className="lg:col-span-6 space-y-6">
          <div className="relative bg-gradient-to-b from-emerald-50/50 to-white border border-emerald-100 rounded-3xl p-4 sm:p-8 flex items-center justify-center min-h-[280px] sm:min-h-[400px] overflow-hidden group shadow-2xl">
            {/* Ambient light ring */}
            <div className="absolute w-64 h-64 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

            <div className="w-full max-w-[480px] h-auto flex items-center justify-center px-2 sm:px-4 pb-2">
              {showPhoto ? (
                <img
                  src={mainImageSrc}
                  alt={product.name}
                  className="w-full max-h-[min(70vh,520px)] object-contain drop-shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <JerseyRenderer
                  productId={product.id}
                  isBackView={isBackView}
                  customName={enableNameset ? customName : ''}
                  customNumber={enableNameset && customNumber !== '' ? Number(customNumber) : undefined}
                  showBadge={selectedBadgeIds.length > 0}
                  uploadedImage={product.uploadedImage}
                  imageKey={product.image}
                />
              )}
            </div>
          </div>

          {galleryImages.length > 0 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {galleryImages.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGalleryIndex(i)}
                  className={`h-16 w-16 rounded-xl overflow-hidden border-2 cursor-pointer ${
                    safeGalleryIndex === i ? 'border-emerald-700' : 'border-emerald-100'
                  }`}
                >
                  {isRenderableImageSrc(src) ? (
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-emerald-50 flex items-center justify-center text-[10px] font-bold text-emerald-800">
                      View {i + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Quick Specifications list below preview */}
          <div className="bg-emerald-50/20 border border-emerald-100 rounded-2xl p-6 space-y-4">
            <h3 className="text-emerald-800 font-mono font-bold text-xs uppercase tracking-wider">
              Authentication & Physical Condition
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/40">
                <span className="text-emerald-600 font-mono block mb-1">OFFICIAL SKU:</span>
                <span className="text-emerald-950 font-mono font-semibold">{product.sku}</span>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/40">
                <span className="text-emerald-600 font-mono block mb-1">CONDITION RATING:</span>
                <span className="text-emerald-900 font-black">{product.condition}</span>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-lg col-span-2 border border-emerald-100/40">
                <span className="text-emerald-600 font-mono block mb-1">VERIFIER METRICS:</span>
                <span className="text-emerald-850 leading-relaxed text-[11px] block">{product.conditionDetail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customization Panel & Buying controls */}
        <div className="lg:col-span-6 space-y-8 text-emerald-950">
          
          {/* Header Title Info */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-emerald-200">
                {product.season} season
              </span>
              <span className="bg-emerald-50 text-emerald-700 font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-emerald-100">
                {product.brand} Authentic
              </span>
              {product.isPreOrder && (
                <span className="bg-amber-500 text-white font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-amber-600">
                  Pre-Order{product.preOrderEta ? ` · ${product.preOrderEta}` : ''}
                </span>
              )}
              {!product.isPreOrder && product.stock <= 3 && (
                <span className="bg-red-50 text-red-600 border border-red-100 font-mono text-[10px] font-black uppercase px-3 py-1 rounded animate-pulse">
                  Only {product.stock} Left in Stock
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-tight text-emerald-950">
              {product.name}
            </h1>

            {/* Price & Rating Bar */}
            <div className="flex items-center gap-6 pt-1">
              <div className="flex flex-wrap items-baseline gap-2">
                {hasProductDiscount(product) ? (
                  <>
                    <span className="text-emerald-600 text-sm line-through font-mono">
                      {formatPrice(product.originalPrice!)}
                    </span>
                    <span className="text-emerald-800 text-2xl font-black">{formatPrice(finalPrice)}</span>
                    <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {getProductDiscountPercent(product)}% OFF
                    </span>
                  </>
                ) : (
                  <span className="text-emerald-800 text-2xl font-black">{formatPrice(finalPrice)}</span>
                )}
                {customizationCost > 0 && (
                  <span className="text-[10px] text-emerald-700 font-mono">
                    (Includes Nameset +{formatPrice(namesetPrice)})
                  </span>
                )}
              </div>
              <div className="h-5 w-px bg-emerald-100" />
              <div className="flex items-center gap-1.5">
                <div className="flex text-emerald-700">
                  <Star size={13} className="fill-emerald-600 text-emerald-600" />
                </div>
                <span className="text-sm font-bold">{product.rating}</span>
                <span className="text-emerald-600 text-xs">({product.reviewsCount} verified orders)</span>
              </div>
            </div>
          </div>

          <p className="text-emerald-800 text-base leading-relaxed">
            {product.shortDescription || product.description || product.longDescription}
          </p>

          {/* Size Selector Form */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold tracking-widest text-emerald-800 uppercase">
              Select Curated Sizing
              <span className={`ml-2 normal-case tracking-normal font-bold ${
                product.isPreOrder
                  ? 'text-amber-700'
                  : sizeStock <= 0
                    ? 'text-rose-700'
                    : 'text-emerald-700'
              }`}>
                {product.isPreOrder
                  ? `(Pre-order${product.preOrderEta ? ` — ${product.preOrderEta}` : ''})`
                  : product.stock <= 0
                    ? '(All sizes unavailable — out of stock)'
                    : sizeStock <= 0
                      ? `(${selectedSize} unavailable)`
                      : `(${sizeStock} of ${selectedSize} available)`}
              </span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {sizes.map((sz) => {
                const available = isSizeAvailable(product, sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    disabled={!available}
                    title={available ? `Size ${sz}: ${getSizeStock(product, sz)} in stock` : `Size ${sz} unavailable`}
                    onClick={() => available && setSelectedSize(sz)}
                    className={`w-12 h-12 rounded-xl text-xs font-mono font-black border transition-all ${
                      !available
                        ? 'bg-gray-50 border-gray-200 text-gray-400 line-through cursor-not-allowed opacity-60'
                        : selectedSize === sz
                          ? 'bg-emerald-800 border-emerald-800 text-white shadow-lg shadow-emerald-800/15 cursor-pointer'
                          : 'bg-white border-emerald-100 text-emerald-950 hover:border-emerald-500 cursor-pointer'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
            {sizeChart && (
              <div key={`size-chart-${product.id}-${sizeChart.id}`} className="pt-3 space-y-2 w-full min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  <Ruler size={13} aria-hidden />
                  <span>{sizeChart.title}</span>
                </p>
                <div className="overflow-x-auto border border-emerald-100 rounded-2xl bg-emerald-50/40 w-full">
                  <table className="w-full min-w-[280px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-emerald-100 text-[10px] font-mono uppercase tracking-wider text-emerald-700">
                        {sizeChart.columns.map((col) => (
                          <th key={col.key} className="px-3 py-2 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sizeChart.rows.map((row) => (
                        <tr key={row.size} className="border-b border-emerald-50 last:border-0">
                          {sizeChart.columns.map((col) => {
                            const value =
                              col.key === 'size'
                                ? row.size
                                : col.key === 'age'
                                  ? row.age || '—'
                                  : col.key === 'chest'
                                    ? row.chest
                                    : row.length;
                            return (
                              <td
                                key={col.key}
                                className={`px-3 py-2 ${
                                  col.key === 'size'
                                    ? 'font-black text-emerald-950'
                                    : 'font-mono text-emerald-800'
                                }`}
                              >
                                {value}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="px-3 py-2 text-[10px] text-emerald-700 font-mono border-t border-emerald-100">
                    {sizeChart.note}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Live Nameset Customization Creator */}
          {namesetAvailable && (
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-6 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableNameset}
                  onChange={(e) => handleNamesetToggle(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer rounded shrink-0"
                />
                <div className="flex-1">
                  <span className="text-xs font-mono font-bold tracking-widest text-emerald-850 uppercase flex items-center gap-1">
                    <BadgeCheck size={14} className="text-emerald-700" />
                    Add {namesetLabel} (+{formatPrice(namesetPrice)})
                  </span>
                  <p className="text-[10px] text-emerald-600 font-mono mt-1">
                    Optional — enable jersey name &amp; number. When enabled, checkout requires{' '}
                    <strong>full bKash payment</strong> (৳300/jersey advance is hidden).
                  </p>
                  {enableNameset && (
                    <p className="text-[10px] text-amber-800 font-mono mt-1.5 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                      Nameset on — this jersey will use <strong>full payment only</strong> at checkout.
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-emerald-600 font-mono shrink-0">Live Vector Preview</span>
              </label>

              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity ${enableNameset ? '' : 'opacity-50'}`}>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-emerald-600 font-mono">PLAYER LAST NAME:</span>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="e.g. ZIDANE"
                    value={customName}
                    disabled={!enableNameset}
                    onChange={(e) => {
                      setCustomName(e.target.value.toUpperCase());
                    }}
                    className="w-full bg-white border border-emerald-100 rounded-lg py-2 px-3 text-emerald-950 placeholder-emerald-300 text-xs focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-emerald-600 font-mono">SQUAD NUMBER (0-99):</span>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    placeholder="e.g. 10"
                    value={customNumber}
                    disabled={!enableNameset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomNumber(val === '' ? '' : Math.min(99, Math.max(0, Number(val))));
                    }}
                    className="w-full bg-white border border-emerald-100 rounded-lg py-2 px-3 text-emerald-950 placeholder-emerald-300 text-xs focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tournament sleeve badges — checkbox enables typing (+৳100 each when checked) */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-6 space-y-4">
            <div>
              <span className="text-xs font-mono font-bold tracking-widest text-emerald-850 uppercase flex items-center gap-1">
                <BadgeCheck size={14} className="text-emerald-700" />
                Tournament Sleeve Badges (optional)
              </span>
              <p className="text-[10px] text-emerald-600 font-mono mt-1">
                Check a badge to type — each selected badge is +{formatPrice(DEFAULT_BADGE_PRICE_BDT)}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badgeOptions.slice(0, 2).map((badge, idx) => {
                const enabled = !!badgeEnabled[badge.id];
                return (
                  <div key={badge.id} className="space-y-2">
                    <label
                      htmlFor={`badge-enable-${badge.id}`}
                      className="flex items-center gap-2.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        id={`badge-enable-${badge.id}`}
                        checked={enabled}
                        onChange={(e) => handleBadgeToggle(badge.id, e.target.checked)}
                        className="w-4 h-4 accent-emerald-600 cursor-pointer rounded shrink-0 border border-emerald-300"
                      />
                      <span className="text-[10px] text-emerald-700 font-mono font-bold uppercase">
                        {badge.label || `Tournament Sleeve Badge ${idx + 1}`} (+{formatPrice(DEFAULT_BADGE_PRICE_BDT)})
                      </span>
                    </label>
                    <input
                      type="text"
                      maxLength={24}
                      placeholder={idx === 0 ? 'e.g. WC 26' : 'e.g. UCL'}
                      value={badgeTexts[badge.id] || ''}
                      disabled={!enabled}
                      onChange={(e) => handleBadgeTextChange(badge.id, e.target.value)}
                      className={`w-full border border-emerald-100 rounded-lg py-2 px-3 text-emerald-950 placeholder-emerald-300 text-xs focus:outline-none focus:border-emerald-500 ${
                        enabled
                          ? 'bg-white'
                          : 'bg-gray-50 cursor-not-allowed opacity-60'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cart Buttons & Utility Bar */}
          <div className="space-y-3.5 pt-2">
            {addedConfirm && (
              <div className="bg-emerald-50 border border-emerald-500/20 text-emerald-700 text-xs font-bold font-mono py-2.5 px-4 rounded-xl text-center tracking-wide animate-fadeIn">
                ✓ SHIRT SUCCESFULLY INTEGRATED INTO YOUR BAG!
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              {product.isPreOrder ? (
                <button
                  type="button"
                  onClick={handleAddToCartSubmit}
                  className="sm:col-span-8 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
                  id="preorder-button"
                >
                  <ShoppingCart size={15} /> PRE-ORDER
                  {product.preOrderEta ? ` · ${product.preOrderEta}` : ''}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleOrderNowSubmit}
                    className="sm:col-span-12 bg-emerald-950 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
                    id="order-now-button"
                  >
                    <Zap size={15} className="fill-white" /> ORDER NOW
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCartSubmit}
                    className="sm:col-span-8 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-lg shadow-emerald-600/10 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
                    id="add-to-bag-button"
                  >
                    <ShoppingCart size={15} /> ADD TO CART
                  </button>
                </>
              )}
              
              <button
                type="button"
                onClick={() => onAddToWishlist(product)}
                className={`${product.isPreOrder ? 'sm:col-span-4' : 'sm:col-span-4'} border py-4 rounded-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isWishlisted
                    ? 'border-red-500 bg-red-50 text-red-600'
                    : 'border-emerald-150 hover:border-emerald-500 text-emerald-800 bg-white'
                }`}
              >
                <Heart size={14} className={isWishlisted ? 'fill-red-500 text-red-500' : ''} />
                {isWishlisted ? 'Wishlisted' : 'Wishlist'}
              </button>
            </div>

            {/* Share / Security Trust features */}
            <div className="flex flex-wrap justify-between items-center text-xs text-emerald-600 pt-4 border-t border-emerald-100">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 hover:text-emerald-950 transition-colors cursor-pointer"
              >
                <Share2 size={13} /> {copiedLink ? 'Link Copied!' : 'Share Jersey Details'}
              </button>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-700">
                <ShieldCheck size={13} />
                <span>Verified original with lifetime guarantee</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-20 border-t border-emerald-100 pt-12 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-tight text-emerald-950">
              Related Historical Jerseys
            </h2>
            <span className="text-xs text-emerald-700 font-mono font-bold tracking-widest uppercase">
              Curated Selection
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.slice(0, 4).map((rp) => {
              return (
                <div
                  key={rp.id}
                  onClick={() => onSelectProduct(rp)}
                  className="group bg-emerald-50/20 hover:bg-emerald-50/50 border border-emerald-100 hover:border-emerald-300 rounded-2xl p-4 cursor-pointer transition-all duration-300"
                >
                  <div className="h-40 bg-emerald-50/40 rounded-xl flex items-center justify-center p-4 relative mb-3">
                    <JerseyRenderer
                      productId={rp.id}
                      uploadedImage={rp.uploadedImage || (isRenderableImageSrc(rp.image) ? rp.image : undefined)}
                      imageKey={rp.image}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase text-emerald-700 block">{rp.brand} • {rp.season}</span>
                    <h3 className="text-xs font-bold text-emerald-950 group-hover:text-emerald-700 transition-colors truncate">
                      {rp.name}
                    </h3>
                    <p className="text-xs font-black text-emerald-850">{formatPrice(rp.price)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </section>
  );
};
