import React, { useEffect, useState } from 'react';
import { Heart, Share2, Star, CheckCircle, ShieldAlert, ShoppingCart, ArrowLeft, ArrowRight, ShieldCheck, Zap, Ruler, ChevronDown, X, Trophy } from 'lucide-react';
import { Product, CartItem, ProductBadgeOption } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';
import { getProductSizes, getSizeStock, isSizeAvailable, displaySizeLabel } from '../lib/productSizes';
import { getProductDiscountPercent, hasProductDiscount } from '../lib/productPricing';
import { resolveProductSizeCharts } from '../lib/sizeCharts';
import {
  getNamesetLabel,
  getNamesetPriceBdt,
  getProductBadgeOptions,
  sumSelectedBadgePrices,
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
  /** Global Inventory tournament patches (all jerseys) */
  tournamentPatches?: ProductBadgeOption[];
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
  tournamentPatches,
}) => {
  const sizes = getProductSizes(product);
  const sizeCharts = resolveProductSizeCharts(product);
  const [selectedSize, setSelectedSize] = useState(() => {
    const firstAvailable = sizes.find((s) => isSizeAvailable(product, s));
    return firstAvailable || sizes[0] || 'M';
  });
  const sizeStock = getSizeStock(product, selectedSize);
  const [enableNameset, setEnableNameset] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customNumber, setCustomNumber] = useState<number | ''>('');
  const isBackView = enableNameset && (!!customName || customNumber !== '');
  const [enableBadges, setEnableBadges] = useState(false);
  const [selectedBadgeIds, setSelectedBadgeIds] = useState<string[]>([]);
  const [pendingBadgeIds, setPendingBadgeIds] = useState<string[]>([]);
  const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [addedConfirm, setAddedConfirm] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [activeChartId, setActiveChartId] = useState(() => sizeCharts[0]?.id || '');
  const sizeChart = sizeCharts.find((c) => c.id === activeChartId) || sizeCharts[0] || null;

  const galleryImages = Array.from(
    new Set(
      [...(product.gallery || []), ...(product.images || []), product.uploadedImage, product.image].filter(
        (src): src is string => isRenderableImageSrc(src)
      )
    )
  ).slice(0, 6);

  useEffect(() => {
    setGalleryIndex(0);
  }, [product.id]);

  useEffect(() => {
    if (galleryImages.length < 2 || galleryPaused) return;
    const id = window.setInterval(() => {
      setGalleryIndex((i) => (i + 1) % galleryImages.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [galleryImages.length, galleryPaused, product.id]);

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
  const badgeOptions = getProductBadgeOptions(product, tournamentPatches);
  const patchesAvailable = product.badgeAvailable !== false && badgeOptions.length > 0;
  /** Custom font is available on all products unless explicitly disabled */
  const namesetAvailable = product.printAvailable !== false;
  const customizationCost = enableNameset && namesetAvailable ? namesetPrice : 0;
  const selectedBadges = badgeOptions.filter((b) => selectedBadgeIds.includes(b.id));
  const activeBadgeIds = enableBadges ? selectedBadgeIds : [];
  const badgeCost = sumSelectedBadgePrices(product, activeBadgeIds, tournamentPatches);
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
      setSelectedBadgeIds([]);
      setPendingBadgeIds([]);
      setBadgeSheetOpen(false);
    } else if (selectedBadgeIds.length === 0) {
      setPendingBadgeIds([]);
      setBadgeSheetOpen(true);
    }
  };

  const openBadgeSheet = () => {
    if (!enableBadges) return;
    setPendingBadgeIds([...selectedBadgeIds]);
    setBadgeSheetOpen(true);
  };

  const togglePendingBadge = (id: string) => {
    setPendingBadgeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const applyBadgeSelection = () => {
    setSelectedBadgeIds([...pendingBadgeIds]);
    if (pendingBadgeIds.length === 0) setEnableBadges(false);
    setBadgeSheetOpen(false);
  };

  const cancelBadgeSheet = () => {
    setPendingBadgeIds([...selectedBadgeIds]);
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
      enableBadges && selectedBadges.length
        ? Object.fromEntries(selectedBadges.map((b) => [b.id, b.label]))
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
      
      <button
        onClick={onBackToCatalog}
        type="button"
        className="inline-flex items-center gap-2 mb-8 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white hover:border-red-600 hover:bg-zinc-800 text-sm font-black uppercase tracking-wide cursor-pointer transition-colors shadow-sm"
      >
        <ArrowLeft size={16} className="text-red-500 shrink-0" /> Go to Home
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start w-full min-w-0">
        
        {/* Left Column: Interactive 360 SVG Jersey Showcase & View Rotator */}
        <div className="lg:col-span-6 space-y-6">
          <div
            className="relative bg-white border border-zinc-800 rounded-3xl p-2 sm:p-4 flex items-center justify-center aspect-[4/5] sm:aspect-[3/4] max-h-[min(82vh,720px)] w-full overflow-hidden group shadow-2xl"
            onMouseEnter={() => setGalleryPaused(true)}
            onMouseLeave={() => setGalleryPaused(false)}
            onTouchStart={(e) => {
              setGalleryPaused(true);
              (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0]?.clientX ?? '');
            }}
            onTouchEnd={(e) => {
              setGalleryPaused(false);
              if (galleryImages.length < 2) return;
              const start = Number((e.currentTarget as HTMLElement).dataset.touchX || '');
              const end = e.changedTouches[0]?.clientX;
              if (!Number.isFinite(start) || end == null) return;
              const delta = end - start;
              if (Math.abs(delta) < 40) return;
              setGalleryIndex((i) =>
                delta < 0
                  ? (i + 1) % galleryImages.length
                  : (i - 1 + galleryImages.length) % galleryImages.length,
              );
            }}
          >
            <div className="absolute w-64 h-64 rounded-full bg-zinc-800/20 blur-[120px] pointer-events-none" />

            <div className="relative w-full h-full flex items-center justify-center px-1 sm:px-2">
              {showPhoto ? (
                <img
                  src={mainImageSrc}
                  alt={product.name}
                  className="max-h-full max-w-full w-auto h-auto object-contain drop-shadow-lg transition-opacity duration-300"
                  referrerPolicy="no-referrer"
                  draggable={false}
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

            {galleryImages.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center items-center gap-1.5">
                {galleryImages.map((_, i) => (
                  <button
                    key={`pd-dot-${i}`}
                    type="button"
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === safeGalleryIndex}
                    onClick={() => setGalleryIndex(i)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      i === safeGalleryIndex ? 'w-5 bg-red-600' : 'w-2 bg-zinc-400/80 hover:bg-zinc-600'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {galleryImages.length > 0 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {galleryImages.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGalleryIndex(i)}
                  className={`h-16 w-16 rounded-xl overflow-hidden border-2 cursor-pointer ${
                    safeGalleryIndex === i ? 'border-red-600' : 'border-zinc-800'
                  }`}
                >
                  {isRenderableImageSrc(src) ? (
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-contain bg-zinc-950"
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
                    (Includes Font +{formatPrice(namesetPrice)})
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
                      ? `(${displaySizeLabel(selectedSize)} unavailable)`
                      : `(${sizeStock} of ${displaySizeLabel(selectedSize)} available)`}
              </span>
            </label>
            <div className="flex flex-wrap gap-2.5">
              {sizes.map((sz) => {
                const available = isSizeAvailable(product, sz);
                const selected = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    disabled={!available}
                    title={available ? `Size ${displaySizeLabel(sz)}: ${getSizeStock(product, sz)} in stock` : `Size ${displaySizeLabel(sz)} unavailable`}
                    onClick={() => available && setSelectedSize(sz)}
                    className={`w-12 h-12 rounded-xl text-xs font-mono font-black border transition-all ${
                      !available
                        ? 'bg-zinc-900 border-zinc-700 text-zinc-500 line-through cursor-not-allowed opacity-60'
                        : selected
                          ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/25 cursor-pointer'
                          : 'bg-[#121212] border-zinc-800 text-white hover:border-red-600 cursor-pointer'
                    }`}
                  >
                    {displaySizeLabel(sz)}
                  </button>
                );
              })}
            </div>
            {sizeCharts.length > 0 && (
              <div key={`size-chart-${product.id}`} className="pt-2 w-full min-w-0 space-y-2">
                <button
                  type="button"
                  onClick={() => setMeasurementOpen((o) => !o)}
                  aria-expanded={measurementOpen}
                  className="w-full sm:w-auto inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-200 text-[11px] font-bold uppercase tracking-wider hover:border-red-600 hover:text-white transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Ruler size={13} aria-hidden />
                    Measurement Chart{sizeCharts.length > 1 ? `s (${sizeCharts.length})` : ''}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`shrink-0 transition-transform ${measurementOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {measurementOpen && (
                  <div className="space-y-2 w-full animate-fadeIn">
                    {sizeCharts.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        {sizeCharts.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setActiveChartId(c.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border ${
                              (sizeChart?.id || '') === c.id
                                ? 'bg-red-600 border-red-600 text-white'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-red-600'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {sizeChart && (
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
                                      ? displaySizeLabel(row.size)
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
                          {sizeChart.title} — {sizeChart.note}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Jersey customization — custom font + tournament patch */}
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
                      Optional — add a player name &amp; number with custom font when needed. Character limit may apply
                      and full payment ({formatPrice(namesetPrice)}) is finalised.
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

            {patchesAvailable && (
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
                    Select Tournament Patch
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    Add one or more patches — each selected patch has its own price.
                  </p>
                </div>
              </label>

              {enableBadges && (
                <button
                  type="button"
                  onClick={openBadgeSheet}
                  className="mt-4 w-full flex items-center justify-between gap-3 bg-black border border-zinc-700 hover:border-red-600 rounded-lg py-3 px-3.5 text-left transition-colors cursor-pointer"
                >
                  <span className={`text-xs min-w-0 ${selectedBadges.length ? 'text-white font-semibold' : 'text-zinc-500'}`}>
                    {selectedBadges.length
                      ? selectedBadges.map((b) => b.label).join(', ')
                      : 'Select tournament patches'}
                  </span>
                  <ChevronDown size={16} className="text-zinc-400 shrink-0" />
                </button>
              )}

              {enableBadges && selectedBadges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-black px-2 py-1.5"
                    >
                      {badge.image && isRenderableImageSrc(badge.image) ? (
                        <img src={badge.image} alt="" className="h-7 w-7 rounded object-cover" />
                      ) : (
                        <span className="h-7 w-7 rounded bg-zinc-900 border border-zinc-700 flex items-center justify-center">
                          <Trophy size={12} className="text-zinc-400" />
                        </span>
                      )}
                      <span className="text-[11px] text-white font-semibold">{badge.label}</span>
                      <span className="text-[10px] text-red-500 font-bold">+{formatPrice(badge.priceBdt)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            )}
          </div>

          {badgeSheetOpen && (
            <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
              <button
                type="button"
                className="absolute inset-0 bg-black/70 cursor-pointer"
                aria-label="Close patch picker"
                onClick={cancelBadgeSheet}
              />
              <div className="relative w-full max-w-md mx-auto bg-[#121212] border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Select Tournament Patch</h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Choose one or more patches. Each has its own add-on price.
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
                    const selected = pendingBadgeIds.includes(badge.id);
                    return (
                      <button
                        key={badge.id}
                        type="button"
                        onClick={() => togglePendingBadge(badge.id)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-red-600 bg-red-600/10'
                            : 'border-zinc-700 bg-black hover:border-zinc-500'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'border-red-600 bg-red-600' : 'border-zinc-500'
                          }`}
                        >
                          {selected ? <CheckCircle size={10} className="text-white" strokeWidth={3} /> : null}
                        </span>
                        {badge.image && isRenderableImageSrc(badge.image) ? (
                          <img
                            src={badge.image}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover border border-zinc-700 shrink-0"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700 text-white shrink-0">
                            <Trophy size={16} />
                          </span>
                        )}
                        <span className="flex-1 text-sm font-semibold text-white">{badge.label}</span>
                        <span className="text-xs font-bold text-red-500">+{formatPrice(badge.priceBdt)}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={applyBadgeSelection}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors cursor-pointer"
                >
                  Apply {pendingBadgeIds.length ? `(${pendingBadgeIds.length})` : 'Patches'}
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
              Related Jerseys
            </h2>
            <span className="text-xs text-zinc-400 font-mono font-bold tracking-widest uppercase">
              Curated Selection
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.slice(0, 4).map((rp) => {
              const relatedImg = [rp.uploadedImage, ...(rp.gallery || []), ...(rp.images || []), rp.image].find(
                (src): src is string => isRenderableImageSrc(src),
              );
              return (
                <div
                  key={rp.id}
                  onClick={() => onSelectProduct(rp)}
                  className="group bg-zinc-900 hover:bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 cursor-pointer transition-all duration-300"
                >
                  <div className="aspect-[3/4] bg-zinc-950 rounded-xl flex items-center justify-center p-3 relative mb-3 overflow-hidden">
                    {relatedImg ? (
                      <img
                        src={relatedImg}
                        alt={rp.name}
                        className="max-h-full max-w-full w-auto h-auto object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="max-h-full max-w-full flex items-center justify-center [&_img]:!max-h-full [&_img]:!max-w-full [&_img]:!object-contain [&_svg]:max-h-full [&_svg]:max-w-full">
                        <JerseyRenderer
                          productId={rp.id}
                          uploadedImage={rp.uploadedImage}
                          imageKey={rp.image}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono uppercase text-zinc-400 block">{rp.brand} • {rp.season}</span>
                    <h3 className="text-xs font-bold text-white group-hover:text-zinc-400 transition-colors line-clamp-2">
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
