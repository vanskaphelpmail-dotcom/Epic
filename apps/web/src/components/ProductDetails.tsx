import React, { useState } from 'react';
import { Heart, Share2, Star, CheckCircle, ShieldAlert, ShoppingCart, ArrowLeft, ArrowRight, ShieldCheck, Zap, Ruler, ChevronDown, X, Trophy } from 'lucide-react';
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
  const [enableBadges, setEnableBadges] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [pendingBadgeId, setPendingBadgeId] = useState<string | null>(null);
  const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
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
  const selectedBadge = badgeOptions.find((b) => b.id === selectedBadgeId) || null;
  const activeBadgeIds =
    enableBadges && selectedBadgeId ? [selectedBadgeId] : [];
  const badgeCost = activeBadgeIds.length * DEFAULT_BADGE_PRICE_BDT;
  const finalPrice = basePrice + customizationCost + badgeCost;

  const handleNamesetToggle = (checked: boolean) => {
    setEnableNameset(checked);
    if (!checked) {
      setCustomName('');
      setCustomNumber('');
    }
  };

  const handleBadgesToggle = (checked: boolean) => {
    setEnableBadges(checked);
    if (!checked) {
      setSelectedBadgeId(null);
      setPendingBadgeId(null);
      setBadgeSheetOpen(false);
    } else if (!selectedBadgeId) {
      setPendingBadgeId(null);
      setBadgeSheetOpen(true);
    }
  };

  const openBadgeSheet = () => {
    if (!enableBadges) return;
    setPendingBadgeId(selectedBadgeId);
    setBadgeSheetOpen(true);
  };

  const applyBadgeSelection = () => {
    setSelectedBadgeId(pendingBadgeId);
    setBadgeSheetOpen(false);
  };

  const cancelBadgeSheet = () => {
    setPendingBadgeId(selectedBadgeId);
    setBadgeSheetOpen(false);
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
    badgeTexts:
      enableBadges && selectedBadge
        ? { [selectedBadge.id]: selectedBadge.label }
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
    <section className="bg-[#121212] text-white py-10 px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      {/* Back button */}
      <button
        onClick={onBackToCatalog}
        className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-zinc-400 hover:text-white uppercase mb-8 cursor-pointer transition-colors"
      >
        <ArrowLeft size={14} /> Back to Catalog
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full min-w-0">
        
        {/* Left Column: Interactive 360 SVG Jersey Showcase & View Rotator */}
        <div className="lg:col-span-6 space-y-6">
          <div className="relative bg-gradient-to-b from-zinc-800/50 to-white border border-zinc-800 rounded-3xl p-4 sm:p-8 flex items-center justify-center min-h-[280px] sm:min-h-[400px] overflow-hidden group shadow-2xl">
            {/* Ambient light ring */}
            <div className="absolute w-64 h-64 rounded-full bg-zinc-950/10 blur-[120px] pointer-events-none" />

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
                  showBadge={activeBadgeIds.length > 0}
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
                    safeGalleryIndex === i ? 'border-zinc-700' : 'border-zinc-800'
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
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-300">
                      View {i + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Quick Specifications list below preview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-zinc-300 font-mono font-bold text-xs uppercase tracking-wider">
              Authentication & Physical Condition
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800/40">
                <span className="text-zinc-600 font-mono block mb-1">OFFICIAL SKU:</span>
                <span className="text-white font-mono font-semibold">{product.sku}</span>
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800/40">
                <span className="text-zinc-600 font-mono block mb-1">CONDITION RATING:</span>
                <span className="text-zinc-100 font-black">{product.condition}</span>
              </div>
              <div className="bg-zinc-900 p-3 rounded-lg col-span-2 border border-zinc-800/40">
                <span className="text-zinc-600 font-mono block mb-1">VERIFIER METRICS:</span>
                <span className="text-zinc-300 leading-relaxed text-[11px] block">{product.conditionDetail}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customization Panel & Buying controls */}
        <div className="lg:col-span-6 space-y-8 text-white">
          
          {/* Header Title Info */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-zinc-800 text-zinc-300 font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-zinc-800">
                {product.season} season
              </span>
              <span className="bg-zinc-900 text-zinc-400 font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-zinc-800">
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

            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-tight text-white">
              {product.name}
            </h1>

            {/* Price & Rating Bar */}
            <div className="flex items-center gap-6 pt-1">
              <div className="flex flex-wrap items-baseline gap-2">
                {hasProductDiscount(product) ? (
                  <>
                    <span className="text-zinc-600 text-sm line-through font-mono">
                      {formatPrice(product.originalPrice!)}
                    </span>
                    <span className="text-zinc-300 text-2xl font-black">{formatPrice(finalPrice)}</span>
                    <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {getProductDiscountPercent(product)}% OFF
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-300 text-2xl font-black">{formatPrice(finalPrice)}</span>
                )}
                {customizationCost > 0 && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    (Includes Nameset +{formatPrice(namesetPrice)})
                  </span>
                )}
              </div>
              <div className="h-5 w-px bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <div className="flex text-zinc-400">
                  <Star size={13} className="fill-zinc-700 text-zinc-600" />
                </div>
                <span className="text-sm font-bold">{product.rating}</span>
                <span className="text-zinc-600 text-xs">({product.reviewsCount} verified orders)</span>
              </div>
            </div>
          </div>

          <p className="text-zinc-300 text-base leading-relaxed">
            {product.shortDescription || product.description || product.longDescription}
          </p>

          {/* Size Selector Form */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold tracking-widest text-zinc-300 uppercase">
              Select Curated Sizing
              <span className={`ml-2 normal-case tracking-normal font-bold ${
                product.isPreOrder
                  ? 'text-amber-700'
                  : sizeStock <= 0
                    ? 'text-rose-700'
                    : 'text-zinc-400'
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
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-500 line-through cursor-not-allowed opacity-60'
                        : selectedSize === sz
                          ? 'bg-black border-zinc-900 text-white shadow-lg shadow-black/10 cursor-pointer'
                          : 'bg-[#121212] border-zinc-800 text-white hover:border-red-600 cursor-pointer'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
            {sizeChart && (
              <div key={`size-chart-${product.id}-${sizeChart.id}`} className="pt-3 space-y-2 w-full min-w-0">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <Ruler size={13} aria-hidden />
                  <span>{sizeChart.title}</span>
                </p>
                <div className="overflow-x-auto border border-zinc-800 rounded-2xl bg-zinc-900 w-full">
                  <table className="w-full min-w-[280px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                        {sizeChart.columns.map((col) => (
                          <th key={col.key} className="px-3 py-2 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sizeChart.rows.map((row) => (
                        <tr key={row.size} className="border-b border-zinc-800 last:border-0">
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
                                    ? 'font-black text-white'
                                    : 'font-mono text-zinc-300'
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
                  <p className="px-3 py-2 text-[10px] text-zinc-400 font-mono border-t border-zinc-800">
                    {sizeChart.note}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Jersey customization — nameset + tournament badge */}
          <div className="space-y-3">
            {namesetAvailable && (
              <div
                className={`rounded-xl border p-4 sm:p-5 transition-colors ${
                  enableNameset
                    ? 'border-red-600 bg-[#121212]'
                    : 'border-zinc-700 bg-[#0a0a0a]'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      enableNameset
                        ? 'border-red-600 bg-red-600 text-white'
                        : 'border-zinc-500 bg-transparent'
                    }`}
                    aria-hidden
                  >
                    {enableNameset ? <CheckCircle size={14} className="text-white" strokeWidth={2.5} /> : null}
                  </span>
                  <input
                    type="checkbox"
                    checked={enableNameset}
                    onChange={(e) => handleNamesetToggle(e.target.checked)}
                    className="sr-only"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-bold tracking-wide text-white uppercase block">
                      Add {namesetLabel} (+{formatPrice(namesetPrice)})
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      Optional — add a player name &amp; number when needed. Character limit may apply and full payment
                      ({formatPrice(namesetPrice)}) may advance is finalised.
                    </p>
                  </div>
                </label>

                {enableNameset && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Player Last Name
                      </span>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="e.g. ZIDANE"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value.toUpperCase())}
                        className="w-full bg-black border border-zinc-700 rounded-lg py-2.5 px-3 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Squad Number (0–99)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        placeholder="e.g. 10"
                        value={customNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomNumber(val === '' ? '' : Math.min(99, Math.max(0, Number(val))));
                        }}
                        className="w-full bg-black border border-zinc-700 rounded-lg py-2.5 px-3 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-red-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div
              className={`rounded-xl border p-4 sm:p-5 transition-colors ${
                enableBadges
                  ? 'border-red-600 bg-[#121212]'
                  : 'border-zinc-700 bg-[#0a0a0a]'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    enableBadges
                      ? 'border-red-600 bg-red-600 text-white'
                      : 'border-zinc-500 bg-transparent'
                  }`}
                  aria-hidden
                >
                  {enableBadges ? <CheckCircle size={14} className="text-white" strokeWidth={2.5} /> : null}
                </span>
                <input
                  type="checkbox"
                  checked={enableBadges}
                  onChange={(e) => handleBadgesToggle(e.target.checked)}
                  className="sr-only"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-bold tracking-wide text-white uppercase block">
                    Tournament Sleeve Badges (optional)
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Add a tournament badge to your sleeve — each selected badge is +{formatPrice(DEFAULT_BADGE_PRICE_BDT)}.
                  </p>
                </div>
              </label>

              {enableBadges && (
                <button
                  type="button"
                  onClick={openBadgeSheet}
                  className="mt-4 w-full flex items-center justify-between gap-3 bg-black border border-zinc-700 hover:border-red-600 rounded-lg py-3 px-3.5 text-left transition-colors cursor-pointer"
                >
                  <span className={`text-xs ${selectedBadge ? 'text-white font-semibold' : 'text-zinc-500'}`}>
                    {selectedBadge ? selectedBadge.label : 'Select tournament badge'}
                  </span>
                  <ChevronDown size={16} className="text-zinc-400 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {badgeSheetOpen && (
            <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
              <button
                type="button"
                className="absolute inset-0 bg-black/70 cursor-pointer"
                aria-label="Close badge picker"
                onClick={cancelBadgeSheet}
              />
              <div className="relative w-full max-w-md mx-auto bg-[#121212] border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Select Tournament Badge</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Each selected badge is +{formatPrice(DEFAULT_BADGE_PRICE_BDT)}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelBadgeSheet}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {badgeOptions.map((badge) => {
                    const selected = pendingBadgeId === badge.id;
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => setPendingBadgeId(badge.id)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-red-600 bg-red-600/10'
                            : 'border-zinc-700 bg-black hover:border-zinc-500'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'border-red-600' : 'border-zinc-500'
                          }`}
                        >
                          {selected ? <span className="h-2 w-2 rounded-full bg-red-600" /> : null}
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-white shrink-0">
                          <Trophy size={14} />
                        </span>
                        <span className="flex-1 text-sm font-semibold text-white">{badge.label}</span>
                        <span className="text-xs font-bold text-red-500">+{formatPrice(badge.priceBdt)}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={applyBadgeSelection}
                  disabled={!pendingBadgeId}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors cursor-pointer"
                >
                  Apply Badge
                </button>
                <button
                  type="button"
                  onClick={cancelBadgeSheet}
                  className="w-full text-zinc-400 hover:text-white text-xs font-semibold py-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cart Buttons & Utility Bar */}
          <div className="space-y-3.5 pt-2">
            {addedConfirm && (
              <div className="bg-zinc-900 border border-zinc-8000/20 text-zinc-400 text-xs font-bold font-mono py-2.5 px-4 rounded-xl text-center tracking-wide animate-fadeIn">
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
                    className="sm:col-span-12 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-lg shadow-black/10 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
                    id="order-now-button"
                  >
                    <Zap size={15} className="fill-white" /> ORDER NOW
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCartSubmit}
                    className="sm:col-span-8 bg-transparent hover:bg-red-600/10 text-white border-2 border-red-600 font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
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
                    ? 'border-red-500 bg-red-600/20 text-red-500'
                    : 'border-zinc-700 hover:border-red-600 text-zinc-300 bg-[#121212]'
                }`}
              >
                <Heart size={14} className={isWishlisted ? 'fill-red-500 text-red-500' : ''} />
                {isWishlisted ? 'Wishlisted' : 'Wishlist'}
              </button>
            </div>

            {/* Share / Security Trust features */}
            <div className="flex flex-wrap justify-between items-center text-xs text-zinc-600 pt-4 border-t border-zinc-800">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
              >
                <Share2 size={13} /> {copiedLink ? 'Link Copied!' : 'Share Jersey Details'}
              </button>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-400">
                <ShieldCheck size={13} />
                <span>Verified original with lifetime guarantee</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-20 border-t border-zinc-800 pt-12 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-tight text-white">
              Related Historical Jerseys
            </h2>
            <span className="text-xs text-zinc-400 font-mono font-bold tracking-widest uppercase">
              Curated Selection
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.slice(0, 4).map((rp) => {
              return (
                <div
                  key={rp.id}
                  onClick={() => onSelectProduct(rp)}
                  className="group bg-zinc-900 hover:bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 cursor-pointer transition-all duration-300"
                >
                  <div className="h-40 bg-zinc-900 rounded-xl flex items-center justify-center p-4 relative mb-3">
                    <JerseyRenderer
                      productId={rp.id}
                      uploadedImage={rp.uploadedImage || (isRenderableImageSrc(rp.image) ? rp.image : undefined)}
                      imageKey={rp.image}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase text-zinc-400 block">{rp.brand} • {rp.season}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-zinc-400 transition-colors truncate">
                      {rp.name}
                    </h3>
                    <p className="text-xs font-black text-zinc-300">{formatPrice(rp.price)}</p>
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
