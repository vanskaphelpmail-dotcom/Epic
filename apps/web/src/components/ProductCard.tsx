import React, { useState } from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { JerseyRenderer } from './JerseyRenderer';
import { isRenderableImageSrc } from '../lib/productImage';
import { getProductSizes, getSizeStock, isSizeAvailable } from '../lib/productSizes';
import { getProductDiscountPercent, hasProductDiscount } from '../lib/productPricing';
import { toast } from './UiFeedback';

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

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onToggleWishlist,
  isWishlisted,
  onQuickAdd,
  formatPrice,
  onCheckout,
}) => {
  const sizes = getProductSizes(product);
  const defaultSize =
    sizes.find((s) => isSizeAvailable(product, s)) || sizes[0] || 'M';
  const [selectedSize] = useState<string>(defaultSize);
  const quantity = 1;
  const sizeStock = getSizeStock(product, selectedSize);
  const totalStock = product.stock || 0;

  const galleryImages = Array.from(
    new Set(
      [...(product.gallery || []), ...(product.images || []), product.uploadedImage, product.image].filter(
        (src): src is string => isRenderableImageSrc(src)
      )
    )
  ).slice(0, 3);

  const handleWishlist = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleWishlist(product);
  };

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sizeStock <= 0 && !product.isPreOrder) {
      toast(`Size ${selectedSize} is currently out of stock.`, 'error');
      return;
    }
    if (onQuickAdd) {
      onQuickAdd(product, selectedSize, Math.min(quantity, sizeStock > 0 ? sizeStock : quantity));
    }
  };

  const handleCheckoutClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sizeStock <= 0 && !product.isPreOrder) {
      toast(`Size ${selectedSize} is currently out of stock.`, 'error');
      return;
    }
    if (onCheckout) {
      onCheckout(product, selectedSize, Math.min(quantity, sizeStock > 0 ? sizeStock : quantity));
    }
  };

  return (
    <div
      onClick={() => onSelect(product)}
      className="group bg-white border border-emerald-100 hover:border-emerald-400 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300 relative flex flex-col h-full min-w-0"
      id={`product-card-${product.id}`}
    >
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Fixed square media — every card same width/height; heart inset for white gap */}
        <div className="relative mb-3.5 sm:mb-4 w-full aspect-square shrink-0 overflow-hidden rounded-xl sm:rounded-2xl bg-emerald-50/50 ring-1 ring-emerald-100/80">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_40%,rgba(16,185,129,0.06),transparent_62%)]" />

          {galleryImages[0] ? (
            <img
              src={galleryImages[0]}
              alt={product.name}
              className="absolute inset-0 h-full w-full object-cover object-center select-none"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="absolute inset-0 overflow-hidden [&_img]:!max-h-none [&_img]:!h-full [&_img]:!w-full [&_img]:!object-cover [&_img]:!rounded-none [&_img]:!drop-shadow-none [&_svg]:h-full [&_svg]:w-full">
              <JerseyRenderer
                productId={product.id}
                uploadedImage={product.uploadedImage}
                imageKey={product.image}
              />
            </div>
          )}

          <button
            onClick={handleWishlist}
            className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-20 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white shadow-md border-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            aria-label={isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            aria-pressed={isWishlisted}
            type="button"
          >
            <Heart
              size={18}
              strokeWidth={2.25}
              className={
                isWishlisted
                  ? 'fill-red-500 text-red-500 transition-colors'
                  : 'fill-transparent text-neutral-800 transition-colors'
              }
            />
          </button>

          {product.isPreOrder && (
            <span className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-20 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
              Pre-Order
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-700 font-bold">
              {[product.brand, product.category]
                .map((v) => String(v || '').trim())
                .filter(Boolean)
                .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
                .join(' • ') || 'Jersey'}
            </span>
          </div>
          <h3 className="text-emerald-950 text-sm font-black tracking-tight line-clamp-1 group-hover:text-emerald-600 transition-colors text-left">
            {product.name}
          </h3>
        </div>
      </div>

      <div className="space-y-3 pt-3 mt-3 border-t border-emerald-100">
        {/* Size chips are informational — click opens details */}
        <div className="space-y-1.5 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold text-emerald-700/60 uppercase tracking-widest font-mono">AVAILABLE SIZES</span>
            <span className={`text-[9px] font-mono font-bold ${
              product.isPreOrder
                ? 'text-amber-700'
                : totalStock <= 0
                  ? 'text-rose-700'
                  : totalStock <= (product.lowStockThreshold || 3)
                    ? 'text-amber-700'
                    : 'text-emerald-700'
            }`}>
              {product.isPreOrder
                ? (product.preOrderEta || 'Pre-order available')
                : totalStock <= 0
                  ? 'Out of stock'
                  : `${totalStock} in stock`}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {sizes.map((size) => {
              const available = isSizeAvailable(product, size);
              return (
                <span
                  key={size}
                  title={available ? `Size ${size}: ${getSizeStock(product, size)} in stock` : `Size ${size} unavailable`}
                  className={`w-7 h-7 rounded-lg text-[10px] font-black border flex items-center justify-center ${
                    !available
                      ? 'bg-gray-50 border-gray-200 text-gray-400 line-through opacity-60'
                      : 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
                  }`}
                >
                  {size}
                </span>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5 pt-3 border-t border-emerald-100">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
              product.isPreOrder
                ? 'text-amber-700'
                : totalStock <= 0
                  ? 'text-rose-700'
                  : 'text-emerald-700/60'
            }`}>
              {product.isPreOrder
                ? 'Pre-Order'
                : totalStock <= 0
                  ? 'Out of Stock'
                  : totalStock <= (product.lowStockThreshold || 3)
                    ? `Only ${totalStock} Left`
                    : 'In Stock'}
            </span>
            <div className="flex flex-col items-end gap-0.5 text-right">
              {hasProductDiscount(product) ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-emerald-700/40 text-xs line-through font-mono">
                      {formatPrice(product.originalPrice!)}
                    </span>
                    <span className="text-emerald-800 text-base font-black font-mono">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">
                    {getProductDiscountPercent(product)}% OFF
                  </span>
                </>
              ) : (
                <span className="text-emerald-800 text-base font-black font-mono">{formatPrice(product.price)}</span>
              )}
            </div>
          </div>

          <div className={product.isPreOrder ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-1 md:grid-cols-2 gap-2'}>
            {product.isPreOrder ? (
              <button
                onClick={handleQuickAdd}
                type="button"
                className="bg-amber-600 hover:bg-amber-700 text-white border border-amber-700 py-2 sm:py-2.5 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans shadow-md shadow-amber-900/10 w-full"
                title="Pre-order this product"
                id={`preorder-${product.id}`}
              >
                <ShoppingCart size={11} />
                <span>PRE-ORDER</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleQuickAdd}
                  type="button"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 py-2 sm:py-2.5 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans w-full"
                  title="Add to cart"
                  id={`quick-add-${product.id}`}
                >
                  <ShoppingCart size={11} className="shrink-0" />
                  <span>ADD TO CART</span>
                </button>
                <button
                  onClick={handleCheckoutClick}
                  type="button"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-800 py-2 sm:py-2.5 px-2 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer font-sans shadow-md shadow-emerald-900/10 w-full"
                  title="Order now"
                  id={`checkout-${product.id}`}
                >
                  <span>ORDER NOW</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
