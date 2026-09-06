import React, { useEffect, useRef, useState } from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';
import { hasProductDiscount } from '../lib/productPricing';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onToggleWishlist: (product: Product) => void;
  isWishlisted: boolean;
  onQuickAdd?: (product: Product, size?: string, quantity?: number) => void;
  onCheckout?: (product: Product, size: string, quantity: number) => void;
  onUpdateImage?: (productId: string, base64: string) => void;
  formatPrice: (amount: number) => string;
}

const SLIDE_MS = 3200;
const SWIPE_PX = 40;

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onToggleWishlist,
  isWishlisted,
  onQuickAdd,
  formatPrice,
}) => {
  const galleryImages = Array.from(
    new Set(
      [...(product.gallery || []), ...(product.images || []), product.uploadedImage, product.image].filter(
        (src): src is string => isRenderableImageSrc(src),
      ),
    ),
  ).slice(0, 6);

  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const slideCount = galleryImages.length;

  useEffect(() => {
    setSlide(0);
  }, [product.id]);

  useEffect(() => {
    if (slideCount < 2 || paused) return;
    const id = window.setInterval(() => {
      setSlide((i) => (i + 1) % slideCount);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [slideCount, paused, product.id]);

  const brandLine =
    [product.brand, product.category]
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
      .join(' • ') || 'Jersey';

  const showDiscount = hasProductDiscount(product);
  const salePrice = Number(product.price) || 0;
  const originalPrice = Number(product.originalPrice) || 0;
  const activeIndex = slideCount ? Math.min(slide, slideCount - 1) : 0;

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWishlist(product);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onQuickAdd) {
      onQuickAdd(product);
      return;
    }
    onSelect(product);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    setPaused(false);
    if (start == null || slideCount < 2) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const delta = end - start;
    if (Math.abs(delta) < SWIPE_PX) return;
    e.stopPropagation();
    setSlide((i) => (delta < 0 ? (i + 1) % slideCount : (i - 1 + slideCount) % slideCount));
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className="group bg-[#121212] border border-zinc-800 hover:border-red-600 rounded-xl lg:rounded-2xl p-1.5 sm:p-2 lg:p-3 cursor-pointer shadow-sm hover:shadow-lg hover:shadow-red-600/10 transition-all duration-300 relative flex flex-col h-full min-w-0 overflow-visible"
      id={`product-card-${product.id}`}
      title={product.name}
    >
      <div className="min-w-0 flex flex-col flex-1">
        <div
          className="relative mb-2 sm:mb-2.5 lg:mb-3 w-full aspect-[4/5] sm:aspect-[3/4] shrink-0 overflow-hidden rounded-lg lg:rounded-xl bg-white"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {slideCount > 0 ? (
            <>
              <div
                className="absolute inset-0 flex transition-transform duration-500 ease-out will-change-transform"
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
              >
                {galleryImages.map((src, i) => (
                  <div
                    key={`${product.id}-slide-${i}`}
                    className="relative h-full w-full min-w-full flex items-center justify-center p-1 sm:p-1.5 lg:p-2 box-border bg-white"
                  >
                    <img
                      src={src}
                      alt={`${product.name} view ${i + 1}`}
                      className="max-h-full max-w-full w-auto h-auto object-contain object-center select-none"
                      loading={i === 0 ? 'eager' : 'lazy'}
                      referrerPolicy="no-referrer"
                      draggable={false}
                    />
                  </div>
                ))}
              </div>

              {slideCount > 1 && (
                <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center items-center gap-1.5">
                  {galleryImages.map((_, i) => (
                    <button
                      key={`dot-${i}`}
                      type="button"
                      aria-label={`Show image ${i + 1}`}
                      aria-current={i === activeIndex}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlide(i);
                      }}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        i === activeIndex
                          ? 'w-5 bg-red-600'
                          : 'w-2 bg-zinc-400/80 hover:bg-zinc-600'
                      }`}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3 overflow-hidden bg-white [&_img]:!max-h-full [&_img]:!max-w-full [&_img]:!h-auto [&_img]:!w-auto [&_img]:!object-contain [&_img]:!rounded-none [&_svg]:max-h-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:w-auto">
              <JerseyRenderer
                productId={product.id}
                uploadedImage={product.uploadedImage}
                imageKey={product.image}
              />
            </div>
          )}

          <button
            onClick={handleWishlist}
            className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-20 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/75 shadow-md border border-zinc-700 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            aria-pressed={isWishlisted}
            type="button"
          >
            <Heart
              size={16}
              strokeWidth={2.25}
              className={
                isWishlisted
                  ? 'fill-red-500 text-red-500 transition-colors'
                  : 'fill-transparent text-white transition-colors'
              }
            />
          </button>

          {product.isPreOrder && (
            <span className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20 bg-red-600 text-white text-[8px] lg:text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 lg:px-2 lg:py-1 rounded-md shadow-sm">
              Pre-Order
            </span>
          )}
        </div>

        <div className="flex flex-col gap-0.5 sm:gap-1 mb-1.5 sm:mb-2 min-w-0 px-0.5">
          <span className="block text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold truncate">
            {brandLine}
          </span>
          <h3 className="block text-white text-[11px] sm:text-xs lg:text-sm font-black tracking-tight line-clamp-2 min-h-[2rem] sm:min-h-[2.25rem] lg:min-h-[2.5rem] group-hover:text-red-500 transition-colors text-left leading-snug">
            {product.name || 'Jersey'}
          </h3>
          <div className="flex items-baseline gap-1.5 flex-wrap pt-0.5">
            <span className="text-sm sm:text-base lg:text-lg font-black text-red-500 tabular-nums">
              {formatPrice(salePrice)}
            </span>
            {showDiscount && originalPrice > salePrice ? (
              <span className="text-[10px] sm:text-xs text-zinc-500 line-through font-bold tabular-nums">
                {formatPrice(originalPrice)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-0 shrink-0">
        <button
          onClick={handleAddToCart}
          type="button"
          className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-600 py-2 sm:py-2.5 lg:py-3 px-2 sm:px-3 rounded-lg lg:rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer font-sans"
          title="Add to cart"
          id={`add-to-cart-${product.id}`}
        >
          <ShoppingBag size={12} className="shrink-0" />
          <span className="whitespace-nowrap">Add to Cart</span>
        </button>
      </div>
    </div>
  );
};
