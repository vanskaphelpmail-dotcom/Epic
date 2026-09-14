import React, { useEffect, useRef, useState } from 'react';
import { Heart, Share2, Star, CheckCircle, ShieldAlert, ShoppingCart, ArrowLeft, ArrowRight, ShieldCheck, Zap, Ruler, ChevronDown, ChevronLeft, ChevronRight, X, Trophy } from 'lucide-react';
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
import { flyProductToCart } from '../lib/flyToCart';

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
  const galleryRef = useRef<HTMLDivElement>(null);
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
    flyProductToCart(product, galleryRef.current);
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

  const goPrevImage = () => {
    if (galleryImages.length < 2) return;
    setGalleryPaused(true);
    setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length);
  };

  const goNextImage = () => {
    if (galleryImages.length < 2) return;
    setGalleryPaused(true);
    setGalleryIndex((i) => (i + 1) % galleryImages.length);
  };

  const chevronClass =
    'absolute top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center ' +
    'rounded-full border-0 bg-black/25 text-white/95 shadow-none backdrop-blur-[2px] ' +
    'opacity-0 pointer-events-none transition-opacity duration-200 cursor-pointer ' +
    'hover:bg-black/40 ' +
    'group-hover:opacity-100 group-hover:pointer-events-auto ' +
    'group-focus-within:opacity-100 group-focus-within:pointer-events-auto ' +
    'focus-visible:opacity-100 focus-visible:pointer-events-auto ' +
    '[@media(hover:none)]:opacity-70 [@media(hover:none)]:pointer-events-auto';

  return (
    <section className="bg-transparent text-[#0A0A0A] py-6 sm:py-10 px-3 sm:px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      <button
        onClick={onBackToCatalog}
        type="button"
        className="inline-flex items-center gap-2 mb-5 sm:mb-8 px-4 py-2.5 rounded-xl bg-[#F8F8F7] border border-[#E5E5E5] text-[#0A0A0A] hover:border-[#E30613] hover:bg-[#F8F8F7] text-sm font-black uppercase tracking-wide cursor-pointer transition-colors shadow-sm"
      >
        <ArrowLeft size={16} className="text-[#E30613] shrink-0" /> Go to Home
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-start w-full min-w-0">
        
        {/* Left Column: full-bleed product gallery (no white card) */}
        <div className="lg:col-span-6 min-w-0">
          <div
            ref={galleryRef}
            data-product-fly-image
            className="relative group m-0 p-0 w-full overflow-hidden bg-transparent border-0 shadow-none rounded-none outline-none"
            onMouseEnter={() => setGalleryPaused(true)}
            onMouseLeave={() => setGalleryPaused(false)}
            onTouchStart={(e) => {
              setGalleryPaused(true);
              (e.currentTarget as HTMLElement).dataset.touchX = String(e.touches[0]?.clientX ?? '');
            }}
            onTouchEnd={(e) => {
              if (galleryImages.length < 2) {
                setGalleryPaused(false);
                return;
              }
              const start = Number((e.currentTarget as HTMLElement).dataset.touchX || '');
              const end = e.changedTouches[0]?.clientX;
              if (!Number.isFinite(start) || end == null) {
                setGalleryPaused(false);
                return;
              }
              const delta = end - start;
              if (Math.abs(delta) >= 40) {
                setGalleryIndex((i) =>
                  delta < 0
                    ? (i + 1) % galleryImages.length
                    : (i - 1 + galleryImages.length) % galleryImages.length,
                );
              }
              window.setTimeout(() => setGalleryPaused(false), 2200);
            }}
          >
            <div className="relative m-0 p-0 w-full bg-transparent">
              {showPhoto ? (
                <img
                  key={`${product.id}-${safeGalleryIndex}`}
                  src={mainImageSrc}
                  alt={product.name}
                  className="block m-0 p-0 w-full h-auto max-h-[min(78vh,760px)] object-contain object-center select-none animate-fadeIn"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              ) : (
                <div className="m-0 p-0 w-full min-h-[min(62vw,380px)] sm:min-h-[480px] flex items-center justify-center bg-transparent [&_img]:!object-contain [&_img]:!max-h-[min(78vh,760px)] [&_img]:!max-w-full [&_img]:!w-auto [&_img]:!h-auto">
                  <JerseyRenderer
                    productId={product.id}
                    isBackView={isBackView}
                    customName={enableNameset ? customName : ''}
                    customNumber={enableNameset && customNumber !== '' ? Number(customNumber) : undefined}
                    showBadge={activeBadgeIds.length > 0}
                    uploadedImage={product.uploadedImage}
                    imageKey={product.image}
                  />
                </div>
              )}

              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={(e) => {
                      e.stopPropagation();
                      goPrevImage();
                    }}
                    className={`${chevronClass} left-1.5 sm:left-2`}
                  >
                    <ChevronLeft size={22} strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={(e) => {
                      e.stopPropagation();
                      goNextImage();
                    }}
                    className={`${chevronClass} right-1.5 sm:right-2`}
                  >
                    <ChevronRight size={22} strokeWidth={1.6} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Thumbnails — breathing space like reference (gap + inset + soft frames) */}
          {galleryImages.length > 0 && (
            <div className="mt-5 sm:mt-6 mb-2 sm:mb-3 px-2 sm:px-1">
              <div className="flex gap-3 sm:gap-3.5 justify-center flex-wrap">
                {galleryImages.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`View image ${i + 1}`}
                    aria-current={i === safeGalleryIndex}
                    onClick={() => {
                      setGalleryPaused(true);
                      setGalleryIndex(i);
                    }}
                    className={`h-[4.25rem] w-[4.25rem] sm:h-[4.75rem] sm:w-[4.75rem] overflow-hidden m-0 rounded-2xl cursor-pointer transition-all bg-white ${
                      safeGalleryIndex === i
                        ? 'ring-[2.5px] ring-[#0A0A0A] shadow-sm'
                        : 'ring-1 ring-[#E5E5E5] shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:ring-[#0A0A0A]/35'
                    }`}
                  >
                    {isRenderableImageSrc(src) ? (
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-contain bg-transparent p-1.5"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full bg-transparent flex items-center justify-center text-[10px] font-bold text-[#555555]">
                        View {i + 1}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search tags — desktop / web only (never on mobile) */}
          {Array.isArray(product.tags) && product.tags.length > 0 ? (
            <div className="max-md:hidden mt-5 w-full space-y-2.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#555555] text-center">
                Search tags
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {product.tags.slice(0, 20).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center max-w-full px-3 py-1.5 rounded-lg bg-white border border-[#E5E5E5] text-[11px] font-mono font-bold tracking-wide text-[#0A0A0A] shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Customization Panel & Buying controls */}
        <div className="lg:col-span-6 space-y-8 text-[#0A0A0A]">
          
          {/* Header Title Info */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#F8F8F7] text-[#555555] font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-[#E5E5E5]">
                {product.season} season
              </span>
              <span className="bg-[#F8F8F7] text-[#555555] font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-[#E5E5E5]">
                {product.brand} Authentic
              </span>
              {product.isPreOrder && (
                <span className="bg-amber-500 text-white font-mono text-[10px] font-black uppercase px-3 py-1 rounded border border-amber-600">
                  Pre-Order{product.preOrderEta ? ` · ${product.preOrderEta}` : ''}
                </span>
              )}
              {!product.isPreOrder && product.stock <= 3 && (
                <span className="bg-red-50 text-[#E30613] border border-red-100 font-mono text-[10px] font-black uppercase px-3 py-1 rounded animate-pulse">
                  Only {product.stock} Left in Stock
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase leading-tight text-[#0A0A0A]">
              {product.name}
            </h1>

            {/* Price & Rating Bar */}
            <div className="flex items-center gap-6 pt-1">
              <div className="flex flex-wrap items-baseline gap-2">
                {hasProductDiscount(product) ? (
                  <>
                    <span className="text-[#555555] text-sm line-through font-mono">
                      {formatPrice(product.originalPrice!)}
                    </span>
                    <span className="text-[#0A0A0A] text-2xl font-black">{formatPrice(finalPrice)}</span>
                    <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {getProductDiscountPercent(product)}% OFF
                    </span>
                  </>
                ) : (
                  <span className="text-[#0A0A0A] text-2xl font-black">{formatPrice(finalPrice)}</span>
                )}
                {customizationCost > 0 && (
                  <span className="text-[10px] text-[#555555] font-mono">
                    (Includes Font +{formatPrice(namesetPrice)})
                  </span>
                )}
              </div>
              <div className="h-5 w-px bg-[#F8F8F7]" />
              <div className="flex items-center gap-1.5">
                <div className="flex text-[#555555]">
                  <Star size={13} className="fill-zinc-700 text-[#555555]" />
                </div>
                <span className="text-sm font-bold">{product.rating}</span>
                <span className="text-[#555555] text-xs">({product.reviewsCount} verified orders)</span>
              </div>
            </div>
          </div>

          {(product.longDescription || product.shortDescription || product.description) && (
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#555555]">
                Description
              </p>
              <p className="text-[#555555] text-base leading-relaxed whitespace-pre-wrap break-words">
                {product.longDescription || product.description || product.shortDescription}
              </p>
            </div>
          )}

          {/* Size Selector Form */}
          <div className="space-y-3">
            <label className="text-xs font-mono font-bold tracking-widest text-[#555555] uppercase">
              Select Curated Sizing
              <span className={`ml-2 normal-case tracking-normal font-bold ${
                product.isPreOrder
                  ? 'text-amber-700'
                  : sizeStock <= 0
                    ? 'text-rose-700'
                    : 'text-[#555555]'
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
                        ? 'bg-[#F8F8F7] border-[#E5E5E5] text-[#555555] line-through cursor-not-allowed opacity-60'
                        : selected
                          ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white shadow-lg shadow-black/20 cursor-pointer'
                          : 'bg-white border-[#E5E5E5] text-[#0A0A0A] hover:border-[#E30613] cursor-pointer'
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
                  className="w-full sm:w-auto inline-flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#F8F8F7] text-[#0A0A0A] text-[11px] font-bold uppercase tracking-wider hover:border-[#E30613] hover:text-[#0A0A0A] transition-colors cursor-pointer"
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
                                ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white'
                                : 'bg-white border-[#E5E5E5] text-[#0A0A0A] hover:border-[#E30613]'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {sizeChart && (
                      <div className="overflow-x-auto border border-[#E5E5E5] rounded-2xl bg-[#F8F8F7] w-full">
                        <table className="w-full min-w-[280px] text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#E5E5E5] text-[10px] font-mono uppercase tracking-wider text-[#555555]">
                              {sizeChart.columns.map((col) => (
                                <th key={col.key} className="px-3 py-2 whitespace-nowrap">
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sizeChart.rows.map((row) => (
                              <tr key={row.size} className="border-b border-[#E5E5E5] last:border-0">
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
                                          ? 'font-black text-[#0A0A0A]'
                                          : 'font-mono text-[#555555]'
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
                        <p className="px-3 py-2 text-[10px] text-[#555555] font-mono border-t border-[#E5E5E5]">
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
                    ? 'border-[#E30613] bg-white'
                    : 'border-[#E5E5E5] bg-[#F8F8F7]'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      enableNameset
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                        : 'border-[#E5E5E5] bg-transparent'
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
                    <span className="text-xs sm:text-sm font-bold tracking-wide text-[#0A0A0A] uppercase block">
                      Add {namesetLabel} (+{formatPrice(namesetPrice)})
                    </span>
                    <p className="text-[11px] text-[#555555] mt-1 leading-relaxed">
                      Optional — add a player name &amp; number with custom font when needed. Character limit may apply
                      and full payment ({formatPrice(namesetPrice)}) is finalised.
                    </p>
                  </div>
                </label>

                {enableNameset && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-[#555555] font-semibold uppercase tracking-wider">
                        Player Last Name
                      </span>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="e.g. ZIDANE"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-[#E5E5E5] rounded-lg py-2.5 px-3 text-[#0A0A0A] placeholder:text-[#555555] text-xs focus:outline-none focus:border-[#E30613]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-[#555555] font-semibold uppercase tracking-wider">
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
                        className="w-full bg-white border border-[#E5E5E5] rounded-lg py-2.5 px-3 text-[#0A0A0A] placeholder:text-[#555555] text-xs focus:outline-none focus:border-[#E30613]"
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
                  ? 'border-[#E30613] bg-white'
                  : 'border-[#E5E5E5] bg-[#F8F8F7]'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    enableBadges
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                      : 'border-[#E5E5E5] bg-transparent'
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
                  <span className="text-xs sm:text-sm font-bold tracking-wide text-[#0A0A0A] uppercase block">
                    Select Tournament Patch
                  </span>
                  <p className="text-[11px] text-[#555555] mt-1 leading-relaxed">
                    Add one or more patches — each selected patch has its own price.
                  </p>
                </div>
              </label>

              {enableBadges && (
                <button
                  type="button"
                  onClick={openBadgeSheet}
                  className="mt-4 w-full flex items-center justify-between gap-3 bg-white border border-[#E5E5E5] hover:border-[#E30613] rounded-lg py-3 px-3.5 text-left transition-colors cursor-pointer"
                >
                  <span className={`text-xs min-w-0 ${selectedBadges.length ? 'text-[#0A0A0A] font-semibold' : 'text-[#555555]'}`}>
                    {selectedBadges.length
                      ? selectedBadges.map((b) => b.label).join(', ')
                      : 'Select tournament patches'}
                  </span>
                  <ChevronDown size={16} className="text-[#555555] shrink-0" />
                </button>
              )}

              {enableBadges && selectedBadges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedBadges.map((badge) => (
                    <span
                      key={badge.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-[#F8F8F7] px-2 py-1.5"
                    >
                      {badge.image && isRenderableImageSrc(badge.image) ? (
                        <img src={badge.image} alt="" className="h-7 w-7 rounded object-cover" />
                      ) : (
                        <span className="h-7 w-7 rounded bg-[#F8F8F7] border border-[#E5E5E5] flex items-center justify-center">
                          <Trophy size={12} className="text-[#555555]" />
                        </span>
                      )}
                      <span className="text-[11px] text-[#0A0A0A] font-semibold">{badge.label}</span>
                      <span className="text-[10px] text-[#E30613] font-bold">+{formatPrice(badge.priceBdt)}</span>
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
              <div className="relative w-full max-w-md mx-auto bg-white border border-[#E5E5E5] rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 animate-fadeIn">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-[#0A0A0A]">Select Tournament Patch</h3>
                    <p className="text-[11px] text-[#555555] mt-0.5">
                      Choose one or more patches. Each has its own add-on price.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelBadgeSheet}
                    className="p-1.5 rounded-lg text-[#555555] hover:text-[#0A0A0A] hover:bg-[#F8F8F7] transition-colors cursor-pointer"
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
                            ? 'border-[#E30613] bg-red-50'
                            : 'border-[#E5E5E5] bg-white hover:border-[#0A0A0A]'
                        }`}
                      >
                        <span
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'border-[#0A0A0A] bg-[#0A0A0A]' : 'border-[#E5E5E5]'
                          }`}
                        >
                          {selected ? <CheckCircle size={10} className="text-white" strokeWidth={3} /> : null}
                        </span>
                        {badge.image && isRenderableImageSrc(badge.image) ? (
                          <img
                            src={badge.image}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover border border-[#E5E5E5] shrink-0"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F8F8F7] border border-[#E5E5E5] text-[#0A0A0A] shrink-0">
                            <Trophy size={16} />
                          </span>
                        )}
                        <span className="flex-1 text-sm font-semibold text-[#0A0A0A]">{badge.label}</span>
                        <span className="text-xs font-bold text-[#E30613]">+{formatPrice(badge.priceBdt)}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={applyBadgeSelection}
                  className="w-full bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors cursor-pointer"
                >
                  Apply {pendingBadgeIds.length ? `(${pendingBadgeIds.length})` : 'Patches'}
                </button>
                <button
                  type="button"
                  onClick={cancelBadgeSheet}
                  className="w-full text-[#555555] hover:text-[#0A0A0A] text-xs font-semibold py-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Cart Buttons & Utility Bar */}
          <div className="space-y-3.5 pt-2">
            {addedConfirm && (
              <div className="bg-[#F8F8F7] border border-[#E5E5E5] text-[#555555] text-xs font-bold font-mono py-2.5 px-4 rounded-xl text-center tracking-wide animate-fadeIn">
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
                    className="sm:col-span-12 bg-[#0A0A0A] hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-lg shadow-black/10 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
                    id="order-now-button"
                  >
                    <Zap size={15} className="fill-white" /> ORDER NOW
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCartSubmit}
                    className="sm:col-span-8 bg-white hover:bg-[#F8F8F7] text-[#0A0A0A] border-2 border-[#0A0A0A] font-extrabold text-xs uppercase tracking-widest py-4 rounded-full shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 font-sans"
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
                    ? 'border-[#E30613] bg-red-50 text-[#E30613]'
                    : 'border-[#E5E5E5] hover:border-[#E30613] text-[#555555] bg-white'
                }`}
              >
                <Heart size={14} className={isWishlisted ? 'fill-[#E30613] text-[#E30613]' : ''} />
                {isWishlisted ? 'Wishlisted' : 'Wishlist'}
              </button>
            </div>

            {/* Share / Security Trust features */}
            <div className="flex flex-wrap justify-between items-center text-xs text-[#555555] pt-4 border-t border-[#E5E5E5]">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 hover:text-[#0A0A0A] transition-colors cursor-pointer"
              >
                <Share2 size={13} /> {copiedLink ? 'Link Copied!' : 'Share Jersey Details'}
              </button>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#555555]">
                <ShieldCheck size={13} />
                <span>Verified original with lifetime guarantee</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-20 border-t border-[#E5E5E5] pt-12 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-tight text-[#0A0A0A]">
              Related Jerseys
            </h2>
            <span className="text-xs text-[#555555] font-mono font-bold tracking-widest uppercase">
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
                  className="group bg-[#F8F8F7] hover:bg-[#F8F8F7] border border-[#E5E5E5] hover:border-[#E5E5E5] rounded-2xl p-4 cursor-pointer transition-all duration-300"
                >
                  <div className="aspect-[3/4] bg-[#F8F8F7] rounded-xl flex items-center justify-center p-3 relative mb-3 overflow-hidden">
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
                    <span className="text-[9px] font-mono uppercase text-[#555555] block">{rp.brand} • {rp.season}</span>
                    <h3 className="text-xs font-bold text-[#0A0A0A] group-hover:text-[#555555] transition-colors line-clamp-2">
                      {rp.name}
                    </h3>
                    <p className="text-xs font-black text-[#0A0A0A]">{formatPrice(rp.price)}</p>
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
